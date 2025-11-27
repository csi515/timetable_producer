import { Schedule, Teacher, ValidationResult, TimetableData } from '../../types';
import { convertClassNameToKey, getCurrentTeacherHours } from '../../utils/helpers';

// 교사 시간 충돌 검사 (절대 불가능)
export const checkTeacherTimeConflict = (
  schedule: Schedule,
  teacherName: string,
  day: string,
  period: number,
  excludeClassName?: string
): ValidationResult => {
  const slotIndex = period - 1;
  
  // 모든 학급을 검사하여 해당 교사가 같은 시간에 수업하는지 확인
  for (const className of Object.keys(schedule)) {
    // 현재 배치하려는 학급은 제외
    if (excludeClassName && className === excludeClassName) continue;
    
    if (schedule[className] && schedule[className][day] && schedule[className][day][slotIndex]) {
      const slot = schedule[className][day][slotIndex];
      
      // 슬롯이 객체이고 teachers 배열이 있는 경우
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
      // 구버전 호환성: 문자열인 경우도 확인
      else if (typeof slot === 'string' && slot.includes(teacherName)) {
        return {
          allowed: false,
          reason: 'teacher_time_conflict',
          message: `${teacherName} 교사가 ${day}요일 ${period}교시에 ${className}에서 이미 수업 중입니다. (구버전)`,
          conflictClass: className
        };
      }
    }
  }
  
  return { allowed: true };
};

// 교사별 수업 불가 시간 확인 (엄격한 검증)
export const checkTeacherUnavailable = (
  teacher: Teacher, 
  day: string, 
  period: number
): ValidationResult => {
  if (teacher.unavailable && Array.isArray(teacher.unavailable)) {
    const isUnavailable = teacher.unavailable.some(([unavailableDay, unavailablePeriod]) => 
      unavailableDay === day && unavailablePeriod === period
    );
    
    if (isUnavailable) {
      return { 
        allowed: false, 
        reason: 'teacher_unavailable',
        message: `${teacher.name} 교사는 ${day}요일 ${period}교시에 수업할 수 없습니다.`,
        day: day,
        period: period
      };
    }
  }
  
  return { allowed: true };
};

// 교사의 학급별 시수 제한 확인 (엄격한 검증) - 교과과목만 적용
export const checkTeacherClassHoursLimit = (
  teacher: Teacher, 
  className: string, 
  schedule: Schedule,
  subjectName?: string,
  data?: TimetableData
): ValidationResult => {
  // 창의적 체험활동인 경우 제한을 적용하지 않음
  if (subjectName && data) {
    const subject = data.subjects?.find(s => s.name === subjectName);
    if (subject && subject.category === '창의적 체험활동') {
      return { allowed: true, reason: 'creative_activity_exempt' };
    }
  }
  
  let maxHours: number | null = null;
  
  if (teacher.classWeeklyHours && teacher.classWeeklyHours[className] !== undefined) {
    maxHours = teacher.classWeeklyHours[className];
  } else if (teacher.weeklyHoursByGrade) {
    const classKey = convertClassNameToKey(className);
    maxHours = teacher.weeklyHoursByGrade[classKey];
  }
  
  if (maxHours === null || maxHours === undefined) {
    return { allowed: true, reason: 'no_limit' };
  }
  
  // 0시간 설정된 경우 완전히 차단
  if (maxHours === 0) {
    return { 
      allowed: false, 
      reason: 'class_hours_zero',
      message: `${teacher.name} 교사는 ${className}에서 수업할 수 없습니다. (0시간 설정)`,
      current: 0,
      max: 0
    };
  }
  
  const currentHours = getCurrentTeacherHours(schedule, teacher.name, className);
  
  if (currentHours >= maxHours) {
    return { 
      allowed: false, 
      reason: 'class_hours_exceeded',
      message: `${teacher.name} 교사의 ${className} 시수 제한 초과: ${currentHours}시간/${maxHours}시간`,
      current: currentHours,
      max: maxHours
    };
  }
  
  return { allowed: true, current: currentHours, max: maxHours };
};

// 교사 상호 배타 제약조건 확인
export const checkTeacherMutualExclusion = (
  schedule: Schedule,
  teacherName: string,
  day: string,
  period: number,
  data: TimetableData,
  excludeClassName?: string
): ValidationResult => {
  const teacher = data.teachers?.find(t => t.name === teacherName);
  if (!teacher || !teacher.mutual_exclusions || !Array.isArray(teacher.mutual_exclusions)) {
    return { allowed: true };
  }
  
  const slotIndex = period - 1;
  
  // 상호 배타 교사들이 같은 시간에 수업하는지 확인
  for (const excludedTeacherName of teacher.mutual_exclusions) {
    for (const className of Object.keys(schedule)) {
      if (excludeClassName && className === excludeClassName) continue;
      
      if (schedule[className] && schedule[className][day] && schedule[className][day][slotIndex]) {
        const slot = schedule[className][day][slotIndex];
        
        if (slot && typeof slot === 'object' && 'teachers' in slot && Array.isArray(slot.teachers)) {
          if (slot.teachers.includes(excludedTeacherName)) {
            return {
              allowed: false,
              reason: 'teacher_mutual_exclusion',
              message: `${teacherName} 교사와 ${excludedTeacherName} 교사는 같은 시간에 수업할 수 없습니다.`,
              conflictClass: className,
              conflictSubject: slot.subject
            };
          }
        }
      }
    }
  }
  
  return { allowed: true };
};

// 교사 상호 배타 제약조건 전체 검증
export const validateTeacherMutualExclusions = (
  schedule: Schedule,
  data: TimetableData,
  addLog: (message: string, type?: string) => void
): boolean => {
  let hasViolations = false;
  
  for (const className of Object.keys(schedule)) {
    for (const day of ['월', '화', '수', '목', '금']) {
      if (schedule[className] && schedule[className][day]) {
        schedule[className][day].forEach((slot, periodIndex) => {
          if (slot && typeof slot === 'object' && 'teachers' in slot && Array.isArray(slot.teachers)) {
            const period = periodIndex + 1;
            
            slot.teachers.forEach(teacherName => {
              const checkResult = checkTeacherMutualExclusion(schedule, teacherName, day, period, data, className);
              if (!checkResult.allowed) {
                addLog(`⚠️ ${checkResult.message}`, 'warning');
                hasViolations = true;
              }
            });
          }
        });
      }
    }
  }
  
  return !hasViolations;
};

// 교사 상호 배타 정보 가져오기
export const getTeacherMutualExclusionsInfo = (data: TimetableData): string[] => {
  const info: string[] = [];
  
  data.teachers?.forEach(teacher => {
    if (teacher.mutual_exclusions && teacher.mutual_exclusions.length > 0) {
      info.push(`${teacher.name} ↔ ${teacher.mutual_exclusions.join(', ')}`);
    }
  });
  
  return info;
}; 