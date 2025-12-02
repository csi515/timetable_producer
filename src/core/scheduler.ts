import { TimetableEntry, ScheduleResult, ScheduleConfig, ClassInfo, MultipleScheduleResult } from '../types/timetable';
import { Subject } from '../types/subject';
import { Teacher } from '../types/teacher';
import { CSPSolver } from './cspSolver';
import { ConstraintValidator } from './constraintValidator';
import { optimizer } from './optimizer';
import { ConstraintRelaxer } from './constraintRelaxer';

export class Scheduler {
  private config: ScheduleConfig;
  private subjects: Subject[];
  private teachers: Teacher[];
  private classes: ClassInfo[];

  constructor(
    config: ScheduleConfig,
    subjects: Subject[],
    teachers: Teacher[],
    classes: ClassInfo[]
  ) {
    this.config = config;
    this.subjects = subjects;
    this.teachers = teachers;
    this.classes = classes;
  }

  generate(): ScheduleResult {
    // 1. CSP Solver로 초기 해결
    const cspSolver = new CSPSolver(this.config, this.subjects, this.teachers, this.classes);
    let entries = cspSolver.solve();

    // 2. 해결되지 않은 경우 빈 배열 반환
    if (entries.length === 0) {
      return {
        entries: [],
        classes: this.classes,
        subjects: this.subjects,
        teachers: this.teachers,
        violations: [],
        score: Infinity
      };
    }

    // 3. Soft Constraint 최적화
    entries = optimizer.optimize(entries, this.subjects, this.teachers, this.config, this.classes);

    // 4. 최종 검증
    const validator = new ConstraintValidator(entries, this.subjects, this.teachers, this.classes);
    const violations = validator.validateAll();
    const score = validator.calculateScore();

    return {
      entries,
      classes: this.classes,
      subjects: this.subjects,
      teachers: this.teachers,
      violations,
      score,
      days: this.config.days
    };
  }

  generateWithRetry(
    maxRetries: number = 10,
    log?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
  ): ScheduleResult {
    let bestResult: ScheduleResult | null = null;
    let bestScore = Infinity;

    for (let i = 0; i < maxRetries; i++) {
      if (log) log(`시도 ${i + 1}/${maxRetries}...`);
      
      const randomSeed = Math.random() * 1000000;
      const cspSolver = new CSPSolver(this.config, this.subjects, this.teachers, this.classes, randomSeed);
      let entries = cspSolver.solve();

      if (entries.length > 0) {
        if (log) log(`  → 초기 해결 완료 (${entries.length}개 항목)`);
        entries = optimizer.optimize(entries, this.subjects, this.teachers, this.config, this.classes);
        const validator = new ConstraintValidator(entries, this.subjects, this.teachers, this.classes);
        const violations = validator.validateAll();
        const score = validator.calculateScore();

        const result: ScheduleResult = {
          entries,
          classes: this.classes,
          subjects: this.subjects,
          teachers: this.teachers,
          violations,
          score,
          days: this.config.days
        };

        const criticalViolations = result.violations.filter(v => v.type === 'critical');

        if (criticalViolations.length === 0) {
          if (result.score < bestScore) {
            bestResult = result;
            bestScore = result.score;
            if (log) log(`  ✅ 더 나은 해 발견 (점수: ${score.toFixed(2)})`, 'success');
          }
        } else {
          if (log) log(`  ⚠️ Critical 위반 ${criticalViolations.length}개`, 'warning');
        }
      } else {
        if (log) log(`  ❌ 해결 실패`, 'warning');
      }
    }

    return bestResult || this.generate();
  }

