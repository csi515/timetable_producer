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
  
  if (maxHours === 0) {
    return { 
      allowed: false, 
      reason: 'class_hours_zero',
      message: `${teacher.name} 교사는 ${className}에서 수업할 수 없도록 설정되어 있습니다.`,
      current: 0,
      max: 0
    };
  }
  
  const currentHours = getCurrentTeacherHours(schedule, teacher.name, className);
  
  if (currentHours >= maxHours) {
    return { 
      allowed: false, 
      reason: 'class_hours_exceeded',
      message: `${teacher.name} 교사 ${className} 학급 시수 제한 초과: 현재 ${currentHours}시간, 제한 ${maxHours}시간`,
      current: currentHours,
      max: maxHours
    };
  }
  
  return { allowed: true };
};

// 학급별 주간 수업시수 제한 확인 (엄격한 검증)
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
      message: `${className}은 수업이 비활성화되어 있습니다.`,
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
        // 더 정확한 시수 계산: 실제 수업이 배치된 슬롯만 카운트
        if (slot && typeof slot === 'object' && 'subject' in slot && slot.subject) {
          currentHours++;
        } else if (typeof slot === 'string' && slot.trim() !== '') {
          // 구버전 호환성: 문자열 형태의 수업도 카운트
          currentHours++;
        }
      });
    }
  });
  
  if (currentHours >= maxWeeklyHours) {
    return { 
      allowed: false, 
      reason: 'weekly_hours_exceeded',
      message: `${className} 주간 수업 시수 제한 초과: 현재 ${currentHours}시간, 제한 ${maxWeeklyHours}시간`,
      current: currentHours,
      max: maxWeeklyHours
    };
  }
  
  return { allowed: true, current: currentHours, max: maxWeeklyHours };
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

// 슬롯 배치 전 최종 중복 검증 (엄격한 검증)
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
  
  // 2. 교사 중복 배치 확인 (같은 교시에 다른 학급에서 수업하는지) - 엄격한 검증
  for (const otherClassName of Object.keys(schedule)) {
    if (otherClassName !== className && schedule[otherClassName] && schedule[otherClassName][day]) {
      const otherSlot = schedule[otherClassName][day][slotIndex];
      if (otherSlot && typeof otherSlot === 'object' && 'teachers' in otherSlot && otherSlot.teachers.includes(teacher.name)) {
        addLog(`❌ 슬롯 검증 실패: ${teacher.name} 교사가 ${day}요일 ${period}교시에 ${otherClassName}에서 이미 수업 중입니다.`, 'error');
        return false;
      }
    }
  }
  
  // 3. 교사 불가능 시간 확인 - 엄격한 검증
  const unavailableCheck = checkTeacherUnavailable(teacher, day, period);
  if (!unavailableCheck.allowed) {
    addLog(`❌ 슬롯 검증 실패: ${unavailableCheck.message}`, 'error');
    return false;
  }
  
  // 4. 교사 학급별 시수 제한 확인 - 엄격한 검증 (교과과목만 적용)
  const classHoursCheck = checkTeacherClassHoursLimit(teacher, className, schedule, subject, data);
  if (!classHoursCheck.allowed) {
    addLog(`❌ 슬롯 검증 실패: ${classHoursCheck.message}`, 'error');
    return false;
  }
  
  // 5. 학급별 주간 수업 시수 제한 확인 - 엄격한 검증
  const weeklyHoursCheck = checkClassWeeklyHoursLimit(className, schedule, data);
  if (!weeklyHoursCheck.allowed) {
    addLog(`❌ 슬롯 검증 실패: ${weeklyHoursCheck.message}`, 'error');
    return false;
  }
  
  // 6. 학급 같은 날짜 같은 과목 중복 확인 (일일 과목 1회 제한)
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
                    const includedCoTeachers = slot.teachers.filter((t: string) => coTeachers.includes(t));
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

