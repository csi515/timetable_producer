import { TimetableEntry } from '../types/timetable';
import { Subject } from '../types/subject';
import { Teacher } from '../types/teacher';
import { ClassInfo, ScheduleConfig } from '../types/timetable';
import { ConstraintValidator } from './constraintValidator';

export interface CSPVariable {
  classId: string;
  subjectId: string;
  teacherIds: string[];
  requiredHours: number;
  priority: number;
  isBlockClass: boolean;
  blockHours?: number;
  requiresSpecialRoom: boolean;
  specialRoomType?: string;
  isCoTeaching: boolean;
  isExternalInstructor: boolean;
  preferConcentrated: boolean;
  fixedDay?: string;
  fixedPeriod?: number;
}

export interface CSPDomain {
  day: string;
  period: number;
  roomId?: string;
}

export class CSPSolver {
  private config: ScheduleConfig;
  private subjects: Subject[];
  private teachers: Teacher[];
  private classes: ClassInfo[];
  private validator: ConstraintValidator;
  private randomSeed: number;

  constructor(
    config: ScheduleConfig,
    subjects: Subject[],
    teachers: Teacher[],
    classes: ClassInfo[],
    randomSeed: number = Math.random() * 1000000
  ) {
    this.config = config;
    this.subjects = subjects;
    this.teachers = teachers;
    this.classes = classes;
    this.validator = new ConstraintValidator([], subjects, teachers, classes);
    this.randomSeed = randomSeed || Math.random() * 1000000;
  }

  solve(): TimetableEntry[] {
    // 1. 변수 생성
    this.variables = this.createVariables();

    // 2. 도메인 생성
    const domains = this.createDomains();

    // 3. Backtracking으로 해결 (MRV 적용을 위해 unassignedVariables 관리)
    const assignments: TimetableEntry[] = [];
    const unassignedVariableIds = new Set(this.variables.map((_, i) => i));

    const result = this.backtrack(unassignedVariableIds, domains, assignments);

    return result || [];
  }

  // ... existing random and shuffle methods ...

  private random(): number {
    this.randomSeed = (this.randomSeed * 9301 + 49297) % 233280;
    return this.randomSeed / 233280;
  }