  generateMultiple(
    minCount: number = 3,
    maxAttempts: number = 50,
    log?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void,
    shouldCancel?: () => boolean
  ): MultipleScheduleResult {
    const results: ScheduleResult[] = [];
    const seenHashes = new Set<string>();
    let generationAttempts = 0;
    let relaxationAttempts = 0;
    let canRelax = false;

    // 원본 데이터로 시도
    let currentSubjects = [...this.subjects];
    let currentTeachers = [...this.teachers];
    const relaxer = new ConstraintRelaxer(currentSubjects, currentTeachers);

    if (log) log(`목표: ${minCount}개 시간표 생성`, 'info');

    while (results.length < minCount && generationAttempts < maxAttempts) {
      if (shouldCancel && shouldCancel()) {
        if (log) log('생성이 중단되었습니다.', 'warning');
        break;
      }

      generationAttempts++;
      if (log) log(`[${generationAttempts}/${maxAttempts}] 시간표 생성 시도 중... (현재 ${results.length}/${minCount}개 완료)`);

      const randomSeed = Math.random() * 1000000;
      const cspSolver = new CSPSolver(this.config, currentSubjects, currentTeachers, this.classes, randomSeed);
      let entries = cspSolver.solve();

      if (entries.length === 0) {
        if (log) log(`  → 해결 실패`, 'warning');
        
        // 생성 실패 시 완화 시도
        if (generationAttempts > 10 && relaxationAttempts < 3) {
          const lastResult = results[results.length - 1];
          if (lastResult) {
            if (log) log(`  → 제약조건 완화 시도 중...`, 'info');
            const suggestions = relaxer.generateSuggestions(lastResult.violations);
            if (suggestions.length > 0) {
              const suggestion = suggestions[0];
              const relaxationResult = relaxer.applyRelaxation(suggestion);

              if (relaxationResult.success) {
                currentSubjects = relaxer.getRelaxedSubjects();
                currentTeachers = relaxer.getRelaxedTeachers();
                relaxationAttempts++;
                canRelax = true;
                if (log) log(`  ✅ 제약조건 완화 적용 (${relaxationAttempts}번째)`, 'success');
                continue;
              }
            }
          }
        }
        continue;
      }

      if (log) log(`  → 초기 해결 완료 (${entries.length}개 항목)`);

      // 최적화
      entries = optimizer.optimize(entries, currentSubjects, currentTeachers, this.config, this.classes);
      if (log) log(`  → 최적화 완료`);

      // 검증
      const validator = new ConstraintValidator(entries, currentSubjects, currentTeachers, this.classes);
      const violations = validator.validateAll();
      const score = validator.calculateScore();

      // 해시 생성 (중복 체크용)
      const hash = this.generateHash(entries);
      if (seenHashes.has(hash)) {
        if (log) log(`  → 중복 시간표 (건너뜀)`, 'warning');
        continue; // 중복된 시간표는 제외
      }
      seenHashes.add(hash);

      const result: ScheduleResult = {
        entries,
        classes: this.classes,
        subjects: currentSubjects,
        teachers: currentTeachers,
        violations,
        score,
        days: this.config.days
      };

      // Critical 위반이 없는 경우만 추가
      const criticalViolations = violations.filter(v => v.type === 'critical');
      if (criticalViolations.length === 0) {
        results.push(result);
        if (log) log(`  ✅ 시간표 ${results.length}번째 생성 완료! (점수: ${score.toFixed(2)})`, 'success');
      } else {
        if (log) log(`  ⚠️ Critical 위반 ${criticalViolations.length}개로 제외`, 'warning');
      }
    }

    // 점수순으로 정렬
    results.sort((a, b) => a.score - b.score);

    return {
      results,
      selectedIndex: results.length > 0 ? 0 : undefined,
      generationAttempts,
      relaxationAttempts,
      canRelax,
      relaxationSuggestions: [] // TODO: 실제 제안 생성 로직 추가
    };
  }

  private generateHash(entries: TimetableEntry[]): string {
    // 시간표의 고유 해시 생성 (간단한 버전)
    const sorted = entries
      .map(e => `${e.classId}-${e.subjectId}-${e.day}-${e.period}`)
      .sort()
      .join('|');

    // 간단한 해시 함수
    let hash = 0;
    for (let i = 0; i < sorted.length; i++) {
      const char = sorted.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit 정수로 변환
    }
    return hash.toString();
  }
}

