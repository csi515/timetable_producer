import { TimetableEntry } from '../types/timetable';
import { Subject } from '../types/subject';
import { Teacher } from '../types/teacher';
import { ScheduleConfig, ClassInfo } from '../types/timetable';
import { softConstraints } from './constraints';
import { ConstraintValidator } from './constraintValidator';

class Optimizer {
  optimize(
    entries: TimetableEntry[],
    subjects: Subject[],
    teachers: Teacher[],
    config: ScheduleConfig,
    classes: ClassInfo[] = []
  ): TimetableEntry[] {
    let currentEntries = [...entries];
    let currentScore = this.calculateScore(currentEntries, subjects, teachers, classes);
    let improved = true;
    let iterations = 0;
    const maxIterations = 100;

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;

      // Local search: 인접한 해와 교환
      for (let i = 0; i < currentEntries.length; i++) {
        for (let j = i + 1; j < currentEntries.length; j++) {
          const swapped = this.swapEntries(currentEntries, i, j);
          const validator = new ConstraintValidator(swapped, subjects, teachers, classes);

          // Critical 위반이 없고 점수가 개선된 경우
          if (!validator.hasCriticalViolations()) {
            const newScore = validator.calculateScore();
            if (newScore < currentScore) {
              currentEntries = swapped;
              currentScore = newScore;
              improved = true;
            }
          }
        }
      }

      // 이동 최적화: 같은 교사의 수업을 가까운 시간으로 이동
      currentEntries = this.optimizeMovements(currentEntries, subjects, teachers, config);
    }

    return currentEntries;
  }

  private calculateScore(
    entries: TimetableEntry[],
    subjects: Subject[],
    teachers: Teacher[],
    classes: ClassInfo[]
  ): number {
    let score = 0;

    for (const softConstraint of softConstraints) {
      const value = softConstraint.evaluate(entries, subjects, teachers, classes);
      score += value * softConstraint.weight;
    }

    return score;
  }

  private swapEntries(entries: TimetableEntry[], i: number, j: number): TimetableEntry[] {
    const swapped = [...entries];
    [swapped[i], swapped[j]] = [swapped[j], swapped[i]];
    return swapped;
  }

  private optimizeMovements(
    entries: TimetableEntry[],
    subjects: Subject[],
    teachers: Teacher[],
    config: ScheduleConfig
  ): TimetableEntry[] {
    const optimized = [...entries];

    // 교사별로 그룹화
    const teacherGroups = new Map<string, TimetableEntry[]>();

    for (const entry of optimized) {
      const teacherIds = entry.teacherIds || [entry.teacherId];
      for (const teacherId of teacherIds) {
        if (!teacherGroups.has(teacherId)) {
          teacherGroups.set(teacherId, []);
        }
        teacherGroups.get(teacherId)!.push(entry);
      }
    }

    // 각 교사의 수업을 같은 날로 모으기
    for (const [teacherId, teacherEntries] of teacherGroups) {
      const dayGroups = new Map<string, TimetableEntry[]>();

      for (const entry of teacherEntries) {
        if (!dayGroups.has(entry.day)) {
          dayGroups.set(entry.day, []);
        }
        dayGroups.get(entry.day)!.push(entry);
      }

      // 가장 많은 수업이 있는 날로 이동
      let maxDay = '';
      let maxCount = 0;

      for (const [day, dayEntries] of dayGroups) {
        if (dayEntries.length > maxCount) {
          maxCount = dayEntries.length;
          maxDay = day;
        }
      }

      // 다른 날의 수업을 최대한 같은 날로 이동 (제약조건 위반하지 않는 범위에서)
      // 실제 구현은 더 복잡한 로직 필요
    }

    return optimized;
  }
}

export const optimizer = new Optimizer();

