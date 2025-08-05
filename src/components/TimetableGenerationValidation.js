import { 
  getCurrentTeacherHours, 
  checkTeacherClassHoursLimit, 
  checkTeacherUnavailable,
  validateSlotPlacement,
  isClassDisabled,
  canPlaceClassInSchedule
} from './TimetableGenerationHelpers';

// 교사 제약 조건 검증
export const validateTeacherConstraints = (schedule, data, days, addLog) => {
  const violations = [];
  
  Object.keys(schedule).forEach(className => {
    if (isClassDisabled(className, data)) {
      return; // 0시간 설정 학급은 검증에서 제외
    }
    
    days.forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        schedule[className][day].forEach((slot, periodIndex) => {
          if (slot && typeof slot === 'object' && slot.teachers) {
            slot.teachers.forEach(teacherName => {
              const teacher = data.teachers?.find(t => t.name === teacherName);
              if (!teacher) {
                violations.push(`알 수 없는 교사: ${teacherName}`);
                return;
              }
              
              // 1. 교사 시수 제한 검증
              const currentHours = getCurrentTeacherHours(schedule, teacherName, null, days);
              const maxHours = teacher.max_hours_per_week || teacher.maxHours || 22;
              
              if (currentHours > maxHours) {
                violations.push(`${teacherName} 교사 시수 초과: ${currentHours}/${maxHours}시간`);
              }
              
              // 2. 교사 학급별 시수 제한 검증
              const classHoursCheck = checkTeacherClassHoursLimit(teacher, className, schedule, days);
              if (!classHoursCheck.allowed) {
                violations.push(`${teacherName} 교사의 ${className} 시수 제한 위반: ${classHoursCheck.current}/${classHoursCheck.max}시간`);
              }
              
              // 3. 교사 불가능 시간 검증
              const period = periodIndex + 1;
              const unavailableCheck = checkTeacherUnavailable(teacher, day, period);
              if (!unavailableCheck.allowed) {
                violations.push(`${teacherName} 교사 불가능 시간 위반: ${day}요일 ${period}교시`);
              }
            });
          }
        });
      }
    });
  });
  
  if (violations.length > 0) {
    addLog(`교사 제약 조건 위반 ${violations.length}건 발견:`, 'warning');
    violations.forEach(violation => addLog(`  - ${violation}`, 'warning'));
  }
  
  return violations.length === 0;
};

// 학급 시수 제약 조건 검증
export const validateClassHoursConstraints = (schedule, data, days, addLog) => {
  const violations = [];
  
  Object.keys(schedule).forEach(className => {
    if (isClassDisabled(className, data)) {
      return; // 0시간 설정 학급은 검증에서 제외
    }
    
    // 1. 학급 주간 시수 제한 검증
    const classHoursCheck = checkClassWeeklyHoursLimit(className, schedule, data, days);
    if (!classHoursCheck.allowed) {
      violations.push(`${className} 주간 시수 제한 위반: ${classHoursCheck.current}/${classHoursCheck.max}시간`);
    }
    
    // 2. 학급 일일 시수 제한 검증
    days.forEach(day => {
      const dailyHoursCheck = checkClassDailyHoursLimit(className, day, schedule, data);
      if (!dailyHoursCheck.allowed) {
        violations.push(`${className} ${day}요일 일일 시수 제한 위반: ${dailyHoursCheck.current}/${dailyHoursCheck.max}시간`);
      }
    });
  });
  
  if (violations.length > 0) {
    addLog(`학급 시수 제약 조건 위반 ${violations.length}건 발견:`, 'warning');
    violations.forEach(violation => addLog(`  - ${violation}`, 'warning'));
  }
  
  return violations.length === 0;
};

// 학급 주간 시수 제한 확인
export const checkClassWeeklyHoursLimit = (className, schedule, data, days) => {
  if (!data.classWeeklyHours || !data.classWeeklyHours[className]) {
    return { allowed: true, reason: 'no_limit' };
  }
  
  const maxHours = data.classWeeklyHours[className];
  let currentHours = 0;
  
  days.forEach(day => {
    if (schedule[className] && schedule[className][day]) {
      schedule[className][day].forEach(slot => {
        if (slot && typeof slot === 'object' && slot.subject) {
          currentHours++;
        }
      });
    }
  });
  
  if (currentHours > maxHours) {
    return { 
      allowed: false, 
      reason: 'weekly_hours_exceeded',
      current: currentHours,
      max: maxHours
    };
  }
  
  return { allowed: true, current: currentHours, max: maxHours };
};

// 학급 일일 시수 제한 확인
export const checkClassDailyHoursLimit = (className, day, schedule, data) => {
  // 기본적으로 일일 시수 제한은 없음 (필요시 추가)
  const maxHours = 7; // 기본값
  let currentHours = 0;
  
  if (schedule[className] && schedule[className][day]) {
    schedule[className][day].forEach(slot => {
      if (slot && typeof slot === 'object' && slot.subject) {
        currentHours++;
      }
    });
  }
  
  if (currentHours > maxHours) {
    return { 
      allowed: false, 
      reason: 'daily_hours_exceeded',
      current: currentHours,
      max: maxHours
    };
  }
  
  return { allowed: true, current: currentHours, max: maxHours };
};

// 교사 시간 충돌 검증
export const validateTeacherTimeConflicts = (schedule, data, days, addLog) => {
  const violations = [];
  const teacherSchedules = {};
  
  // 교사별 스케줄 수집
  Object.keys(schedule).forEach(className => {
    days.forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        schedule[className][day].forEach((slot, periodIndex) => {
          if (slot && typeof slot === 'object' && slot.teachers) {
            const period = periodIndex + 1;
            slot.teachers.forEach(teacherName => {
              if (!teacherSchedules[teacherName]) {
                teacherSchedules[teacherName] = {};
              }
              if (!teacherSchedules[teacherName][day]) {
                teacherSchedules[teacherName][day] = [];
              }
              
              // 이미 해당 시간에 수업이 있는지 확인
              if (teacherSchedules[teacherName][day].includes(period)) {
                violations.push(`${teacherName} 교사 시간 충돌: ${day}요일 ${period}교시`);
              } else {
                teacherSchedules[teacherName][day].push(period);
              }
            });
          }
        });
      }
    });
  });
  
  if (violations.length > 0) {
    addLog(`교사 시간 충돌 ${violations.length}건 발견:`, 'warning');
    violations.forEach(violation => addLog(`  - ${violation}`, 'warning'));
  }
  
  return violations.length === 0;
};

// 교사 불가능 시간 검증
export const validateTeacherUnavailableTimes = (schedule, data, days, addLog) => {
  const violations = [];
  
  Object.keys(schedule).forEach(className => {
    days.forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        schedule[className][day].forEach((slot, periodIndex) => {
          if (slot && typeof slot === 'object' && slot.teachers) {
            const period = periodIndex + 1;
            slot.teachers.forEach(teacherName => {
              const teacher = data.teachers?.find(t => t.name === teacherName);
              if (teacher) {
                const unavailableCheck = checkTeacherUnavailable(teacher, day, period);
                if (!unavailableCheck.allowed) {
                  violations.push(`${teacherName} 교사 불가능 시간 위반: ${day}요일 ${period}교시`);
                }
              }
            });
          }
        });
      }
    });
  });
  
  if (violations.length > 0) {
    addLog(`교사 불가능 시간 위반 ${violations.length}건 발견:`, 'warning');
    violations.forEach(violation => addLog(`  - ${violation}`, 'warning'));
  }
  
  return violations.length === 0;
}; 