import { Schedule, Teacher, ValidationResult, TimetableData } from '../types';
import { DAYS, convertClassNameToKey, getCurrentTeacherHours } from '../utils/helpers';

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

// 교사별 수업 불가 시간 확인
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
        day: day,
        period: period
      };
    }
  }
  
  return { allowed: true };
};

// 교사의 학급별 시수 제한 확인
export const checkTeacherClassHoursLimit = (
  teacher: Teacher, 
  className: string, 
  schedule: Schedule
): ValidationResult => {
  let maxHours: number | null = null;
  
  if (teacher.classWeeklyHours && teacher.classWeeklyHours[className]) {
    maxHours = teacher.classWeeklyHours[className];
  } else if (teacher.weeklyHoursByGrade) {
    const classKey = convertClassNameToKey(className);
    maxHours = teacher.weeklyHoursByGrade[classKey];
  }
  
  if (maxHours === null || maxHours === undefined) {
    return { allowed: true, reason: 'no_limit' };
  }
  
  if (maxHours === 0) {
    return { 
      allowed: false, 
      reason: 'class_hours_zero',
      current: 0,
      max: 0
    };
  }
  
  const currentHours = getCurrentTeacherHours(schedule, teacher.name, className);
  
  if (currentHours >= maxHours) {
    return { 
      allowed: false, 
      reason: 'class_hours_exceeded',
      current: currentHours,
      max: maxHours
    };
  }
  
  return { allowed: true };
};

// 학급별 주간 수업시수 제한 확인
export const checkClassWeeklyHoursLimit = (
  className: string, 
  schedule: Schedule, 
  data: TimetableData
): ValidationResult => {
  const maxWeeklyHours = data.classWeeklyHours && data.classWeeklyHours[className];
  
  if (maxWeeklyHours === 0) {
    return { 
      allowed: false, 
      reason: 'class_disabled',
      current: 0,
      max: 0
    };
  }
  
  // classWeeklyHours가 설정되지 않은 경우 제한 없음
  if (maxWeeklyHours === undefined || maxWeeklyHours === null) {
    return { allowed: true, reason: 'no_limit' };
  }
  
  let currentHours = 0;
  
  DAYS.forEach(day => {
    if (schedule[className] && schedule[className][day]) {
      Object.values(schedule[className][day]).forEach(slot => {
        if (slot && typeof slot === 'object' && 'subject' in slot) {
          currentHours++;
        }
      });
    }
  });
  
  if (currentHours >= maxWeeklyHours) {
    return { 
      allowed: false, 
      reason: 'weekly_hours_exceeded',
      current: currentHours,
      max: maxWeeklyHours
    };
  }
  
  return { allowed: true };
};

// 학급별 일일 교시 수 제한 확인
export const checkClassDailyHoursLimit = (
  className: string, 
  day: string, 
  schedule: Schedule, 
  data: TimetableData
): ValidationResult => {
  const periodsPerDay = data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };
  const maxPeriods = periodsPerDay[day] || 7;
  
  if (schedule[className] && schedule[className][day]) {
    let currentPeriods = 0;
    
    Object.values(schedule[className][day]).forEach(slot => {
      if (slot && typeof slot === 'object' && 'subject' in slot) {
        currentPeriods++;
      }
    });
    
    if (currentPeriods >= maxPeriods) {
      return { 
        allowed: false, 
        reason: 'daily_periods_exceeded',
        current: currentPeriods,
        max: maxPeriods
      };
    }
  }
  
  return { allowed: true };
};

