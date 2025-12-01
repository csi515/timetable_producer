import { ConstraintViolation, ConstraintType } from '../types/constraints';
import { TimetableEntry, ScheduleResult } from '../types/timetable';
import { Subject } from '../types/subject';
import { Teacher } from '../types/teacher';
import { criticalConstraints, highConstraints, mediumConstraints, lowConstraints, softConstraints } from './constraints';

import { ClassInfo } from '../types/timetable';

export class ConstraintValidator {
  private entries: TimetableEntry[] = [];
  private subjects: Subject[] = [];
  private teachers: Teacher[] = [];
  private classes: ClassInfo[] = [];

  constructor(entries: TimetableEntry[], subjects: Subject[], teachers: Teacher[], classes: ClassInfo[] = []) {
    this.entries = entries;
    this.subjects = subjects;
    this.teachers = teachers;
    this.classes = classes;
  }

  validateAll(): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    // Critical 제약조건 검증
    for (const entry of this.entries) {
      for (const constraint of criticalConstraints) {
        if (!constraint.check(entry, this.entries, this.subjects, this.teachers, this.classes)) {
          violations.push({
            type: ConstraintType.CRITICAL,
            message: constraint.message(entry),
            entryId: entry.id,
            entry,
            details: { constraintName: constraint.name }
          });
        }
      }
    }

    // High 제약조건 검증
    for (const entry of this.entries) {
      for (const constraint of highConstraints) {
        if (!constraint.check(entry, this.entries, this.subjects, this.teachers, this.classes)) {
          violations.push({
            type: ConstraintType.HIGH,
            message: constraint.message(entry),
            entryId: entry.id,
            entry,
            details: { constraintName: constraint.name }
          });
        }
      }
    }

    // 시수 충족 검증 (High)
    violations.push(...this.validateWeeklyHours());

    // Medium 제약조건 검증
    for (const entry of this.entries) {
      for (const constraint of mediumConstraints) {
        if (!constraint.check(entry, this.entries, this.subjects, this.teachers, this.classes)) {
          violations.push({
            type: ConstraintType.MEDIUM,
            message: constraint.message(entry),
            entryId: entry.id,
            entry,
            details: { constraintName: constraint.name }
          });
        }
      }
    }

    // 점심 전 몰빵 검증 (Medium)
    violations.push(...this.validateLunchConcentration());

    return violations;
  }

  private validateWeeklyHours(): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    // 각 과목별로 학급당 시수 확인
    const subjectClassHours = new Map<string, Map<string, number>>();

    for (const entry of this.entries) {
      const key = `${entry.subjectId}-${entry.classId}`;
      if (!subjectClassHours.has(entry.subjectId)) {
        subjectClassHours.set(entry.subjectId, new Map());
      }
      const classMap = subjectClassHours.get(entry.subjectId)!;
      classMap.set(entry.classId, (classMap.get(entry.classId) || 0) + 1);
    }

    for (const subject of this.subjects) {
      const classMap = subjectClassHours.get(subject.id);
      if (classMap) {
        for (const [classId, hours] of classMap) {
          if (hours < subject.weeklyHours) {
            violations.push({
              type: ConstraintType.HIGH,
              message: `${subject.name} 과목이 ${classId}에서 시수 부족 (필요: ${subject.weeklyHours}, 현재: ${hours})`,
              details: { subjectId: subject.id, classId, required: subject.weeklyHours, actual: hours }
            });
          } else if (hours > subject.weeklyHours) {
            violations.push({
              type: ConstraintType.HIGH,
              message: `${subject.name} 과목이 ${classId}에서 시수 초과 (필요: ${subject.weeklyHours}, 현재: ${hours})`,
              details: { subjectId: subject.id, classId, required: subject.weeklyHours, actual: hours }
            });
          }
        }
      } else {
        // 과목이 전혀 배정되지 않음
        violations.push({
          type: ConstraintType.HIGH,
          message: `${subject.name} 과목이 배정되지 않음`,
          details: { subjectId: subject.id }
        });
      }
    }

    return violations;
  }

  private validateLunchConcentration(): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const lunchPeriod = 4; // 점심시간은 4교시와 5교시 사이

    // 각 학급별로 점심 전 교시에 수업이 몰려있는지 확인
    const classDays = new Map<string, Map<string, number[]>>();

    for (const entry of this.entries) {
      const key = `${entry.classId}-${entry.day}`;
      if (!classDays.has(key)) {
        classDays.set(key, new Map());
      }
      const periods = classDays.get(key)!;
      if (!periods.has(entry.period.toString())) {
        periods.set(entry.period.toString(), []);
      }
      periods.get(entry.period.toString())!.push(entry.period);
    }

    for (const [key, periods] of classDays) {
      const morningPeriods = Array.from(periods.keys())
        .map(p => parseInt(p))
        .filter(p => p <= lunchPeriod);

      if (morningPeriods.length > 3) {
        const [classId, day] = key.split('-');
        violations.push({
          type: ConstraintType.MEDIUM,
          message: `${classId}의 ${day}요일 점심 전에 수업이 너무 몰려있음 (${morningPeriods.length}개 교시)`,
          details: { classId, day, morningPeriods: morningPeriods.length }
        });
      }
    }

    return violations;
  }

  calculateScore(): number {
    let score = 0;

    for (const softConstraint of softConstraints) {
      const value = softConstraint.evaluate(this.entries, this.subjects, this.teachers, this.classes);
      score += value * softConstraint.weight;
    }

    return score;
  }

  getViolationsByType(type: ConstraintType): ConstraintViolation[] {
    const allViolations = this.validateAll();
    return allViolations.filter(v => v.type === type);
  }

  hasCriticalViolations(): boolean {
    const violations = this.validateAll();
    return violations.some(v => v.type === ConstraintType.CRITICAL);
  }
}