  private shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // ... createVariables and calculatePriority ...
  private createVariables(): CSPVariable[] {
    const variables: CSPVariable[] = [];

    for (const classInfo of this.classes) {
      for (const subject of this.subjects) {
        // 대상 학년 체크
        if (subject.targetGrades && !subject.targetGrades.includes(classInfo.grade)) {
          continue;
        }

        const requiredHours = subject.weeklyHours;
        const teachersForSubject = this.teachers.filter(t =>
          t.subjects.includes(subject.id)
        );

        if (teachersForSubject.length === 0) continue;

        // 공동수업인 경우
        if (subject.isCoTeaching && subject.coTeachingTeachers) {
          const coTeachers = subject.coTeachingTeachers
            .map(id => this.teachers.find(t => t.id === id))
            .filter(t => t !== undefined) as Teacher[];

          if (coTeachers.length > 0) {
            // 공동수업도 블록이 아니면 쪼개야 함? 보통 공동수업은 블록일 가능성 높음.
            // 일단 블록 여부에 따라 처리
            if (subject.isBlockClass && subject.blockHours) {
              // 블록 수업은 덩어리로 처리 (기존 로직 유지하되, 시수만큼 반복)
              // 예: 4시간 수업인데 2시간 블록이면, 2시간 블록 변수 2개 생성
              const blockCount = Math.floor(requiredHours / subject.blockHours);
              for (let i = 0; i < blockCount; i++) {
                variables.push({
                  classId: classInfo.id,
                  subjectId: subject.id,
                  teacherIds: coTeachers.map(t => t.id),
                  requiredHours: subject.blockHours,
                  priority: this.calculatePriority(subject, coTeachers),
                  isBlockClass: true,
                  blockHours: subject.blockHours,
                  requiresSpecialRoom: subject.requiresSpecialRoom,
                  specialRoomType: subject.specialRoomType,
                  isCoTeaching: true,
                  isExternalInstructor: subject.isExternalInstructor,
                  preferConcentrated: subject.preferConcentrated
                });
              }
              // 남은 시수 처리 (블록보다 작으면 1시간짜리로?)
              const remaining = requiredHours % subject.blockHours;
              for (let i = 0; i < remaining; i++) {
                variables.push({
                  classId: classInfo.id,
                  subjectId: subject.id,
                  teacherIds: coTeachers.map(t => t.id),
                  requiredHours: 1,
                  priority: this.calculatePriority(subject, coTeachers),
                  isBlockClass: false,
                  requiresSpecialRoom: subject.requiresSpecialRoom,
                  specialRoomType: subject.specialRoomType,
                  isCoTeaching: true,
                  isExternalInstructor: subject.isExternalInstructor,
                  preferConcentrated: subject.preferConcentrated
                });
              }
            } else {
              // 블록 아님: 1시간씩 쪼개기
              for (let i = 0; i < requiredHours; i++) {
                variables.push({
                  classId: classInfo.id,
                  subjectId: subject.id,
                  teacherIds: coTeachers.map(t => t.id),
                  requiredHours: 1,
                  priority: this.calculatePriority(subject, coTeachers),
                  isBlockClass: false,
                  requiresSpecialRoom: subject.requiresSpecialRoom,
                  specialRoomType: subject.specialRoomType,
                  isCoTeaching: true,
                  isExternalInstructor: subject.isExternalInstructor,
                  preferConcentrated: subject.preferConcentrated,
                  fixedDay: subject.fixedTimes?.[i]?.day,
                  fixedPeriod: subject.fixedTimes?.[i]?.period
                });
              }
            }
          }
        } else {
          // 일반 수업
          for (const teacher of teachersForSubject) {
            if (subject.isBlockClass && subject.blockHours) {
              const blockCount = Math.floor(requiredHours / subject.blockHours);
              for (let i = 0; i < blockCount; i++) {
                variables.push({
                  classId: classInfo.id,
                  subjectId: subject.id,
                  teacherIds: [teacher.id],
                  requiredHours: subject.blockHours,
                  priority: this.calculatePriority(subject, [teacher]),
                  isBlockClass: true,
                  blockHours: subject.blockHours,
                  requiresSpecialRoom: subject.requiresSpecialRoom,
                  specialRoomType: subject.specialRoomType,
                  isCoTeaching: false,
                  isExternalInstructor: subject.isExternalInstructor,
                  preferConcentrated: subject.preferConcentrated
                });
              }
              const remaining = requiredHours % subject.blockHours;
              for (let i = 0; i < remaining; i++) {
                variables.push({
                  classId: classInfo.id,
                  subjectId: subject.id,
                  teacherIds: [teacher.id],
                  requiredHours: 1,
                  priority: this.calculatePriority(subject, [teacher]),
                  isBlockClass: false,
                  requiresSpecialRoom: subject.requiresSpecialRoom,
                  specialRoomType: subject.specialRoomType,
                  isCoTeaching: false,
                  isExternalInstructor: subject.isExternalInstructor,
                  preferConcentrated: subject.preferConcentrated
                });
              }
            } else {
              // 1시간씩 쪼개기
              for (let i = 0; i < requiredHours; i++) {
                variables.push({
                  classId: classInfo.id,
                  subjectId: subject.id,
                  teacherIds: [teacher.id],
                  requiredHours: 1,
                  priority: this.calculatePriority(subject, [teacher]),
                  isBlockClass: false,
                  requiresSpecialRoom: subject.requiresSpecialRoom,
                  specialRoomType: subject.specialRoomType,
                  isCoTeaching: false,
                  isExternalInstructor: subject.isExternalInstructor,
                  preferConcentrated: subject.preferConcentrated,
                  fixedDay: subject.fixedTimes?.[i]?.day,
                  fixedPeriod: subject.fixedTimes?.[i]?.period
                });
              }
            }
          }
        }
      }
    }

    // MRV를 위해 정렬은 하지 않고 반환 (동적 선택)
    return variables;
  }

  private calculatePriority(subject: Subject, teachers: Teacher[]): number {
    let priority = 1000; // 기본 우선순위

    // 1. 공동수업 (최우선)
    if (subject.isCoTeaching) {
      priority = 100;
    }
    // 2. 블록 수업
    else if (subject.isBlockClass) {
      priority = 200;
    }
    // 3. 특별실 필요
    else if (subject.requiresSpecialRoom) {
      priority = 300;
    }
    // 4. 외부 강사
    else if (subject.isExternalInstructor) {
      priority = 400;
    }
    // 5. 우선 배치 교사
    else if (teachers.some(t => t.isPriority)) {
      priority = 500;
    }
    // 6. 일반 과목
    else {
      priority = 600;
    }

    return priority;
  }