// 슬롯 배치 전 최종 중복 검증 (같은 교시 중복 방지)
export const validateSlotPlacement = (
  schedule: Schedule,
  className: string,
  day: string,
  period: number,
  teacher: Teacher,
  subject: string,
  data: TimetableData,
  addLog: (message: string, type?: string) => void
): boolean => {
  const slotIndex = period - 1;
  
  // 1. 기본 슬롯 점유 확인
  if (!schedule[className] || !schedule[className][day]) {
    addLog(`❌ 슬롯 검증 실패: ${className} ${day}요일 스케줄이 존재하지 않습니다.`, 'error');
    return false;
  }
  
  const currentSlot = schedule[className][day][slotIndex];
  if (currentSlot !== '' && currentSlot !== undefined && currentSlot !== null) {
    addLog(`❌ 슬롯 검증 실패: ${className} ${day}요일 ${period}교시가 이미 점유되어 있습니다.`, 'error');
    return false;
  }
  
  // 2. 교사 중복 배치 확인 (같은 교시에 다른 학급에서 수업하는지)
  for (const otherClassName of Object.keys(schedule)) {
    if (otherClassName !== className && schedule[otherClassName] && schedule[otherClassName][day]) {
      const otherSlot = schedule[otherClassName][day][slotIndex];
      if (otherSlot && typeof otherSlot === 'object' && 'teachers' in otherSlot && otherSlot.teachers.includes(teacher.name)) {
        addLog(`❌ 슬롯 검증 실패: ${teacher.name} 교사가 ${day}요일 ${period}교시에 ${otherClassName}에서 이미 수업 중입니다.`, 'error');
        return false;
      }
    }
  }
  
  // 3. 학급 같은 날짜 같은 과목 중복 확인 (일일 과목 1회 제한)
  const dailySubjectOnceConstraints = [
    ...(data.constraints?.must || []).filter(c => c.type === 'class_daily_subject_once'),
    ...(data.constraints?.optional || []).filter(c => c.type === 'class_daily_subject_once')
  ];
  
  if (dailySubjectOnceConstraints.length > 0) {
    let subjectAlreadyScheduled = false;
    if (schedule[className][day]) {
      Object.values(schedule[className][day]).forEach(slot => {
        if (slot && typeof slot === 'object' && 'subject' in slot && slot.subject === subject) {
          subjectAlreadyScheduled = true;
        }
      });
    }
    
    if (subjectAlreadyScheduled) {
      const hasAllSubjectsConstraint = dailySubjectOnceConstraints.some(c => c.subject === 'all');
      if (hasAllSubjectsConstraint) {
        addLog(`❌ 슬롯 검증 실패: ${className} ${day}요일에 ${subject} 과목이 이미 배치되어 있습니다 (일일 과목 1회 제한).`, 'error');
        return false;
      }
    }
  }
  
  return true;
}; 

// 공동수업 제약조건 검증
export const validateCoTeachingConstraints = (
  schedule: Schedule,
  data: TimetableData,
  addLog: (message: string, type?: string) => void
): boolean => {
  const coTeachingConstraints = (data.constraints?.must || []).filter(c =>
    c.type === 'specific_teacher_co_teaching'
  );

  if (coTeachingConstraints.length === 0) {
    return true;
  }

  let allValid = true;

  coTeachingConstraints.forEach(constraint => {
    const { mainTeacher, coTeachers, subject } = constraint;
    
    if (!mainTeacher || !coTeachers || coTeachers.length === 0) {
      addLog(`❌ 공동수업 제약조건 검증 실패: 주교사 또는 부교사 정보가 없습니다.`, 'error');
      allValid = false;
      return;
    }

    // 주교사와 부교사들이 모두 존재하는지 확인
    const mainTeacherObj = data.teachers.find(t => t.name === mainTeacher);
    const coTeacherObjs = coTeachers.map(name => data.teachers.find(t => t.name === name)).filter(Boolean);

    if (!mainTeacherObj) {
      addLog(`❌ 공동수업 제약조건 검증 실패: 주교사 ${mainTeacher}가 존재하지 않습니다.`, 'error');
      allValid = false;
      return;
    }

    if (coTeacherObjs.length === 0) {
      addLog(`❌ 공동수업 제약조건 검증 실패: 부교사들이 존재하지 않습니다.`, 'error');
      allValid = false;
      return;
    }

    // 대상 과목 결정
    const targetSubjects = subject ? [subject] : (mainTeacherObj.subjects || []);
    
    // 대상 학급들 결정 (주교사가 담당하는 모든 학급)
    const allClassNames = Object.keys(schedule);
    const targetClassList = allClassNames.filter(className => {
      if (data.classWeeklyHours && data.classWeeklyHours[className] === 0) {
        return false;
      }
      const classKey = className.replace(/(\d+)학년\s+(\d+)반/, '$1학년-$2');
      const hasClassAssignment = (mainTeacherObj.classWeeklyHours && mainTeacherObj.classWeeklyHours[className] > 0) ||
                                (mainTeacherObj.weeklyHoursByGrade && mainTeacherObj.weeklyHoursByGrade[classKey] > 0);
      return hasClassAssignment;
    });

    // 각 대상 학급에서 공동수업이 제대로 배치되었는지 확인
    targetClassList.forEach(className => {
      if (data.classWeeklyHours && data.classWeeklyHours[className] === 0) {
        return;
      }

      targetSubjects.forEach(targetSubject => {
        if (!mainTeacherObj.subjects.includes(targetSubject)) {
          return;
        }

        // 해당 학급에서 주교사가 해당 과목을 가르치는 수업 찾기
        let coTeachingFound = false;
        const days = ['월', '화', '수', '목', '금'];
        
        days.forEach(day => {
          if (schedule[className] && schedule[className][day]) {
            Object.values(schedule[className][day]).forEach(slot => {
              if (slot && typeof slot === 'object' && 'subject' in slot && slot.subject === targetSubject) {
                if (slot.teachers && slot.teachers.includes(mainTeacher)) {
                  // 공동수업인지 확인
                  if (slot.isCoTeaching && slot.teachers.length > 1) {
                    // 부교사들이 제대로 포함되어 있는지 확인
                    const includedCoTeachers = slot.teachers.filter(t => coTeachers.includes(t));
                    if (includedCoTeachers.length > 0) {
                      coTeachingFound = true;
                      addLog(`✅ 공동수업 검증 성공: ${className} ${day} ${targetSubject} (${slot.teachers.join(', ')})`, 'success');
                    } else {
                      addLog(`❌ 공동수업 제약조건 위반: ${className} ${day} ${targetSubject}에 부교사가 포함되지 않았습니다.`, 'error');
                      allValid = false;
                    }
                  } else {
                    addLog(`❌ 공동수업 제약조건 위반: ${className} ${day} ${targetSubject}가 공동수업으로 배치되지 않았습니다.`, 'error');
                    allValid = false;
                  }
                }
              }
            });
          }
        });

        if (!coTeachingFound) {
          addLog(`❌ 공동수업 제약조건 위반: ${className}에서 ${mainTeacher}의 ${targetSubject} 공동수업이 배치되지 않았습니다.`, 'error');
          allValid = false;
        }
      });
    });
  });

  return allValid;
};