// 블록제 수업 제약조건 확인 (강화된 검증 - 같은 반 2시간 연속 보장)
export const checkBlockPeriodRequirement = (
  schedule: Schedule,
  className: string,
  day: string,
  period: number,
  teacherName: string,
  data: TimetableData,
  subjectName?: string // 특정 과목명을 받을 수 있도록 추가
): ValidationResult => {
  // 블록제 교사인지 확인 (제약조건에서 해당 교사가 블록제로 설정되어 있는지 확인)
  const blockPeriodConstraints = data.constraints?.must?.filter(c => c.type === 'block_period_requirement') || [];
  const isBlockPeriodTeacher = blockPeriodConstraints.some(c => c.subject === teacherName);
  
  if (!isBlockPeriodTeacher) {
    return { allowed: true }; // 해당 교사가 블록제 교사가 아님
  }

  // 블록제 교사인 경우, 같은 반에서 연속된 두 교시가 필요

  // 블록제 수업인 경우, 같은 반에서 연속된 두 교시가 필요
  const slotIndex = period - 1;
  const nextSlotIndex = period; // 다음 교시
  
  // 현재 교시가 홀수 교시인지 확인 (1, 3, 5, 7교시)
  const isOddPeriod = period % 2 === 1;
  
  if (!isOddPeriod) {
    return {
      allowed: false,
      reason: 'block_period_even',
      message: `${teacherName} 교사의 블록제 수업이므로 홀수 교시(1, 3, 5, 7교시)에만 배치할 수 있습니다.`
    };
  }

  // 다음 교시가 존재하는지 확인
  const maxPeriods = data.base?.periods_per_day?.[day] || 7;
  if (nextSlotIndex >= maxPeriods) {
    return {
      allowed: false,
      reason: 'block_period_no_next',
      message: `${teacherName} 교사의 블록제 수업이므로 마지막 교시에는 배치할 수 없습니다.`
    };
  }

  // 현재 교시와 다음 교시가 모두 비어있는지 확인 (같은 반에서만)
  const currentSlot = schedule[className]?.[day]?.[slotIndex];
  const nextSlot = schedule[className]?.[day]?.[nextSlotIndex];
  
  if (currentSlot && typeof currentSlot === 'object' && currentSlot.subject) {
    return {
      allowed: false,
      reason: 'block_period_current_occupied',
      message: `${teacherName} 교사의 블록제 수업을 위해 ${className}의 현재 교시(${period}교시)가 비어있어야 합니다.`
    };
  }
  
  if (nextSlot && typeof nextSlot === 'object' && nextSlot.subject) {
    return {
      allowed: false,
      reason: 'block_period_next_occupied',
      message: `${teacherName} 교사의 블록제 수업이므로 ${className}의 다음 교시(${period + 1}교시)가 비어있어야 합니다.`
    };
  }

  // 교사가 다음 교시에 다른 학급에서 수업하는지 확인 (같은 반에서만 배치 보장)
  const teacherConflictNext = checkTeacherTimeConflict(schedule, teacherName, day, period + 1, className);
  if (!teacherConflictNext.allowed) {
    return {
      allowed: false,
      reason: 'block_period_teacher_conflict',
      message: `${teacherName} 교사가 다음 교시(${period + 1}교시)에 다른 학급에서 수업 중이므로 ${className}에서 블록제 수업을 배치할 수 없습니다.`
    };
  }

  return { allowed: true };
};

// 블록제 수업 배치 시 다음 교시도 자동 배치 (강화된 검증)
export const placeBlockPeriodSubject = (
  schedule: Schedule,
  className: string,
  day: string,
  period: number,
  teacherName: string,
  teacher: Teacher,
  data: TimetableData,
  subjectName?: string // 특정 과목명을 받을 수 있도록 추가
): boolean => {
  const slotIndex = period - 1;
  const nextSlotIndex = period; // 다음 교시

  // 블록제 교사인지 확인 (제약조건에서 해당 교사가 블록제로 설정되어 있는지 확인)
  const blockPeriodConstraints = data.constraints?.must?.filter(c => c.type === 'block_period_requirement') || [];
  const isBlockPeriodTeacher = blockPeriodConstraints.some(c => c.subject === teacherName);
  
  if (!isBlockPeriodTeacher) {
    return false; // 해당 교사가 블록제 교사가 아님
  }

  // 교사가 해당 과목을 가르칠 수 있는지 확인
  if (!teacher.subjects.includes(subjectName)) {
    return false;
  }

  // 현재 교시와 다음 교시가 모두 비어있는지 엄격히 확인
  const currentSlot = schedule[className]?.[day]?.[slotIndex];
  const nextSlot = schedule[className]?.[day]?.[nextSlotIndex];
  
  if (currentSlot && typeof currentSlot === 'object' && currentSlot.subject) {
    return false; // 현재 교시가 이미 사용 중
  }
  
  if (nextSlot && typeof nextSlot === 'object' && nextSlot.subject) {
    return false; // 다음 교시가 이미 사용 중
  }

  // 교사 시간 중복 확인 (다음 교시)
  const teacherConflictNext = checkTeacherTimeConflict(schedule, teacherName, day, period + 1, className);
  if (!teacherConflictNext.allowed) {
    return false; // 교사가 다음 교시에 다른 학급에서 수업 중
  }

  // 현재 교시 배치
  schedule[className][day][slotIndex] = {
    subject: subjectName,
    teachers: [teacher.name],
    isCoTeaching: false,
    isFixed: false,
    isBlockPeriod: true,
    blockPartner: nextSlotIndex
  };

  // 다음 교시도 자동 배치
  schedule[className][day][nextSlotIndex] = {
    subject: subjectName,
    teachers: [teacher.name],
    isCoTeaching: false,
    isFixed: false,
    isBlockPeriod: true,
    blockPartner: slotIndex
  };

  return true;
};

