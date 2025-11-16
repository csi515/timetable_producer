import { Schedule, TimetableData, Teacher, ValidationResult } from '../../types';
import { DAYS, convertClassNameToKey, getCurrentTeacherHours } from '../../utils/helpers';
import { ConstraintViolation } from './types';

// 교사 시간 충돌 검사 (CRITICAL)
export const checkTeacherTimeConflict = (
  schedule: Schedule,
  teacherName: string,
  day: string,
  period: number,
  excludeClassName?: string
): ValidationResult => {
  const slotIndex = period - 1;
  
  for (const className of Object.keys(schedule)) {
    if (excludeClassName && className === excludeClassName) continue;
    
    if (schedule[className] && schedule[className][day] && schedule[className][day][slotIndex]) {
      const slot = schedule[className][day][slotIndex];
      
      if (slot && typeof slot === 'object' && 'teachers' in slot && Array.isArray(slot.teachers)) {
        if (slot.teachers.includes(teacherName)) {
          return {
            allowed: false,
            reason: 'teacher_time_conflict',
            message: `${teacherName} 교사가 ${day}요일 ${period}교시에 ${className}에서 이미 수업 중입니다.`,
            conflictClass: className,
            conflictSubject: slot.subject
          };
        }
      }
      else if (typeof slot === 'string' && slot.includes(teacherName)) {
        return {
          allowed: false,
          reason: 'teacher_time_conflict',
          message: `${teacherName} 교사가 ${day}요일 ${period}교시에 ${className}에서 이미 수업 중입니다.`,
          conflictClass: className
        };
      }
    }
  }
  
  return { allowed: true };
};

// 교사 불가능 시간 확인 (CRITICAL)
export const checkTeacherUnavailable = (
  teacher: Teacher,
  day: string,
  period: number
): ValidationResult => {
  if (teacher.unavailable && Array.isArray(teacher.unavailable)) {
    const isUnavailable = teacher.unavailable.some(
      ([unavailableDay, unavailablePeriod]) =>
        unavailableDay === day && unavailablePeriod === period
    );
    
    if (isUnavailable) {
      return {
        allowed: false,
        reason: 'teacher_unavailable',
        message: `${teacher.name} 교사는 ${day}요일 ${period}교시에 수업할 수 없습니다.`,
        day,
        period
      };
    }
  }
  
  return { allowed: true };
};

// 교사 상호 배제 확인 (CRITICAL)
export const checkTeacherMutualExclusions = (
  schedule: Schedule,
  teacher: Teacher,
  day: string,
  period: number,
  excludeClassName?: string
): ValidationResult => {
  if (!teacher.mutual_exclusions || teacher.mutual_exclusions.length === 0) {
    return { allowed: true };
  }
  
  const slotIndex = period - 1;
  
  for (const className of Object.keys(schedule)) {
    if (excludeClassName && className === excludeClassName) continue;
    
    if (schedule[className] && schedule[className][day] && schedule[className][day][slotIndex]) {
      const slot = schedule[className][day][slotIndex];
      
      if (slot && typeof slot === 'object' && 'teachers' in slot && Array.isArray(slot.teachers)) {
        const hasMutualExclusion = slot.teachers.some(excludedTeacher =>
          teacher.mutual_exclusions?.includes(excludedTeacher)
        );
        
        if (hasMutualExclusion) {
          return {
            allowed: false,
            reason: 'teacher_mutual_exclusion',
            message: `${teacher.name} 교사는 ${slot.teachers.find(t => teacher.mutual_exclusions?.includes(t))} 교사와 동시에 수업할 수 없습니다.`,
            conflictClass: className,
            conflictTeacher: slot.teachers.find(t => teacher.mutual_exclusions?.includes(t))
          };
        }
      }
    }
  }
  
  return { allowed: true };
};

// Critical 제약조건 검증
export const validateCriticalConstraints = (
  schedule: Schedule,
  data: TimetableData,
  addLog?: (message: string, type?: string) => void
): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];
  
  // 1. 교사 중복 배정 검증
  Object.keys(schedule).forEach(className => {
    DAYS.forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        schedule[className][day].forEach((slot, periodIndex) => {
          if (slot && typeof slot === 'object' && 'teachers' in slot && Array.isArray(slot.teachers)) {
            slot.teachers.forEach(teacherName => {
              const conflictCheck = checkTeacherTimeConflict(
                schedule,
                teacherName,
                day,
                periodIndex + 1,
                className
              );
              
              if (!conflictCheck.allowed) {
                violations.push({
                  type: 'critical',
                  category: 'teacher_duplicate',
                  message: conflictCheck.message || `교사 ${teacherName} 중복 배정`,
                  className,
                  teacher: teacherName,
                  day,
                  period: periodIndex + 1,
                  details: conflictCheck
                });
              }
            });
          }
        });
      }
    });
  });
  
  // 2. 교사 불가능 시간 위반 검증
  Object.keys(schedule).forEach(className => {
    DAYS.forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        schedule[className][day].forEach((slot, periodIndex) => {
          if (slot && typeof slot === 'object' && 'teachers' in slot && Array.isArray(slot.teachers)) {
            slot.teachers.forEach(teacherName => {
              const teacher = data.teachers.find(t => t.name === teacherName);
              if (teacher) {
                const unavailableCheck = checkTeacherUnavailable(
                  teacher,
                  day,
                  periodIndex + 1
                );
                
                if (!unavailableCheck.allowed) {
                  violations.push({
                    type: 'critical',
                    category: 'teacher_unavailable_time',
                    message: unavailableCheck.message || `교사 ${teacherName} 불가능 시간 위반`,
                    className,
                    teacher: teacherName,
                    day,
                    period: periodIndex + 1,
                    details: unavailableCheck
                  });
                }
              }
            });
          }
        });
      }
    });
  });
  
  // 3. 교사 상호 배제 관계 검증
  Object.keys(schedule).forEach(className => {
    DAYS.forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        schedule[className][day].forEach((slot, periodIndex) => {
          if (slot && typeof slot === 'object' && 'teachers' in slot && Array.isArray(slot.teachers)) {
            slot.teachers.forEach(teacherName => {
              const teacher = data.teachers.find(t => t.name === teacherName);
              if (teacher) {
                const mutualExclusionCheck = checkTeacherMutualExclusions(
                  schedule,
                  teacher,
                  day,
                  periodIndex + 1,
                  className
                );
                
                if (!mutualExclusionCheck.allowed) {
                  violations.push({
                    type: 'critical',
                    category: 'teacher_mutual_exclusion',
                    message: mutualExclusionCheck.message || `교사 ${teacherName} 상호 배제 위반`,
                    className,
                    teacher: teacherName,
                    day,
                    period: periodIndex + 1,
                    details: mutualExclusionCheck
                  });
                }
              }
            });
          }
        });
      }
    });
  });
  
  return violations;
};
