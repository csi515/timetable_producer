import { 
  getCurrentSubjectHours,
  getCurrentTeacherHours,
  checkTeacherClassHoursLimit,
  checkTeacherUnavailable,
  validateSlotPlacement,
  canPlaceClassInSchedule
} from './TimetableGenerationHelpers';

// 사용 가능한 슬롯 찾기
export const findAvailableSlots = (schedule, className, teacher, subjectName, isCoTeaching = false, days) => {
  const availableSlots = [];
  
  if (!schedule[className]) {
    return availableSlots;
  }
  
  days.forEach(day => {
    if (schedule[className][day]) {
      schedule[className][day].forEach((slot, periodIndex) => {
        const period = periodIndex + 1;
        
        // 슬롯이 비어있는지 확인
        if (slot === '' || slot === undefined || slot === null) {
          // 교사 불가능 시간 확인
          const unavailableCheck = checkTeacherUnavailable(teacher, day, period);
          if (unavailableCheck.allowed) {
            // 교사 시간 충돌 확인
            let hasConflict = false;
            Object.keys(schedule).forEach(otherClassName => {
              if (otherClassName !== className && schedule[otherClassName] && schedule[otherClassName][day]) {
                const otherSlot = schedule[otherClassName][day][periodIndex];
                if (otherSlot && typeof otherSlot === 'object' && otherSlot.teachers && otherSlot.teachers.includes(teacher.name)) {
                  hasConflict = true;
                }
              }
            });
            
            if (!hasConflict) {
              availableSlots.push({
                day,
                period,
                slotIndex: periodIndex
              });
            }
          }
        }
      });
    }
  });
  
  return availableSlots;
};

// 고정 수업 배치
export const applyFixedClasses = (schedule, data, addLog) => {
  if (!data.fixedClasses || data.fixedClasses.length === 0) {
    return;
  }
  
  addLog('고정 수업을 배치합니다...', 'info');
  
  data.fixedClasses.forEach(fixedClass => {
    const { day, period, grade, class: classNum, subject, teacher, coTeachers } = fixedClass;
    const className = `${grade}학년 ${classNum}반`;
    
    if (!schedule[className]) {
      addLog(`경고: ${className} 스케줄이 존재하지 않습니다.`, 'warning');
      return;
    }
    
    if (!schedule[className][day]) {
      addLog(`경고: ${className} ${day}요일 스케줄이 존재하지 않습니다.`, 'warning');
      return;
    }
    
    const slotIndex = period - 1;
    const currentSlot = schedule[className][day][slotIndex];
    
    if (currentSlot !== '' && currentSlot !== undefined && currentSlot !== null) {
      addLog(`경고: ${className} ${day}요일 ${period}교시가 이미 점유되어 있습니다.`, 'warning');
      return;
    }
    
    // 고정 수업 배치
    schedule[className][day][slotIndex] = {
      subject,
      teachers: [teacher, ...(coTeachers || [])],
      isCoTeaching: coTeachers && coTeachers.length > 0,
      isFixed: true
    };
    
    addLog(`✅ 고정 수업 배치: ${className} ${day}요일 ${period}교시 - ${subject} (${teacher})`, 'success');
  });
};

// 공동수업 제약 조건 처리
export const processCoTeachingConstraints = (schedule, data, addLog) => {
  const coTeachingConstraints = data.constraints?.must?.filter(c => c.type === 'co_teaching_requirement') || [];
  
  if (coTeachingConstraints.length === 0) {
    return;
  }
  
  addLog('공동수업 제약 조건을 처리합니다...', 'info');
  
  coTeachingConstraints.forEach(constraint => {
    const { mainTeacher, coTeachers, class: className } = constraint;
    
    if (!className || !mainTeacher || !coTeachers || coTeachers.length === 0) {
      addLog('경고: 공동수업 제약 조건 정보가 불완전합니다.', 'warning');
      return;
    }
    
    // 해당 학급에서 주교사가 담당하는 수업 찾기
    const days = ['월', '화', '수', '목', '금'];
    days.forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        schedule[className][day].forEach((slot, periodIndex) => {
          if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.includes(mainTeacher)) {
            // 공동수업 교사 추가
            slot.teachers = [...new Set([...slot.teachers, ...coTeachers])];
            slot.isCoTeaching = true;
            
            addLog(`✅ 공동수업 설정: ${className} ${day}요일 ${periodIndex + 1}교시 - ${slot.subject} (${mainTeacher} + ${coTeachers.join(', ')})`, 'success');
          }
        });
      }
    });
  });
};

