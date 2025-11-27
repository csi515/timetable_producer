import { Schedule, ValidationResult, TimetableData } from '../../types';

// 학급별 주간 시수 제한 확인
export const checkClassWeeklyHoursLimit = (
  className: string, 
  schedule: Schedule, 
  data: TimetableData
): ValidationResult => {
  if (!data.classWeeklyHours || !data.classWeeklyHours[className]) {
    return { allowed: true, reason: 'no_limit' };
  }
  
  const maxHours = data.classWeeklyHours[className];
  let currentHours = 0;
  
  for (const day of ['월', '화', '수', '목', '금']) {
    if (schedule[className] && schedule[className][day]) {
      schedule[className][day].forEach(slot => {
        if (slot && typeof slot === 'object' && slot.subject) {
          currentHours++;
        }
      });
    }
  }
  
  if (currentHours > maxHours) {
    return { 
      allowed: false, 
      reason: 'weekly_hours_exceeded',
      message: `${className} 주간 시수 제한 초과: ${currentHours}시간/${maxHours}시간`,
      current: currentHours,
      max: maxHours
    };
  }
  
  return { allowed: true, current: currentHours, max: maxHours };
};

// 학급별 일일 시수 제한 확인
export const checkClassDailyHoursLimit = (
  className: string, 
  day: string, 
  schedule: Schedule, 
  data: TimetableData
): ValidationResult => {
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
      message: `${className} ${day}요일 일일 시수 제한 초과: ${currentHours}시간/${maxHours}시간`,
      current: currentHours,
      max: maxHours
    };
  }
  
  return { allowed: true, current: currentHours, max: maxHours };
};

// 슬롯 배치 검증
export const validateSlotPlacement = (
  schedule: Schedule,
  className: string,
  day: string,
  period: number,
  teacher: any,
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
      if (otherSlot && typeof otherSlot === 'object' && otherSlot.teachers && otherSlot.teachers.includes(teacher.name)) {
        addLog(`❌ 슬롯 검증 실패: ${teacher.name} 교사가 ${day}요일 ${period}교시에 ${otherClassName}에서 이미 수업 중입니다.`, 'error');
        return false;
      }
    }
  }
  
  // 3. 학급 같은 날짜 같은 과목 중복 확인 (일일 과목 1회 제한)
  const dailySubjectOnceConstraints = [
    ...(data.constraints?.must || []).filter((c: any) => c.type === 'class_daily_subject_once'),
    ...(data.constraints?.optional || []).filter((c: any) => c.type === 'class_daily_subject_once')
  ];
  
  if (dailySubjectOnceConstraints.length > 0) {
    // 해당 학급에서 같은 날짜에 같은 과목이 이미 배치되어 있는지 확인
    const daySchedule = schedule[className][day];
    const hasSameSubjectToday = daySchedule.some((slot: any) => 
      slot && typeof slot === 'object' && slot.subject === subject
    );
    
    if (hasSameSubjectToday) {
      addLog(`❌ 슬롯 검증 실패: ${className}에서 ${day}요일에 ${subject} 과목이 이미 배치되어 있습니다.`, 'error');
      return false;
    }
  }
  
  return true;
};

// 과목 고정 전용 확인
export const checkSubjectFixedOnly = (
  subjectName: string,
  data: TimetableData
): boolean => {
  const subject = data.subjects?.find(s => s.name === subjectName);
  return subject?.fixedOnly === true;
}; 