  private createDomains(): CSPDomain[] {
    const domains: CSPDomain[] = [];

    for (const day of this.config.days) {
      for (let period = 1; period <= this.config.maxPeriodsPerDay; period++) {
        domains.push({ day, period });
      }
    }

    return domains;
  }

  private backtrack(
    unassignedVariableIds: Set<number>,
    domains: CSPDomain[],
    assignments: TimetableEntry[]
  ): TimetableEntry[] | null {
    // 모든 변수에 할당 완료
    if (unassignedVariableIds.size === 0) {
      this.validator = new ConstraintValidator(assignments, this.subjects, this.teachers, this.classes);
      if (!this.validator.hasCriticalViolations()) {
        return assignments;
      }
      return null;
    }

    // MRV: 가장 제약이 심한 변수 선택
    const variableIndex = this.selectVariable(unassignedVariableIds, domains, assignments);
    const variable = this.variables[variableIndex];

    // 선택된 변수 제거
    const nextUnassignedIds = new Set(unassignedVariableIds);
    nextUnassignedIds.delete(variableIndex);

    // 블록 수업 처리
    if (variable.isBlockClass && variable.blockHours) {
      return this.assignBlockClass(variable, domains, assignments, nextUnassignedIds);
    }

    // 일반 수업 처리
    // LCV: 가장 제약을 덜 주는 값부터 시도 (여기서는 단순 필터링 후 셔플 대신 정렬 가능)
    const validDomains = this.filterDomains(variable, domains, assignments);

    // LCV 적용: 도메인 정렬 (옵션) - 현재는 셔플 유지하되, 향후 확장 가능
    // 성능을 위해 단순 셔플 사용 (완벽한 LCV는 계산 비용이 높음)
    const shuffledDomains = this.shuffle(validDomains);

    for (const domain of shuffledDomains) {
      // 필요한 시수만큼 할당
      const hoursToAssign = variable.requiredHours;
      const newAssignments: TimetableEntry[] = [...assignments];

      for (let h = 0; h < hoursToAssign; h++) {
        const entry: TimetableEntry = {
          id: `${variable.classId}-${variable.subjectId}-${Date.now()}-${h}`,
          classId: variable.classId,
          subjectId: variable.subjectId,
          teacherId: variable.teacherIds[0],
          teacherIds: variable.teacherIds.length > 1 ? variable.teacherIds : undefined,
          day: domain.day,
          period: domain.period + h,
          roomId: variable.requiresSpecialRoom ? variable.specialRoomType : undefined,
          isBlockClass: false
        };

        newAssignments.push(entry);
      }

      // 제약조건 검증
      const tempValidator = new ConstraintValidator(newAssignments, this.subjects, this.teachers, this.classes);
      if (!tempValidator.hasCriticalViolations()) {
        const result = this.backtrack(nextUnassignedIds, domains, newAssignments);
        if (result) return result;
      }
    }

    return null;
  }

  // MRV: 남은 도메인 수가 가장 적은 변수 선택
  private selectVariable(
    unassignedIds: Set<number>,
    domains: CSPDomain[],
    assignments: TimetableEntry[]
  ): number {
    let bestIndex = -1;
    let minDomainCount = Infinity;
    let maxPriority = -1; // 우선순위가 높을수록(숫자가 작을수록) 먼저 배정해야 함. 코드상 priority는 작을수록 높음.

    for (const index of unassignedIds) {
      const variable = this.variables[index];

      // 1. 우선순위 비교 (낮은 숫자가 높은 우선순위)
      // 기존 로직: priority가 작을수록 중요
      // 여기서는 MRV가 주가 되지만, priority도 고려해야 함.
      // MRV를 1순위, Priority를 2순위로 하거나 그 반대.
      // 보통 CSP에서는 MRV가 강력함.

      let domainCount = 0;
      if (variable.isBlockClass && variable.blockHours) {
        domainCount = this.filterDomainsForBlock(variable, domains, assignments, variable.blockHours).length;
      } else {
        domainCount = this.filterDomains(variable, domains, assignments).length;
      }

      // 도메인이 0개면 즉시 선택 (실패 유도하여 백트래킹)
      if (domainCount === 0) return index;

      if (domainCount < minDomainCount) {
        minDomainCount = domainCount;
        bestIndex = index;
        maxPriority = variable.priority;
      } else if (domainCount === minDomainCount) {
        // 도메인 수가 같으면 우선순위가 높은(값이 작은) 것 선택
        if (variable.priority < maxPriority) {
          bestIndex = index;
          maxPriority = variable.priority;
        }
      }
    }

    return bestIndex;
  }

