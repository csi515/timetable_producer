import { Teacher, Schedule, TimetableData } from '../types';
import { convertClassNameToKey } from '../utils/helpers';
import { checkTeacherMutualExclusion, checkTeacherUnavailable, checkTeacherTimeConflict } from './constraints';

// 과목을 가르칠 수 있는 교사들 찾기 (강화된 3단계 전략)
export const findAvailableTeachersForSubject = (
  teachers: Teacher[],
  subjectName: string,
  className: string,
  schedule: Schedule,
  data: TimetableData
): Teacher[] => {
  // 1단계: 명시적으로 해당 학급을 담당하는 교사들 (최우선)
  const primaryTeachers = teachers.filter(teacher => {
    const teacherSubjects = teacher.subjects || [];
    if (!teacherSubjects.includes(subjectName)) {
      return false;
    }

    const classKey = convertClassNameToKey(className);
    const hasClassAssignment = (teacher.classWeeklyHours && teacher.classWeeklyHours[className] > 0) ||
                              (teacher.weeklyHoursByGrade && teacher.weeklyHoursByGrade[classKey] > 0);

    if (!hasClassAssignment) {
      return false;
    }

    // 교사가 해당 학급에서 이미 최대 시수에 도달했는지 확인
    const currentHours = getCurrentTeacherHours(schedule, teacher.name, className, data);
    const maxHours = teacher.classWeeklyHours?.[className] || 
                    teacher.weeklyHoursByGrade?.[classKey] || 
                    teacher.max_hours_per_week || 
                    22;
    
    if (currentHours >= maxHours) {
      return false;
    }

    return true;
  });

  if (primaryTeachers.length > 0) {
    // 우선순위 정렬: 시수가 적은 교사 우선
    return primaryTeachers.sort((a, b) => {
      const aHours = getCurrentTeacherHours(schedule, a.name, className, data);
      const bHours = getCurrentTeacherHours(schedule, b.name, className, data);
      return aHours - bHours;
    });
  }

  // 2단계: 해당 과목을 가르칠 수 있는 교사들 (0시간으로 설정되지 않은 경우만)
  const secondaryTeachers = teachers.filter(teacher => {
    const teacherSubjects = teacher.subjects || [];
    if (!teacherSubjects.includes(subjectName)) {
      return false;
    }

    // 0시간으로 설정된 학급은 절대 제외 (강화된 제약조건)
    const classKey = convertClassNameToKey(className);
    const hasZeroHours = (teacher.classWeeklyHours && teacher.classWeeklyHours[className] === 0) ||
                        (teacher.weeklyHoursByGrade && teacher.weeklyHoursByGrade[classKey] === 0);

    if (hasZeroHours) {
      return false; // 0시간으로 설정된 학급에는 절대 배정하지 않음
    }

    // 교사 전체 시수 제한 확인
    const currentTotalHours = getCurrentTeacherHours(schedule, teacher.name, undefined, data);
    const maxTotalHours = teacher.max_hours_per_week || teacher.maxHours || 22;
    
    if (currentTotalHours >= maxTotalHours) {
      return false;
    }

    return true;
  });

  if (secondaryTeachers.length > 0) {
    // 우선순위 정렬: 전체 시수가 적고, 불가능 시간이 적은 교사 우선
    return secondaryTeachers.sort((a, b) => {
      const aTotalHours = getCurrentTeacherHours(schedule, a.name, undefined, data);
      const bTotalHours = getCurrentTeacherHours(schedule, b.name, undefined, data);
      
      if (aTotalHours !== bTotalHours) {
        return aTotalHours - bTotalHours;
      }
      
      const aUnavailableCount = a.unavailable ? a.unavailable.length : 0;
      const bUnavailableCount = b.unavailable ? b.unavailable.length : 0;
      return aUnavailableCount - bUnavailableCount;
    });
  }

  // 3단계: 완전히 배치 불가능한 경우, 과목을 가르칠 수 있는 모든 교사 (응급 배치)
  // 단, 0시간으로 설정된 학급은 여전히 제외
  const emergencyTeachers = teachers.filter(teacher => {
    const teacherSubjects = teacher.subjects || [];
    if (!teacherSubjects.includes(subjectName)) {
      return false;
    }

    // 0시간으로 설정된 학급은 여전히 제외
    const classKey = convertClassNameToKey(className);
    const hasZeroHours = (teacher.classWeeklyHours && teacher.classWeeklyHours[className] === 0) ||
                        (teacher.weeklyHoursByGrade && teacher.weeklyHoursByGrade[classKey] === 0);

    if (hasZeroHours) {
      return false; // 0시간으로 설정된 학급에는 절대 배정하지 않음
    }

    return true;
  });
  
  if (emergencyTeachers.length > 0) {
    // 우선순위 정렬: 전체 시수가 적은 교사 우선
    return emergencyTeachers.sort((a, b) => {
      const aTotalHours = getCurrentTeacherHours(schedule, a.name, undefined, data);
      const bTotalHours = getCurrentTeacherHours(schedule, b.name, undefined, data);
      return aTotalHours - bTotalHours;
    });
  }

  return [];
};