// 고정수업 전용 과목 제약조건 확인
export const checkSubjectFixedOnly = (
  subjectName: string,
  data: TimetableData
): boolean => {
  const fixedOnlyConstraints = (data.constraints?.must || []).filter(c =>
    c.type === 'subject_fixed_only'
  );

  for (const constraint of fixedOnlyConstraints) {
    if (constraint.subjects && constraint.subjects.includes(subjectName)) {
      return true; // 이 과목은 고정수업 전용
    }
  }

  return false; // 일반 배치 가능
};

// 전체 스케줄에서 교사 중복 배정 검증
export const validateScheduleTeacherConflicts = (
  schedule: Schedule,
  addLog: (message: string, type?: string) => void
): boolean => {
  let hasConflicts = false;
  const conflicts: string[] = [];
  
  // 모든 요일과 교시를 확인
  DAYS.forEach(day => {
    for (let period = 1; period <= 7; period++) {
      const teachersAtThisTime: { [teacherName: string]: string[] } = {};
      
      // 이 시간에 수업하는 모든 교사 수집
      Object.keys(schedule).forEach(className => {
        const slotIndex = period - 1;
        if (schedule[className] && schedule[className][day] && schedule[className][day][slotIndex]) {
          const slot = schedule[className][day][slotIndex];
          
          if (slot && typeof slot === 'object' && 'teachers' in slot && Array.isArray(slot.teachers)) {
            slot.teachers.forEach(teacherName => {
              if (!teachersAtThisTime[teacherName]) {
                teachersAtThisTime[teacherName] = [];
              }
              teachersAtThisTime[teacherName].push(`${className}(${slot.subject})`);
            });
          }
        }
      });
      
      // 중복 배정된 교사 찾기
      Object.entries(teachersAtThisTime).forEach(([teacherName, classes]) => {
        if (classes.length > 1) {
          hasConflicts = true;
          const conflictMessage = `🚨 ${teacherName} 교사가 ${day}요일 ${period}교시에 중복 배정됨: ${classes.join(', ')}`;
          conflicts.push(conflictMessage);
          addLog(conflictMessage, 'error');
        }
      });
    }
  });
  
  if (hasConflicts) {
    addLog(`❌ 총 ${conflicts.length}개의 교사 중복 배정이 발견되었습니다!`, 'error');
    return false;
  } else {
    addLog(`✅ 교사 중복 배정 검증 통과: 모든 교사가 올바르게 배정되었습니다.`, 'success');
    return true;
  }
}; 