  private assignBlockClass(
    variable: CSPVariable,
    domains: CSPDomain[],
    assignments: TimetableEntry[],
    nextUnassignedIds: Set<number>
  ): TimetableEntry[] | null {
    const blockHours = variable.blockHours || 3;
    const validDomains = this.filterDomainsForBlock(variable, domains, assignments, blockHours);

    // LCV 적용 가능 지점
    const shuffledDomains = this.shuffle(validDomains);

    for (const startDomain of shuffledDomains) {
      const newAssignments: TimetableEntry[] = [...assignments];

      // 연속된 교시에 블록 수업 할당
      for (let i = 0; i < blockHours; i++) {
        const entry: TimetableEntry = {
          id: `${variable.classId}-${variable.subjectId}-${Date.now()}-${i}`,
          classId: variable.classId,
          subjectId: variable.subjectId,
          teacherId: variable.teacherIds[0],
          teacherIds: variable.teacherIds.length > 1 ? variable.teacherIds : undefined,
          day: startDomain.day,
          period: startDomain.period + i,
          roomId: variable.requiresSpecialRoom ? variable.specialRoomType : undefined,
          isBlockClass: true,
          blockStartPeriod: startDomain.period
        };

        newAssignments.push(entry);
      }

      // 제약조건 검증
      const tempValidator = new ConstraintValidator(newAssignments, this.subjects, this.teachers, this.classes);
      if (!tempValidator.hasCriticalViolations()) {
        const result = this.backtrack(
          nextUnassignedIds,
          domains,
          newAssignments
        );
        if (result) return result;
      }
    }

    return null;
  }

  private filterDomains(
    variable: CSPVariable,
    domains: CSPDomain[],
    assignments: TimetableEntry[]
  ): CSPDomain[] {
    return domains.filter(domain => {
      // 고정 시간 체크
      if (variable.fixedDay && variable.fixedPeriod) {
        if (domain.day !== variable.fixedDay || domain.period !== variable.fixedPeriod) {
          return false;
        }
      }

      // 교사 불가능 시간 체크
      for (const teacherId of variable.teacherIds) {
        const teacher = this.teachers.find(t => t.id === teacherId);
        if (teacher) {
          const isUnavailable = teacher.unavailableTimes.some(
            ut => ut.day === domain.day && ut.period === domain.period
          );
          if (isUnavailable) return false;
        }
      }

      // 이미 할당된 시간과 충돌 체크
      const conflicting = assignments.some(a => {
        const aTeacherIds = a.teacherIds || [a.teacherId];
        const vTeacherIds = variable.teacherIds;

        return (
          a.day === domain.day &&
          a.period === domain.period &&
          (aTeacherIds.some(id => vTeacherIds.includes(id)) ||
            (a.roomId && variable.requiresSpecialRoom && a.roomId === variable.specialRoomType))
        );
      });

      return !conflicting;
    });
  }

  private filterDomainsForBlock(
    variable: CSPVariable,
    domains: CSPDomain[],
    assignments: TimetableEntry[],
    blockHours: number
  ): CSPDomain[] {
    const validDomains = domains.filter(domain => {
      // 연속된 교시가 모두 가능한지 확인
      for (let i = 0; i < blockHours; i++) {
        const period = domain.period + i;
        if (period > this.config.maxPeriodsPerDay) return false;

        // 각 교시에 대해 제약조건 체크
        const tempDomain: CSPDomain = { day: domain.day, period };
        const validDomains = this.filterDomains(variable, [tempDomain], assignments);
        if (validDomains.length === 0) return false;
      }

      return true;
    });

    return validDomains;
  }

  private variables: CSPVariable[] = [];

  private getRemainingVariables(startIndex: number): CSPVariable[] {
    // 전체 변수 목록에서 startIndex 이후의 변수들 반환
    return this.variables.slice(startIndex + 1);
  }
}

