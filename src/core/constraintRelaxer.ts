import { Subject } from '../types/subject';
import { Teacher } from '../types/teacher';
import { ConstraintViolation, ConstraintType } from '../types/constraints';
import { RelaxationSuggestion, RelaxationAction, RelaxationConfig, RelaxationResult } from '../types/relaxation';

export class ConstraintRelaxer {
  private subjects: Subject[];
  private teachers: Teacher[];
  private config: RelaxationConfig;

  constructor(
    subjects: Subject[],
    teachers: Teacher[],
    config: RelaxationConfig = {
      allowLowRelaxation: true,
      allowMediumRelaxation: true,
      allowHighRelaxation: false,
      allowCriticalRelaxation: false
    }
  ) {
    this.subjects = [...subjects];
    this.teachers = [...teachers];
    this.config = config;
  }

  generateSuggestions(violations: ConstraintViolation[]): RelaxationSuggestion[] {
    const suggestions: RelaxationSuggestion[] = [];
    const processedConstraints = new Set<string>();

    // 위반 유형별로 제안 생성
    for (const violation of violations) {
      if (processedConstraints.has(violation.type)) continue;

      const suggestion = this.createSuggestion(violation);
      if (suggestion) {
        suggestions.push(suggestion);
        processedConstraints.add(violation.type);
      }
    }

    // 우선순위별 정렬 (Low -> Medium -> High -> Critical)
    return suggestions.sort((a, b) => {
      const order = { low: 0, medium: 1, high: 2, critical: 3 };
      return order[a.level] - order[b.level];
    });
  }

  private createSuggestion(violation: ConstraintViolation): RelaxationSuggestion | null {
    switch (violation.type) {
      case ConstraintType.LOW:
        if (!this.config.allowLowRelaxation) return null;
        return {
          level: ConstraintType.LOW,
          message: '선호 패턴 미반영',
          suggestion: '선호 시간 패턴 제약을 완화할 수 있습니다.',
          affectedConstraints: ['선호 패턴 반영'],
          action: {
            type: 'remove_constraint',
            target: 'preference',
            details: { constraint: 'preference' }
          }
        };

      case ConstraintType.MEDIUM:
        if (!this.config.allowMediumRelaxation) return null;
        if (violation.message.includes('연속 3교시')) {
          return {
            level: ConstraintType.MEDIUM,
            message: '연속 3교시 이상 금지',
            suggestion: '연속 3교시 제한을 완화하거나 특정 교사에게만 적용할 수 있습니다.',
            affectedConstraints: ['연속 3교시 이상 금지'],
            action: {
              type: 'modify_teacher',
              target: violation.entryId || '',
              details: { allowConsecutive: true }
            }
          };
        }
        if (violation.message.includes('점심 전')) {
          return {
            level: ConstraintType.MEDIUM,
            message: '점심 전 몰빵 방지',
            suggestion: '점심 전 수업 몰림 제한을 완화할 수 있습니다.',
            affectedConstraints: ['점심 전 몰빵 방지'],
            action: {
              type: 'remove_constraint',
              target: 'lunch_concentration',
              details: { constraint: 'lunch_concentration' }
            }
          };
        }
        return null;

      case ConstraintType.HIGH:
        if (!this.config.allowHighRelaxation) return null;
        if (violation.message.includes('시수')) {
          return {
            level: ConstraintType.HIGH,
            message: '시수 미충족',
            suggestion: '과목의 주간 시수를 줄이거나 교사 배정을 조정할 수 있습니다.',
            affectedConstraints: ['시수 충족 검증'],
            action: {
              type: 'reduce_hours',
              target: violation.details?.subjectId || '',
              details: { reduceBy: 1 }
            }
          };
        }
        if (violation.message.includes('외부 강사')) {
          return {
            level: ConstraintType.HIGH,
            message: '외부 강사 하루 몰아넣기 실패',
            suggestion: '외부 강사의 하루 몰아넣기 요구사항을 완화할 수 있습니다.',
            affectedConstraints: ['외부 강사 하루 몰아넣기'],
            action: {
              type: 'modify_subject',
              target: violation.details?.subjectId || '',
              details: { preferConcentrated: false }
            }
          };
        }
        return null;

      case ConstraintType.CRITICAL:
        if (!this.config.allowCriticalRelaxation) return null;
        return {
          level: ConstraintType.CRITICAL,
          message: '치명적 제약조건 위반',
          suggestion: '제약조건이 너무 엄격합니다. 교사 배정이나 과목 설정을 조정해주세요.',
          affectedConstraints: ['교사 중복', '교사 불가능 시간', '특별실 충돌', '블록 수업 연속 시간'],
          action: undefined
        };

      default:
        return null;
    }
  }

  applyRelaxation(suggestion: RelaxationSuggestion): RelaxationResult {
    const relaxedConstraints: string[] = [];
    const modifiedSubjects: Subject[] = [];
    const modifiedTeachers: Teacher[] = [];

    if (!suggestion.action) {
      return {
        success: false,
        relaxedConstraints: [],
        suggestions: [suggestion],
        modifiedSubjects: [],
        modifiedTeachers: []
      };
    }

    const action = suggestion.action;

    switch (action.type) {
      case 'remove_constraint':
        relaxedConstraints.push(action.target);
        break;

      case 'modify_subject':
        const subject = this.subjects.find(s => s.id === action.target);
        if (subject) {
          const modified = { ...subject, ...action.details };
          modifiedSubjects.push(modified);
          const index = this.subjects.findIndex(s => s.id === subject.id);
          if (index >= 0) {
            this.subjects[index] = modified;
          }
        }
        break;

      case 'modify_teacher':
        const teacher = this.teachers.find(t => t.id === action.target);
        if (teacher) {
          const modified = { ...teacher, ...action.details };
          modifiedTeachers.push(modified);
          const index = this.teachers.findIndex(t => t.id === teacher.id);
          if (index >= 0) {
            this.teachers[index] = modified;
          }
        }
        break;

      case 'reduce_hours':
        const subjectToReduce = this.subjects.find(s => s.id === action.target);
        if (subjectToReduce && subjectToReduce.weeklyHours > 1) {
          const modified = {
            ...subjectToReduce,
            weeklyHours: subjectToReduce.weeklyHours - (action.details.reduceBy || 1)
          };
          modifiedSubjects.push(modified);
          const index = this.subjects.findIndex(s => s.id === subjectToReduce.id);
          if (index >= 0) {
            this.subjects[index] = modified;
          }
        }
        break;
    }

    return {
      success: true,
      relaxedConstraints,
      suggestions: [suggestion],
      modifiedSubjects,
      modifiedTeachers
    };
  }

  getRelaxedSubjects(): Subject[] {
    return this.subjects;
  }

  getRelaxedTeachers(): Teacher[] {
    return this.teachers;
  }
}

