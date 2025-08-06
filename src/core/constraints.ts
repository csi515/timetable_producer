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

// 제약조건 우선순위 정의
export const CONSTRAINT_PRIORITY = {
  CRITICAL: 1,      // 절대 위반 불가 (교사 중복, 불가능 시간)
  HIGH: 2,          // 높은 우선순위 (시수 제한, 특별실)
  MEDIUM: 3,        // 중간 우선순위 (블록제, 공동수업)
  LOW: 4,           // 낮은 우선순위 (선호도, 순차 수업)
  OPTIONAL: 5       // 선택적 제약조건
};

// 강화된 슬롯 검증 함수
export const validateSlotPlacementStrict = (
  schedule: Schedule,
  className: string,
  day: string,
  period: number,
  teacher: Teacher,
  subject: string,
  data: TimetableData,
  addLog: (message: string, type?: string) => void,
  priorityLevel: number = CONSTRAINT_PRIORITY.CRITICAL
): { allowed: boolean; violations: string[]; priority: number } => {
  const violations: string[] = [];
  const slotIndex = period - 1;
  
  // 1. 기본 슬롯 점유 확인 (CRITICAL)
  if (!schedule[className] || !schedule[className][day]) {
    violations.push(`슬롯 검증 실패: ${className} ${day}요일 스케줄이 존재하지 않습니다.`);
    return { allowed: false, violations, priority: CONSTRAINT_PRIORITY.CRITICAL };
  }
  
  const currentSlot = schedule[className][day][slotIndex];
  if (currentSlot !== '' && currentSlot !== undefined && currentSlot !== null) {
    violations.push(`슬롯 검증 실패: ${className} ${day}요일 ${period}교시가 이미 점유되어 있습니다.`);
    return { allowed: false, violations, priority: CONSTRAINT_PRIORITY.CRITICAL };
  }
  
  // 2. 교사 중복 배치 확인 (CRITICAL) - 절대 위반 불가
  const teacherConflictCheck = checkTeacherTimeConflict(schedule, teacher.name, day, period, className);
  if (!teacherConflictCheck.allowed) {
    violations.push(teacherConflictCheck.message || `교사 중복 배정: ${teacher.name}`);
    return { allowed: false, violations, priority: CONSTRAINT_PRIORITY.CRITICAL };
  }
  
  // 3. 교사 불가능 시간 확인 (CRITICAL) - 절대 위반 불가
  const unavailableCheck = checkTeacherUnavailable(teacher, day, period);
  if (!unavailableCheck.allowed) {
    violations.push(unavailableCheck.message || `교사 불가능 시간: ${teacher.name} ${day} ${period}교시`);
    return { allowed: false, violations, priority: CONSTRAINT_PRIORITY.CRITICAL };
  }
  
  // 4. 교사 상호 배제 확인 (CRITICAL) - 절대 위반 불가
  if (priorityLevel <= CONSTRAINT_PRIORITY.CRITICAL) {
    const mutualExclusionCheck = checkTeacherMutualExclusion(schedule, teacher.name, day, period, data, className);
    if (!mutualExclusionCheck.allowed) {
      violations.push(mutualExclusionCheck.message || `교사 상호 배제 위반: ${teacher.name}`);
      return { allowed: false, violations, priority: CONSTRAINT_PRIORITY.CRITICAL };
    }
  }
  
  // 5. 교사 3연속 수업 확인 (HIGH) - 교사 부담 고려
  if (priorityLevel <= CONSTRAINT_PRIORITY.HIGH) {
    const consecutiveCheck = checkTeacherConsecutiveTeaching(schedule, teacher.name, day, period, className);
    if (!consecutiveCheck.allowed) {
      violations.push(consecutiveCheck.message || `교사 3연속 수업 위반: ${teacher.name}`);
      return { allowed: false, violations, priority: CONSTRAINT_PRIORITY.HIGH };
    }
  }
  
  // 6. 교사 학급별 시수 제한 확인 (HIGH)
  if (priorityLevel <= CONSTRAINT_PRIORITY.HIGH) {
    const classHoursCheck = checkTeacherClassHoursLimit(teacher, className, schedule, subject, data);
    if (!classHoursCheck.allowed) {
      violations.push(classHoursCheck.message || `교사 학급별 시수 제한: ${teacher.name} ${className}`);
      return { allowed: false, violations, priority: CONSTRAINT_PRIORITY.HIGH };
    }
  }
  
  // 7. 학급별 주간 시수 제한 확인 (HIGH)
  if (priorityLevel <= CONSTRAINT_PRIORITY.HIGH) {
    const weeklyHoursCheck = checkClassWeeklyHoursLimit(className, schedule, data);
    if (!weeklyHoursCheck.allowed) {
      violations.push(weeklyHoursCheck.message || `학급별 주간 시수 제한: ${className}`);
      return { allowed: false, violations, priority: CONSTRAINT_PRIORITY.HIGH };
    }
  }
  
  // 8. 학급별 일일 시수 제한 확인 (HIGH)
  if (priorityLevel <= CONSTRAINT_PRIORITY.HIGH) {
    const dailyHoursCheck = checkClassDailyHoursLimit(className, day, schedule, data);
    if (!dailyHoursCheck.allowed) {
      violations.push(dailyHoursCheck.message || `학급별 일일 시수 제한: ${className} ${day}요일`);
      return { allowed: false, violations, priority: CONSTRAINT_PRIORITY.HIGH };
    }
  }
  
  // 9. 블록제 수업 요구사항 확인 (MEDIUM)
  if (priorityLevel <= CONSTRAINT_PRIORITY.MEDIUM) {
    const blockPeriodCheck = checkBlockPeriodRequirement(schedule, className, day, period, teacher.name, data, subject);
    if (!blockPeriodCheck.allowed) {
      violations.push(blockPeriodCheck.message || `블록제 수업 요구사항: ${teacher.name}`);
      return { allowed: false, violations, priority: CONSTRAINT_PRIORITY.MEDIUM };
    }
  }
  
  // 10. 학년별 순차 수업 확인 (MEDIUM)
  if (priorityLevel <= CONSTRAINT_PRIORITY.MEDIUM) {
    const sequentialCheck = checkSequentialGradeTeaching(schedule, teacher.name, day, period, className, data);
    if (!sequentialCheck.allowed) {
      violations.push(sequentialCheck.message || `학년별 순차 수업 위반: ${teacher.name}`);
      return { allowed: false, violations, priority: CONSTRAINT_PRIORITY.MEDIUM };
    }
  }
  
  // 11. 과목별 고정 수업 확인 (LOW)
  if (priorityLevel <= CONSTRAINT_PRIORITY.LOW) {
    const fixedOnlyCheck = checkSubjectFixedOnly(subject, data);
    if (fixedOnlyCheck) {
      violations.push(`과목 고정 수업 위반: ${subject}는 고정 수업으로만 배치 가능합니다.`);
      return { allowed: false, violations, priority: CONSTRAINT_PRIORITY.LOW };
    }
  }
  
  return { allowed: true, violations: [], priority: 0 };
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

// 강화된 슬롯 검증 함수
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
  
  // 2. 교사 중복 배치 확인 (절대 위반 불가)
  const teacherConflictCheck = checkTeacherTimeConflict(schedule, teacher.name, day, period, className);
  if (!teacherConflictCheck.allowed) {
    addLog(`❌ 교사 중복 배정: ${teacherConflictCheck.message}`, 'error');
    return false;
  }
  
  // 3. 교사 불가능 시간 확인 (절대 위반 불가)
  const unavailableCheck = checkTeacherUnavailable(teacher, day, period);
  if (!unavailableCheck.allowed) {
    addLog(`❌ 교사 불가능 시간: ${unavailableCheck.message}`, 'error');
    return false;
  }
  
  // 4. 교사 상호 배제 확인 (절대 위반 불가)
  const mutualExclusionCheck = checkTeacherMutualExclusion(schedule, teacher.name, day, period, data, className);
  if (!mutualExclusionCheck.allowed) {
    addLog(`❌ 교사 상호 배제 위반: ${mutualExclusionCheck.message}`, 'error');
    return false;
  }
  
  // 5. 블록제 요구사항 확인 (강화된 검증)
  const blockCheck = checkBlockPeriodRequirement(schedule, className, day, period, teacher.name, data, subject);
  if (!blockCheck.allowed) {
    addLog(`❌ 블록제 요구사항 위반: ${blockCheck.message}`, 'error');
    return false;
  }
  
  // 6. 교사 주간시수 제한 확인 (강화된 검증)
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
    addLog(`❌ 교사 배정 불가: ${teacher.name} 교사는 ${className}에서 0시간으로 설정되어 있어 배정할 수 없습니다.`, 'error');
    return false;
  }

  if (currentHours >= maxHours) {
    addLog(`❌ 교사 시수 제한 초과: ${teacher.name} 교사가 ${className}에서 최대 시수(${maxHours}시간)에 도달했습니다. (현재: ${currentHours}시간)`, 'error');
    return false;
  }
  
  // 7. 교사 전체 시수 제한 확인
  const currentTotalHours = getCurrentTeacherHours(schedule, teacher.name, undefined, data);
  const maxTotalHours = teacher.max_hours_per_week || teacher.maxHours || 22;
  
  if (currentTotalHours >= maxTotalHours) {
    addLog(`❌ 교사 전체 시수 제한 초과: ${teacher.name} 교사가 전체 최대 시수(${maxTotalHours}시간)에 도달했습니다. (현재: ${currentTotalHours}시간)`, 'error');
    return false;
  }
  
  // 8. 과목별 제약조건 확인
  const subjectData = data.subjects?.find(s => s.name === subject);
  if (subjectData) {
    // 과목이 특정 시간에만 배치 가능한지 확인
    if (subjectData.is_space_limited) {
      // 특별실이 필요한 과목의 경우 추가 검증 로직
      addLog(`ℹ️ 특별실 과목 배정: ${subject}`, 'info');
    }
    
    // 과목의 최대 동시 수업 수 확인
    if (subjectData.max_classes_at_once) {
      const currentSubjectCount = Object.keys(schedule).reduce((count, className) => {
        if (schedule[className] && schedule[className][day] && schedule[className][day][slotIndex]) {
          const slot = schedule[className][day][slotIndex];
          if (slot && typeof slot === 'object' && slot.subject === subject) {
            return count + 1;
          }
        }
        return count;
      }, 0);
      
      if (currentSubjectCount >= subjectData.max_classes_at_once) {
        addLog(`❌ 과목 동시 수업 수 제한: ${subject}는 최대 ${subjectData.max_classes_at_once}개 학급에서만 동시에 수업할 수 있습니다.`, 'error');
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
  // 1. 과목의 block 속성 확인 (최우선)
  let isBlockSubject = false;
  if (subjectName) {
    const subject = data.subjects?.find(s => s.name === subjectName);
    isBlockSubject = subject?.block === true;
  }
  
  // 2. 교사의 블록제 설정 확인 (제약조건에서)
  const blockPeriodConstraints = data.constraints?.must?.filter(c => c.type === 'block_period_requirement') || [];
  const isBlockPeriodTeacher = blockPeriodConstraints.some(c => c.subject === teacherName);
  
  // 블록제가 아닌 경우 통과
  if (!isBlockSubject && !isBlockPeriodTeacher) {
    return { allowed: true };
  }

  // 블록제 수업인 경우, 같은 반에서 연속된 두 교시가 필요
  const slotIndex = period - 1;
  const nextSlotIndex = period; // 다음 교시
  
  // 현재 교시가 홀수 교시인지 확인 (1, 3, 5, 7교시)
  const isOddPeriod = period % 2 === 1;
  
  if (!isOddPeriod) {
    return {
      allowed: false,
      reason: 'block_period_even',
      message: `${subjectName || teacherName}의 블록제 수업이므로 홀수 교시(1, 3, 5, 7교시)에만 배치할 수 있습니다.`
    };
  }

  // 다음 교시가 존재하는지 확인
  const maxPeriods = data.base?.periods_per_day?.[day] || 7;
  if (nextSlotIndex >= maxPeriods) {
    return {
      allowed: false,
      reason: 'block_period_no_next',
      message: `${subjectName || teacherName}의 블록제 수업이므로 마지막 교시에는 배치할 수 없습니다.`
    };
  }

  // 현재 교시와 다음 교시가 모두 비어있는지 확인 (같은 반에서만)
  const currentSlot = schedule[className]?.[day]?.[slotIndex];
  const nextSlot = schedule[className]?.[day]?.[nextSlotIndex];
  
  if (currentSlot && typeof currentSlot === 'object' && currentSlot.subject) {
    return {
      allowed: false,
      reason: 'block_period_current_occupied',
      message: `${subjectName || teacherName}의 블록제 수업을 위해 ${className}의 현재 교시(${period}교시)가 비어있어야 합니다.`
    };
  }
  
  if (nextSlot && typeof nextSlot === 'object' && nextSlot.subject) {
    return {
      allowed: false,
      reason: 'block_period_next_occupied',
      message: `${subjectName || teacherName}의 블록제 수업이므로 ${className}의 다음 교시(${period + 1}교시)가 비어있어야 합니다.`
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

  // 1. 과목의 block 속성 확인 (최우선)
  let isBlockSubject = false;
  if (subjectName) {
    const subject = data.subjects?.find(s => s.name === subjectName);
    isBlockSubject = subject?.block === true;
  }
  
  // 2. 교사의 블록제 설정 확인 (제약조건에서)
  const blockPeriodConstraints = data.constraints?.must?.filter(c => c.type === 'block_period_requirement') || [];
  const isBlockPeriodTeacher = blockPeriodConstraints.some(c => c.subject === teacherName);
  
  // 블록제가 아닌 경우 일반 배치
  if (!isBlockSubject && !isBlockPeriodTeacher) {
    return false;
  }

  // 교사가 해당 과목을 가르칠 수 있는지 확인 (subjectName이 제공된 경우에만)
  if (subjectName && !teacher.subjects.includes(subjectName)) {
    return false;
  }

  // 블록제 검증
  const blockValidation = checkBlockPeriodRequirement(schedule, className, day, period, teacherName, data, subjectName);
  if (!blockValidation.allowed) {
    return false;
  }

  // 현재 교시 배치
  schedule[className][day][slotIndex] = {
    subject: subjectName || teacher.subjects[0],
    teachers: [teacherName],
    isCoTeaching: false,
    isFixed: false,
    isBlockPeriod: true,
  };

  // 다음 교시도 자동 배치 (블록제)
  schedule[className][day][nextSlotIndex] = {
    subject: subjectName || teacher.subjects[0],
    teachers: [teacherName],
    isCoTeaching: false,
    isFixed: false,
    isBlockPeriod: true,
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
  const blockPeriodTeachers = blockPeriodConstraints.map(c => c.subject).filter((name): name is string => name !== undefined);
  
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

// 교사 간 동시 수업 제약조건 검사
export const checkTeacherMutualExclusion = (
  schedule: Schedule,
  teacherName: string,
  day: string,
  period: number,
  data: TimetableData,
  excludeClassName?: string
): ValidationResult => {
  const teacher = data.teachers.find(t => t.name === teacherName);
  if (!teacher || !teacher.mutual_exclusions || teacher.mutual_exclusions.length === 0) {
    return { allowed: true };
  }

  const slotIndex = period - 1;
  
  // 모든 학급을 검사하여 상호 배제 교사들이 같은 시간에 수업하는지 확인
  for (const className of Object.keys(schedule)) {
    // 현재 배치하려는 학급은 제외
    if (excludeClassName && className === excludeClassName) continue;
    
    if (schedule[className] && schedule[className][day] && schedule[className][day][slotIndex]) {
      const slot = schedule[className][day][slotIndex];
      
      // 슬롯이 객체이고 teachers 배열이 있는 경우
      if (slot && typeof slot === 'object' && 'teachers' in slot && Array.isArray(slot.teachers)) {
        // 상호 배제 교사 중 하나라도 같은 시간에 수업하는지 확인
        for (const slotTeacher of slot.teachers) {
          if (teacher.mutual_exclusions.includes(slotTeacher)) {
            return {
              allowed: false,
              reason: 'teacher_mutual_exclusion',
              message: `${teacherName} 교사와 ${slotTeacher} 교사는 동시에 수업할 수 없습니다. ${day}요일 ${period}교시에 ${slotTeacher} 교사가 ${className}에서 수업 중입니다.`,
              conflictClass: className,
              conflictSubject: slot.subject,
              conflictTeacher: slotTeacher
            };
          }
        }
      }
      // 구버전 호환성: 문자열인 경우도 확인
      else if (typeof slot === 'string') {
        for (const excludedTeacher of teacher.mutual_exclusions) {
          if (slot.includes(excludedTeacher)) {
            return {
              allowed: false,
              reason: 'teacher_mutual_exclusion',
              message: `${teacherName} 교사와 ${excludedTeacher} 교사는 동시에 수업할 수 없습니다. ${day}요일 ${period}교시에 ${excludedTeacher} 교사가 ${className}에서 수업 중입니다. (구버전)`,
              conflictClass: className,
              conflictTeacher: excludedTeacher
            };
          }
        }
      }
    }
  }
  
  return { allowed: true };
};

// 교사 간 동시 수업 제약조건 전체 검증
export const validateTeacherMutualExclusions = (
  schedule: Schedule,
  data: TimetableData,
  addLog: (message: string, type?: string) => void
): boolean => {
  let allValid = true;
  const violations: string[] = [];

  // 상호 배제 제약조건이 있는 교사들 찾기
  const teachersWithExclusions = data.teachers.filter(t => t.mutual_exclusions && t.mutual_exclusions.length > 0);
  
  if (teachersWithExclusions.length === 0) {
    return true; // 상호 배제 제약조건이 없음
  }

  addLog(`🔍 교사 간 동시 수업 제약조건 검증: ${teachersWithExclusions.length}명의 교사`, 'info');

  // 각 교사에 대해 검증
  teachersWithExclusions.forEach(teacher => {
    Object.keys(schedule).forEach(className => {
      DAYS.forEach(day => {
        const maxPeriods = data.base?.periods_per_day?.[day] || 7;
        
        for (let period = 1; period <= maxPeriods; period++) {
          const slotIndex = period - 1;
          const slot = schedule[className]?.[day]?.[slotIndex];
          
          if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.includes(teacher.name)) {
            // 이 교사가 수업하는 시간에 상호 배제 교사들이 다른 학급에서 수업하는지 확인
            for (const otherClassName of Object.keys(schedule)) {
              if (otherClassName === className) continue; // 같은 학급은 제외
              
              const otherSlot = schedule[otherClassName]?.[day]?.[slotIndex];
              if (otherSlot && typeof otherSlot === 'object' && otherSlot.teachers) {
                for (const otherTeacher of otherSlot.teachers) {
                  if (teacher.mutual_exclusions && teacher.mutual_exclusions.includes(otherTeacher)) {
                    const violation = `${teacher.name} 교사와 ${otherTeacher} 교사가 ${day}요일 ${period}교시에 동시 수업 중 (${className}, ${otherClassName})`;
                    violations.push(violation);
                    addLog(`❌ ${violation}`, 'error');
                    allValid = false;
                  }
                }
              }
            }
          }
        }
      });
    });
  });

  if (allValid) {
    addLog(`✅ 교사 간 동시 수업 제약조건 검증 통과`, 'success');
  } else {
    addLog(`❌ 교사 간 동시 수업 제약조건 위반 ${violations.length}건 발견`, 'error');
  }

  return allValid;
};

// 교사 간 동시 수업 제약조건 정보 반환
export const getTeacherMutualExclusionsInfo = (data: TimetableData): string[] => {
  const info: string[] = [];
  
  data.teachers.forEach(teacher => {
    if (teacher.mutual_exclusions && teacher.mutual_exclusions.length > 0) {
      info.push(`${teacher.name} 교사 ↔ ${teacher.mutual_exclusions.join(', ')} 교사`);
    }
  });
  
  return info;
};

// 학년별 순차 수업 배정 제약조건 검사
export const checkSequentialGradeTeaching = (
  schedule: Schedule,
  teacherName: string,
  day: string,
  period: number,
  className: string,
  data: TimetableData
): ValidationResult => {
  const teacher = data.teachers.find(t => t.name === teacherName);
  if (!teacher || !teacher.sequential_grade_teaching) {
    return { allowed: true };
  }

  // 현재 배치하려는 학급의 학년 추출
  const currentGrade = extractGradeFromClassName(className);
  if (!currentGrade) {
    return { allowed: true }; // 학년을 추출할 수 없는 경우 제약조건 적용 안함
  }

  const maxPeriods = data.base?.periods_per_day?.[day] || 7;
  
  // 해당 날짜의 모든 교시에서 이 교사의 수업을 찾아 학년별로 그룹화
  const gradeGroups: Record<number, number[]> = {};
  
  for (let p = 1; p <= maxPeriods; p++) {
    const slotIndex = p - 1;
    
    // 현재 배치하려는 슬롯은 제외하고 검사
    if (p === period) continue;
    
    // 모든 학급에서 이 교사의 수업 확인
    for (const otherClassName of Object.keys(schedule)) {
      if (otherClassName === className) continue; // 현재 학급은 제외
      
      const slot = schedule[otherClassName]?.[day]?.[slotIndex];
      if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.includes(teacherName)) {
        const otherGrade = extractGradeFromClassName(otherClassName);
        if (otherGrade) {
          if (!gradeGroups[otherGrade]) {
            gradeGroups[otherGrade] = [];
          }
          gradeGroups[otherGrade].push(p);
        }
      }
    }
  }

  // 현재 교시를 현재 학년 그룹에 추가
  if (!gradeGroups[currentGrade]) {
    gradeGroups[currentGrade] = [];
  }
  gradeGroups[currentGrade].push(period);

  // 학년별로 연속성 검사
  const violations = checkGradeSequentialViolations(gradeGroups, period, currentGrade);
  
  if (violations.length > 0) {
    return {
      allowed: false,
      reason: 'sequential_grade_violation',
      message: `${teacherName} 교사의 학년별 순차 수업 배정 위반: ${violations.join(', ')}`,
      day: day,
      period: period,
      conflictClass: className
    };
  }

  return { allowed: true };
};

// 학년별 순차 수업 배정 제약조건 전체 검증
export const validateSequentialGradeTeaching = (
  schedule: Schedule,
  data: TimetableData,
  addLog: (message: string, type?: string) => void
): boolean => {
  let allValid = true;
  const violations: string[] = [];

  // 학년별 순차 수업 배정 제약조건이 있는 교사들 찾기
  const teachersWithSequential = data.teachers.filter(t => t.sequential_grade_teaching);
  
  if (teachersWithSequential.length === 0) {
    return true; // 제약조건이 없음
  }

  addLog(`🔍 학년별 순차 수업 배정 제약조건 검증: ${teachersWithSequential.length}명의 교사`, 'info');

  // 각 교사에 대해 검증
  teachersWithSequential.forEach(teacher => {
    DAYS.forEach(day => {
      const maxPeriods = data.base?.periods_per_day?.[day] || 7;
      
      // 해당 날짜의 모든 교시에서 이 교사의 수업을 찾아 학년별로 그룹화
      const gradeGroups: Record<number, number[]> = {};
      
      for (let period = 1; period <= maxPeriods; period++) {
        const slotIndex = period - 1;
        
        // 모든 학급에서 이 교사의 수업 확인
        Object.keys(schedule).forEach(className => {
          const slot = schedule[className]?.[day]?.[slotIndex];
          if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.includes(teacher.name)) {
            const grade = extractGradeFromClassName(className);
            if (grade) {
              if (!gradeGroups[grade]) {
                gradeGroups[grade] = [];
              }
              gradeGroups[grade].push(period);
            }
          }
        });
      }

      // 학년별로 연속성 검사
      const dayViolations = checkGradeSequentialViolations(gradeGroups);
      
      if (dayViolations.length > 0) {
        const violation = `${teacher.name} 교사 ${day}요일: ${dayViolations.join(', ')}`;
        violations.push(violation);
        addLog(`❌ ${violation}`, 'error');
        allValid = false;
      }
    });
  });

  if (allValid) {
    addLog(`✅ 학년별 순차 수업 배정 제약조건 검증 통과`, 'success');
  } else {
    addLog(`❌ 학년별 순차 수업 배정 제약조건 위반 ${violations.length}건 발견`, 'error');
  }

  return allValid;
};

// 학년별 순차 수업 배정 제약조건 정보 반환
export const getSequentialGradeTeachingInfo = (data: TimetableData): string[] => {
  const info: string[] = [];
  
  data.teachers.forEach(teacher => {
    if (teacher.sequential_grade_teaching) {
      info.push(`${teacher.name} 교사: 학년별 순차 수업 배정 적용`);
    }
  });
  
  return info;
};

// 교사 3연속 수업 제약조건 확인
export const checkTeacherConsecutiveTeaching = (
  schedule: Schedule,
  teacherName: string,
  day: string,
  period: number,
  excludeClassName?: string
): ValidationResult => {
  const slotIndex = period - 1;
  
  // 해당 교사가 같은 요일에 연속으로 수업하는지 확인
  let consecutiveCount = 0;
  
  // 현재 교시 이전의 연속 수업 확인
  for (let i = slotIndex - 1; i >= 0; i--) {
    let hasTeaching = false;
    
    for (const className of Object.keys(schedule)) {
      if (excludeClassName && className === excludeClassName) continue;
      
      const slot = schedule[className]?.[day]?.[i];
      if (slot && typeof slot === 'object' && 'teachers' in slot && Array.isArray(slot.teachers)) {
        if (slot.teachers.includes(teacherName)) {
          hasTeaching = true;
          break;
        }
      } else if (typeof slot === 'string' && slot.includes(teacherName)) {
        hasTeaching = true;
        break;
      }
    }
    
    if (hasTeaching) {
      consecutiveCount++;
    } else {
      break;
    }
  }
  
  // 현재 교시 이후의 연속 수업 확인
  const maxPeriods = 7; // 기본값
  for (let i = slotIndex + 1; i < maxPeriods; i++) {
    let hasTeaching = false;
    
    for (const className of Object.keys(schedule)) {
      if (excludeClassName && className === excludeClassName) continue;
      
      const slot = schedule[className]?.[day]?.[i];
      if (slot && typeof slot === 'object' && 'teachers' in slot && Array.isArray(slot.teachers)) {
        if (slot.teachers.includes(teacherName)) {
          hasTeaching = true;
          break;
        }
      } else if (typeof slot === 'string' && slot.includes(teacherName)) {
        hasTeaching = true;
        break;
      }
    }
    
    if (hasTeaching) {
      consecutiveCount++;
    } else {
      break;
    }
  }
  
  // 현재 교시 포함하여 3연속 이상인지 확인
  if (consecutiveCount >= 2) { // 현재 교시 포함 3연속
    return {
      allowed: false,
      reason: 'teacher_consecutive_teaching',
      message: `${teacherName} 교사가 ${day}요일에 3연속 수업하게 됩니다. (${consecutiveCount + 1}연속)`,
      consecutiveCount: consecutiveCount + 1
    };
  }
  
  return { allowed: true };
};

// 교사 3연속 수업 제약조건 전체 검증
export const validateTeacherConsecutiveTeaching = (
  schedule: Schedule,
  data: TimetableData,
  addLog: (message: string, type?: string) => void
): boolean => {
  let allValid = true;
  const violations: string[] = [];

  addLog(`🔍 교사 3연속 수업 제약조건 검증: ${data.teachers?.length || 0}명의 교사`, 'info');

  data.teachers?.forEach(teacher => {
    Object.keys(schedule).forEach(className => {
      DAYS.forEach(day => {
        const maxPeriods = data.base?.periods_per_day?.[day] || 7;
        
        for (let period = 1; period <= maxPeriods; period++) {
          const slotIndex = period - 1;
          const slot = schedule[className]?.[day]?.[slotIndex];
          
          if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.includes(teacher.name)) {
            // 이 교사가 수업하는 시간에 연속 수업 확인
            let consecutiveCount = 0;
            
            // 이전 교시들 확인
            for (let i = slotIndex - 1; i >= 0; i--) {
              let hasTeaching = false;
              
              for (const otherClassName of Object.keys(schedule)) {
                const otherSlot = schedule[otherClassName]?.[day]?.[i];
                if (otherSlot && typeof otherSlot === 'object' && otherSlot.teachers) {
                  if (otherSlot.teachers.includes(teacher.name)) {
                    hasTeaching = true;
                    break;
                  }
                } else if (typeof otherSlot === 'string' && otherSlot.includes(teacher.name)) {
                  hasTeaching = true;
                  break;
                }
              }
              
              if (hasTeaching) {
                consecutiveCount++;
              } else {
                break;
              }
            }
            
            // 이후 교시들 확인
            for (let i = slotIndex + 1; i < maxPeriods; i++) {
              let hasTeaching = false;
              
              for (const otherClassName of Object.keys(schedule)) {
                const otherSlot = schedule[otherClassName]?.[day]?.[i];
                if (otherSlot && typeof otherSlot === 'object' && otherSlot.teachers) {
                  if (otherSlot.teachers.includes(teacher.name)) {
                    hasTeaching = true;
                    break;
                  }
                } else if (typeof otherSlot === 'string' && otherSlot.includes(teacher.name)) {
                  hasTeaching = true;
                  break;
                }
              }
              
              if (hasTeaching) {
                consecutiveCount++;
              } else {
                break;
              }
            }
            
            // 3연속 이상인지 확인
            if (consecutiveCount >= 2) { // 현재 교시 포함 3연속
              const violation = `${teacher.name} 교사가 ${day}요일 ${period}교시에 3연속 수업 중 (${consecutiveCount + 1}연속)`;
              violations.push(violation);
              addLog(`❌ ${violation}`, 'error');
              allValid = false;
            }
          }
        }
      });
    });
  });

  if (allValid) {
    addLog(`✅ 교사 3연속 수업 제약조건 검증 통과`, 'success');
  } else {
    addLog(`❌ 교사 3연속 수업 제약조건 위반 ${violations.length}건 발견`, 'error');
  }

  return allValid;
};

// 헬퍼 함수: 학급명에서 학년 추출
const extractGradeFromClassName = (className: string): number | null => {
  // 학급명 형식: "1학년 1반", "2학년 3반", "3-1", "1-2" 등
  const gradeMatch = className.match(/(\d+)학년|^(\d+)-/);
  if (gradeMatch) {
    return parseInt(gradeMatch[1] || gradeMatch[2]);
  }
  return null;
};

// 헬퍼 함수: 학년별 연속성 위반 검사
const checkGradeSequentialViolations = (
  gradeGroups: Record<number, number[]>, 
  currentPeriod?: number, 
  currentGrade?: number
): string[] => {
  const violations: string[] = [];
  
  // 각 학년의 교시들을 정렬
  const sortedGrades = Object.keys(gradeGroups).map(Number).sort((a, b) => a - b);
  
  // 학년별로 연속성 검사
  for (let i = 0; i < sortedGrades.length; i++) {
    const grade = sortedGrades[i];
    const periods = gradeGroups[grade].sort((a, b) => a - b);
    
    // 현재 배치하려는 교시가 있는 경우, 해당 교시를 제외하고 검사
    let periodsToCheck = periods;
    if (currentPeriod && currentGrade === grade) {
      periodsToCheck = periods.filter(p => p !== currentPeriod);
    }
    
    // 연속되지 않은 교시가 있는지 확인
    for (let j = 0; j < periodsToCheck.length - 1; j++) {
      if (periodsToCheck[j + 1] - periodsToCheck[j] > 1) {
        // 연속되지 않은 경우, 그 사이에 다른 학년 수업이 있는지 확인
        const gapStart = periodsToCheck[j] + 1;
        const gapEnd = periodsToCheck[j + 1] - 1;
        
        for (let gap = gapStart; gap <= gapEnd; gap++) {
          // 그 사이 교시에 다른 학년 수업이 있는지 확인
          for (const otherGrade of sortedGrades) {
            if (otherGrade !== grade && gradeGroups[otherGrade].includes(gap)) {
              violations.push(`${grade}학년 수업 중간에 ${otherGrade}학년 수업이 끼어있음 (${gap}교시)`);
            }
          }
        }
      }
    }
  }
  
  return violations;
};