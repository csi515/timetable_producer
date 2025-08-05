// 헬퍼 함수: 현재 과목 시수 계산
export const getCurrentSubjectHours = (schedule, className, subjectName, days) => {
  let hours = 0;
  if (!schedule[className]) return hours;
  
  days.forEach(day => {
    if (schedule[className][day]) {
      schedule[className][day].forEach(slot => {
        if (slot && typeof slot === 'object' && slot.subject === subjectName) {
          hours++;
        }
      });
    }
  });
  return hours;
};

// 헬퍼 함수: 교사별 현재 시수 계산
export const getCurrentTeacherHours = (schedule, teacherName, specificClassName = null, days) => {
  let hours = 0;
  
  Object.keys(schedule).forEach(className => {
    // 특정 학급만 계산하는 경우
    if (specificClassName && className !== specificClassName) {
      return;
    }
    
    days.forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        schedule[className][day].forEach(slot => {
          if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.includes(teacherName)) {
            hours++;
          }
        });
      }
    });
  });
  return hours;
};

// 헬퍼 함수: 학급별 과목 시수 계산
export const getClassSubjectHours = (schedule, className, days) => {
  const subjectHours = {};
  
  if (schedule[className]) {
    days.forEach(day => {
      if (schedule[className][day]) {
        schedule[className][day].forEach(slot => {
          if (slot && typeof slot === 'object' && slot.subject) {
            subjectHours[slot.subject] = (subjectHours[slot.subject] || 0) + 1;
          }
        });
      }
    });
  }
  
  return subjectHours;
};

// 헬퍼 함수: 학급 이름을 키 형태로 변환 (예: "3학년 1반" -> "3학년-1")
export const convertClassNameToKey = (className) => {
  const match = className.match(/(\d+)학년\s+(\d+)반/);
  if (match) {
    return `${match[1]}학년-${match[2]}`;
  }
  return className;
};

// 헬퍼 함수: 교사의 학급별 시수 제한 확인
export const checkTeacherClassHoursLimit = (teacher, className, schedule, days) => {
  // classWeeklyHours와 weeklyHoursByGrade 두 형태 모두 지원
  let maxHours = null;
  
  if (teacher.classWeeklyHours && teacher.classWeeklyHours[className]) {
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
      current: 0,
      max: 0
    };
  }
  
  const currentHours = getCurrentTeacherHours(schedule, teacher.name, className, days);
  
  if (currentHours >= maxHours) {
    return { 
      allowed: false, 
      reason: 'class_hours_exceeded',
      current: currentHours,
      max: maxHours
    };
  }
  
  return { allowed: true, current: currentHours, max: maxHours };
};

// 헬퍼 함수: 교사의 수업 불가 시간 확인
export const checkTeacherUnavailable = (teacher, day, period) => {
  if (!teacher.unavailable || !Array.isArray(teacher.unavailable)) {
    return { allowed: true, reason: 'no_unavailable_times' };
  }
  
  const isUnavailable = teacher.unavailable.some(slot => {
    if (Array.isArray(slot) && slot.length >= 2) {
      return slot[0] === day && slot[1] === period;
    } else if (typeof slot === 'object' && slot.day && slot.period) {
      return slot.day === day && slot.period === period;
    }
    return false;
  });
  
  if (isUnavailable) {
    return { 
      allowed: false, 
      reason: 'teacher_unavailable',
      day: day,
      period: period
    };
  }
  
  return { allowed: true };
};

// 헬퍼 함수: 0시간 설정 학급 강제 확인 (추가 안전장치)
export const isClassDisabled = (className, data) => {
  if (data.classWeeklyHours && data.classWeeklyHours[className] === 0) {
    return true;
  }
  return false;
};

// 헬퍼 함수: 수업 배치 전 최종 안전 확인
export const canPlaceClassInSchedule = (className, data, addLog = () => {}) => {
  if (isClassDisabled(className, data)) {
    addLog(`🚫 배치 차단: ${className}은 0시간 설정 학급입니다.`, 'error');
    return false;
  }
  return true;
};

// 헬퍼 함수: 슬롯 배치 전 최종 중복 검증 (같은 교시 중복 방지)
export const validateSlotPlacement = (schedule, className, day, period, teacher, subject, data, addLog = () => {}) => {
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
      if (otherSlot && typeof otherSlot === 'object' && otherSlot.teachers && otherSlot.teachers.includes(teacher.name)) {
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
    // 해당 학급에서 같은 날짜에 같은 과목이 이미 배치되어 있는지 확인
    const daySchedule = schedule[className][day];
    const hasSameSubjectToday = daySchedule.some(slot => 
      slot && typeof slot === 'object' && slot.subject === subject
    );
    
    if (hasSameSubjectToday) {
      addLog(`❌ 슬롯 검증 실패: ${className}에서 ${day}요일에 ${subject} 과목이 이미 배치되어 있습니다.`, 'error');
      return false;
    }
  }
  
  return true;
}; 