// 교사 배정 검증 (강화된 버전)
export const validateTeacherAssignment = (
  teacher: Teacher,
  className: string,
  day: string,
  period: number,
  schedule: Schedule,
  data: TimetableData
): { allowed: boolean; reason?: string } => {
  // 1. 교사 불가능 시간 확인
  const unavailableCheck = checkTeacherUnavailable(teacher, day, period);
  if (!unavailableCheck.allowed) {
    return {
      allowed: false,
      reason: unavailableCheck.message || `교사 불가능 시간: ${teacher.name} ${day} ${period}교시`
    };
  }

  // 2. 교사 시간 중복 확인
  const conflictCheck = checkTeacherTimeConflict(schedule, teacher.name, day, period, className);
  if (!conflictCheck.allowed) {
    return {
      allowed: false,
      reason: conflictCheck.message || `교사 시간 중복: ${teacher.name} ${day} ${period}교시`
    };
  }

  // 3. 교사 상호 배제 확인
  const mutualExclusionCheck = checkTeacherMutualExclusion(schedule, teacher.name, day, period, data, className);
  if (!mutualExclusionCheck.allowed) {
    return {
      allowed: false,
      reason: mutualExclusionCheck.message || `교사 상호 배제: ${teacher.name} ${day} ${period}교시`
    };
  }

  // 4. 교사 주간시수 제한 확인 (강화된 검증)
  const classKey = convertClassNameToKey(className);
  const currentHours = getCurrentTeacherHours(schedule, teacher.name, className, data);
  const maxHours = teacher.classWeeklyHours?.[className] || 
                  teacher.weeklyHoursByGrade?.[classKey] || 
                  teacher.max_hours_per_week || 
                  teacher.maxHours || 
                  22;

  // 0시간으로 설정된 학급에는 절대 배정하지 않음
  const hasZeroHours = (teacher.classWeeklyHours && teacher.classWeeklyHours[className] === 0) ||
                      (teacher.weeklyHoursByGrade && teacher.weeklyHoursByGrade[classKey] === 0);

  if (hasZeroHours) {
    return {
      allowed: false,
      reason: `${teacher.name} 교사는 ${className}에서 0시간으로 설정되어 있어 배정할 수 없습니다.`
    };
  }

  if (currentHours >= maxHours) {
    return {
      allowed: false,
      reason: `${teacher.name} 교사가 ${className}에서 최대 시수(${maxHours}시간)에 도달했습니다. (현재: ${currentHours}시간)`
    };
  }

  // 5. 교사 전체 시수 제한 확인
  const currentTotalHours = getCurrentTeacherHours(schedule, teacher.name, undefined, data);
  const maxTotalHours = teacher.max_hours_per_week || teacher.maxHours || 22;
  
  if (currentTotalHours >= maxTotalHours) {
    return {
      allowed: false,
      reason: `${teacher.name} 교사가 전체 최대 시수(${maxTotalHours}시간)에 도달했습니다. (현재: ${currentTotalHours}시간)`
    };
  }

  return { allowed: true };
};

// 교사별 현재 수업 시수 계산 (강화된 버전)
const getCurrentTeacherHours = (
  schedule: Schedule, 
  teacherName: string, 
  className?: string, 
  data?: TimetableData
): number => {
  let hours = 0;
  
  Object.keys(schedule).forEach(classKey => {
    // 특정 학급만 계산하는 경우
    if (className && classKey !== className) {
      return;
    }
    
    if (schedule[classKey]) {
      Object.keys(schedule[classKey]).forEach(day => {
        if (schedule[classKey][day]) {
          Object.values(schedule[classKey][day]).forEach(slot => {
            // 슬롯이 객체이고 teachers 배열이 있는 경우
            if (slot && typeof slot === 'object' && 'teachers' in slot && Array.isArray(slot.teachers)) {
              if (slot.teachers.includes(teacherName)) {
                hours++;
              }
            }
            // 구버전 호환성: 문자열인 경우도 확인
            else if (typeof slot === 'string' && slot.includes(teacherName)) {
              hours++;
            }
          });
        }
      });
    }
  });
  
  return hours;
}; 