// 공동수업 제약 조건 검증
export const validateCoTeachingConstraints = (schedule, data, addLog) => {
  const violations = [];
  const coTeachingConstraints = data.constraints?.must?.filter(c => c.type === 'co_teaching_requirement') || [];
  
  coTeachingConstraints.forEach(constraint => {
    const { mainTeacher, coTeachers, class: className } = constraint;
    
    if (!className || !mainTeacher || !coTeachers || coTeachers.length === 0) {
      return;
    }
    
    const days = ['월', '화', '수', '목', '금'];
    let hasCoTeaching = false;
    
    days.forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        schedule[className][day].forEach((slot, periodIndex) => {
          if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.includes(mainTeacher)) {
            // 모든 공동수업 교사가 포함되어 있는지 확인
            const missingTeachers = coTeachers.filter(teacher => !slot.teachers.includes(teacher));
            if (missingTeachers.length > 0) {
              violations.push(`${className} ${day}요일 ${periodIndex + 1}교시: 공동수업 교사 누락 (${missingTeachers.join(', ')})`);
            } else {
              hasCoTeaching = true;
            }
          }
        });
      }
    });
    
    if (!hasCoTeaching) {
      violations.push(`${className}: ${mainTeacher} 교사의 공동수업이 배치되지 않았습니다.`);
    }
  });
  
  if (violations.length > 0) {
    addLog(`공동수업 제약 조건 위반 ${violations.length}건 발견:`, 'warning');
    violations.forEach(violation => addLog(`  - ${violation}`, 'warning'));
  }
  
  return violations.length === 0;
};

// 일일 과목 1회 제약 조건 검증
export const validateDailySubjectOnceConstraints = (schedule, data, addLog) => {
  const violations = [];
  const dailySubjectOnceConstraints = [
    ...(data.constraints?.must || []).filter(c => c.type === 'class_daily_subject_once'),
    ...(data.constraints?.optional || []).filter(c => c.type === 'class_daily_subject_once')
  ];
  
  if (dailySubjectOnceConstraints.length === 0) {
    return true;
  }
  
  const days = ['월', '화', '수', '목', '금'];
  
  Object.keys(schedule).forEach(className => {
    days.forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        const subjectCounts = {};
        
        schedule[className][day].forEach((slot, periodIndex) => {
          if (slot && typeof slot === 'object' && slot.subject) {
            subjectCounts[slot.subject] = (subjectCounts[slot.subject] || 0) + 1;
          }
        });
        
        // 같은 과목이 2회 이상 배치된 경우
        Object.entries(subjectCounts).forEach(([subject, count]) => {
          if (count > 1) {
            violations.push(`${className} ${day}요일: ${subject} 과목이 ${count}회 배치됨`);
          }
        });
      }
    });
  });
  
  if (violations.length > 0) {
    addLog(`일일 과목 1회 제약 조건 위반 ${violations.length}건 발견:`, 'warning');
    violations.forEach(violation => addLog(`  - ${violation}`, 'warning'));
  }
  
  return violations.length === 0;
};

// 스케줄 통계 계산
export const getScheduleStats = (schedule, data, days) => {
  const stats = {
    totalSlots: 0,
    filledSlots: 0,
    emptySlots: 0,
    fillRate: '0%',
    subjectHours: {},
    teacherHours: {},
    classSubjectHours: {}
  };
  
  Object.keys(schedule).forEach(className => {
    if (isClassDisabled(className, data)) {
      return; // 0시간 설정 학급은 통계에서 제외
    }
    
    stats.classSubjectHours[className] = {};
    
    days.forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        schedule[className][day].forEach(slot => {
          stats.totalSlots++;
          
          if (slot && typeof slot === 'object' && slot.subject) {
            stats.filledSlots++;
            
            // 과목별 시수 계산
            stats.subjectHours[slot.subject] = (stats.subjectHours[slot.subject] || 0) + 1;
            stats.classSubjectHours[className][slot.subject] = (stats.classSubjectHours[className][slot.subject] || 0) + 1;
            
            // 교사별 시수 계산
            if (slot.teachers) {
              slot.teachers.forEach(teacherName => {
                stats.teacherHours[teacherName] = (stats.teacherHours[teacherName] || 0) + 1;
              });
            }
          } else {
            stats.emptySlots++;
          }
        });
      }
    });
  });
  
  if (stats.totalSlots > 0) {
    stats.fillRate = `${Math.round((stats.filledSlots / stats.totalSlots) * 100)}%`;
  }
  
  return stats;
}; 