// 블록제 수업 제약조건 전체 검증 (같은 반 2시간 연속 보장)
export const validateBlockPeriodConstraints = (
  schedule: Schedule,
  data: TimetableData,
  addLog: (message: string, type?: string) => void
): boolean => {
  let allValid = true;
  
  // 블록제 교사들 찾기 (제약조건에서 블록제로 설정된 교사들)
  const blockPeriodConstraints = data.constraints?.must?.filter(c => c.type === 'block_period_requirement') || [];
  const blockPeriodTeachers = blockPeriodConstraints.map(c => c.subject);
  
  if (blockPeriodTeachers.length === 0) {
    return true; // 블록제 교사가 없음
  }

  addLog(`🔍 블록제 교사 ${blockPeriodTeachers.length}명 검증: ${blockPeriodTeachers.join(', ')}`, 'info');

  // 각 블록제 교사에 대해 검증
  blockPeriodTeachers.forEach(teacherName => {
    let teacherFound = false;
    let blockViolations = 0;

    Object.keys(schedule).forEach(className => {
      DAYS.forEach(day => {
        const maxPeriods = data.base?.periods_per_day?.[day] || 7;
        
        for (let period = 1; period < maxPeriods; period++) {
          const slotIndex = period - 1;
          const slot = schedule[className]?.[day]?.[slotIndex];
          
          if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.includes(teacherName)) {
            teacherFound = true;
            
            // 블록제 수업인지 확인
            if (slot.isBlockPeriod) {
              // 다음 교시도 같은 반, 같은 교사인지 확인
              const nextSlotIndex = period;
              const nextSlot = schedule[className]?.[day]?.[nextSlotIndex];
              
              if (!nextSlot || typeof nextSlot !== 'object' || 
                  !nextSlot.teachers || !nextSlot.teachers.includes(teacherName)) {
                blockViolations++;
                addLog(`❌ 블록제 수업 위반: ${className} ${day} ${period}교시 ${teacherName} 교사의 다음 교시가 같은 반에서 연결되지 않았습니다.`, 'error');
                allValid = false;
              } else {
                // 다음 교시도 블록제 수업으로 표시되어 있는지 확인
                if (!nextSlot.isBlockPeriod) {
                  blockViolations++;
                  addLog(`❌ 블록제 수업 위반: ${className} ${day} ${period + 1}교시 ${teacherName} 교사 수업이 블록제로 표시되지 않았습니다.`, 'error');
                  allValid = false;
                }
                
                // blockPartner 정보 확인 (같은 반 내에서만)
                if (slot.blockPartner !== nextSlotIndex || nextSlot.blockPartner !== slotIndex) {
                  blockViolations++;
                  addLog(`❌ 블록제 수업 위반: ${className} ${day} ${period}-${period + 1}교시 ${teacherName} 교사의 블록 파트너 정보가 올바르지 않습니다.`, 'error');
                  allValid = false;
                }
                
                // 홀수 교시에만 배치되었는지 확인
                if (period % 2 === 0) {
                  blockViolations++;
                  addLog(`❌ 블록제 수업 위반: ${className} ${day} ${period}교시 ${teacherName} 교사 수업이 홀수 교시에 배치되지 않았습니다.`, 'error');
                  allValid = false;
                }
              }
            } else {
              // 블록제 교사인데 블록제로 배치되지 않음
              blockViolations++;
              addLog(`❌ 블록제 수업 위반: ${className} ${day} ${period}교시 ${teacherName} 교사 수업이 블록제로 배치되지 않았습니다.`, 'error');
              allValid = false;
            }
          }
        }
      });
    });

    if (!teacherFound) {
      addLog(`⚠️ 블록제 교사 ${teacherName}이 스케줄에 배치되지 않았습니다.`, 'warning');
    } else if (blockViolations === 0) {
      addLog(`✅ 블록제 교사 ${teacherName} 제약조건 검증 통과 (같은 반 2시간 연속)`, 'success');
    }
  });

  return allValid;
};