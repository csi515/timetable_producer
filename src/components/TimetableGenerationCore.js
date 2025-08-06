// 시간표 생성 핵심 로직 함수들

// 사용 가능한 슬롯 찾기
export const findAvailableSlots = (schedule, className, teacher, subjectName, isCoTeaching = false, data = null) => {
  const availableSlots = [];
  const days = ['월', '화', '수', '목', '금'];
  
  days.forEach(day => {
    if (schedule[className] && schedule[className][day]) {
      schedule[className][day].forEach((slot, slotIndex) => {
        if (slot === '' || slot === undefined) {
          const period = slotIndex + 1;
          
          // 교사 수업 불가 시간 확인
          const unavailableCheck = checkTeacherUnavailable(teacher, day, period);
          if (!unavailableCheck.allowed) {
            return;
          }
          
          // 교사별 학급별 시수 제한 확인
          const classHoursCheck = checkTeacherClassHoursLimit(teacher, className, schedule, days);
          if (!classHoursCheck.allowed) {
            return;
          }
          
          // 학급별 전체 시수 제한 확인
          const classWeeklyCheck = checkClassWeeklyHoursLimit(className, schedule, data);
          if (!classWeeklyCheck.allowed) {
            return;
          }
          
          // 학급별 일일 시수 제한 확인
          const classDailyCheck = checkClassDailyHoursLimit(className, day, schedule, data);
          if (!classDailyCheck.allowed) {
            return;
          }
          
          // 교사 간 동시 수업 제약조건 확인
          if (data && data.constraints) {
            const mutualExclusions = [
              ...(data.constraints.must || []).filter(c => c.type === 'teacher_mutual_exclusion'),
              ...(data.constraints.optional || []).filter(c => c.type === 'teacher_mutual_exclusion')
            ];
            
            for (const constraint of mutualExclusions) {
              const teacher1 = constraint.teacher1;
              const teacher2 = constraint.teacher2;
              
              // 현재 교사가 제약조건에 포함되어 있는지 확인
              if (teacher.name === teacher1 || teacher.name === teacher2) {
                const otherTeacher = teacher.name === teacher1 ? teacher2 : teacher1;
                
                // 다른 교사가 같은 시간에 수업 중인지 확인
                let otherTeacherTeaching = false;
                Object.keys(schedule).forEach(otherClassName => {
                  if (schedule[otherClassName] && schedule[otherClassName][day]) {
                    const otherSlot = schedule[otherClassName][day][slotIndex];
                    if (otherSlot && typeof otherSlot === 'object' && otherSlot.teachers && otherSlot.teachers.includes(otherTeacher)) {
                      otherTeacherTeaching = true;
                    }
                  }
                });
                
                if (otherTeacherTeaching) {
                  return; // 제약조건 위반
                }
              }
            }
          }
          
          // 다른 학급에서 같은 시간에 수업 중인지 확인
          let hasConflict = false;
          Object.keys(schedule).forEach(otherClassName => {
            if (otherClassName !== className && schedule[otherClassName] && schedule[otherClassName][day]) {
              const otherSlot = schedule[otherClassName][day][slotIndex];
              if (otherSlot && typeof otherSlot === 'object' && otherSlot.teachers && otherSlot.teachers.includes(teacher.name)) {
                hasConflict = true;
              }
            }
          });
          
          if (!hasConflict) {
            availableSlots.push({
              day: day,
              period: period,
              slotIndex: slotIndex
            });
          }
        }
      });
    }
  });
  
  return availableSlots;
};

// 고정 수업 적용
export const applyFixedClasses = (schedule, data, addLog) => {
  const fixedClasses = data.fixedClasses || [];
  
  if (fixedClasses.length === 0) {
    addLog('고정 수업이 설정되지 않았습니다.', 'info');
    return;
  }
  
  addLog(`고정 수업 ${fixedClasses.length}개를 적용합니다.`, 'info');
  
  fixedClasses.forEach((fixedClass, index) => {
    const { className, day, period, subject, teacher } = fixedClass;
    
    if (!schedule[className] || !schedule[className][day]) {
      addLog(`경고: ${className} ${day}요일 스케줄이 없습니다.`, 'warning');
      return;
    }
    
    const slotIndex = period - 1;
    if (slotIndex < 0 || slotIndex >= schedule[className][day].length) {
      addLog(`경고: ${className} ${day}요일 ${period}교시가 범위를 벗어났습니다.`, 'warning');
      return;
    }
    
    if (schedule[className][day][slotIndex] !== '' && schedule[className][day][slotIndex] !== undefined) {
      addLog(`경고: ${className} ${day}요일 ${period}교시에 이미 수업이 배치되어 있습니다.`, 'warning');
      return;
    }
    
    schedule[className][day][slotIndex] = {
      subject: subject,
      teachers: [teacher],
      isFixed: true,
      isCoTeaching: false,
      source: 'fixed_class'
    };
    
    addLog(`✅ 고정 수업 ${index + 1}: ${className} ${day}요일 ${period}교시 ${subject} (${teacher})`, 'success');
  });
};

// 공동수업 제약조건 처리
export const processCoTeachingConstraints = (schedule, data, addLog) => {
  const coTeachingConstraints = (data.constraints?.must || []).filter(c =>
    c.type === 'co_teaching_requirement' || c.type === 'specific_teacher_co_teaching'
  );
  
  if (coTeachingConstraints.length === 0) {
    addLog('공동수업 제약조건이 설정되지 않았습니다.', 'info');
    return;
  }
  
  addLog(`공동수업 제약조건 ${coTeachingConstraints.length}개를 처리합니다.`, 'info');
  
  coTeachingConstraints.forEach((constraint, index) => {
    if (constraint.mainTeacher && constraint.coTeachers && constraint.coTeachers.length > 0) {
      const mainTeacher = data.teachers.find(t => t.name === constraint.mainTeacher);
      if (!mainTeacher) {
        addLog(`경고: 주교사 ${constraint.mainTeacher}을 찾을 수 없습니다.`, 'warning');
        return;
      }
      
      const mainTeacherWeeklyHours = constraint.weeklyHours || mainTeacher.weeklyHours || mainTeacher.maxHours || 25;
      const subject = constraint.subject || '공동수업';
      const maxTeachersPerClass = constraint.maxTeachersPerClass || 2;
      
      addLog(`공동수업 ${index + 1}: ${constraint.mainTeacher} 주교사 (주간시수: ${mainTeacherWeeklyHours}시간)`, 'info');
      
      const coTeacherParticipation = {};
      constraint.coTeachers.forEach(teacher => {
        coTeacherParticipation[teacher] = 0;
      });
      
      let placedHours = 0;
      const maxAttempts = mainTeacherWeeklyHours * 50;
      let attempts = 0;
      let balanceMode = true;
      
      while (placedHours < mainTeacherWeeklyHours && attempts < maxAttempts) {
        attempts++;
        
        // 30회만에 균형 완화
        if (attempts > 30 && balanceMode) {
          balanceMode = false;
          addLog(`⚠️ ${constraint.mainTeacher} 교사 공동수업 30회 시도 후 부교사 균형을 완화합니다.`, 'warning');
        }
        
        const allAvailableSlots = [];
        Object.keys(schedule).forEach(className => {
          const slots = findAvailableSlots(schedule, className, mainTeacher, subject, true);
          slots.forEach(slot => {
            allAvailableSlots.push({ ...slot, className: className });
          });
        });
        
        if (allAvailableSlots.length === 0) {
          addLog(`경고: ${constraint.mainTeacher} 교사의 공동수업을 배치할 수 있는 슬롯이 없습니다.`, 'warning');
          break;
        }
        
        const selectedSlot = allAvailableSlots[Math.floor(Math.random() * allAvailableSlots.length)];
        const selectedCoTeachers = [];
        const maxCoTeachers = Math.min(maxTeachersPerClass - 1, constraint.coTeachers.length);
        
        // 해당 시간에 수업 가능한 부교사들 필터링
        const availableCoTeachers = constraint.coTeachers.filter(coTeacherName => {
          const coTeacher = data.teachers.find(t => t.name === coTeacherName);
          if (!coTeacher) return false;
          
          const unavailableCheck = checkTeacherUnavailable(coTeacher, selectedSlot.day, selectedSlot.period);
          if (!unavailableCheck.allowed) {
            return false;
          }
          
          const classHoursCheck = checkTeacherClassHoursLimit(coTeacher, selectedSlot.className, schedule, ['월', '화', '수', '목', '금']);
          if (!classHoursCheck.allowed) {
            return false;
          }
          
          const classWeeklyCheck = checkClassWeeklyHoursLimit(selectedSlot.className, schedule);
          if (!classWeeklyCheck.allowed) {
            return false;
          }
          
          const classDailyCheck = checkClassDailyHoursLimit(selectedSlot.className, selectedSlot.day, schedule);
          if (!classDailyCheck.allowed) {
            return false;
          }
          
          // 다른 학급에서 같은 시간에 수업 중인지 확인
          let hasConflict = false;
          Object.keys(schedule).forEach(otherClassName => {
            if (otherClassName !== selectedSlot.className && schedule[otherClassName] && schedule[otherClassName][selectedSlot.day]) {
              const otherSlot = schedule[otherClassName][selectedSlot.day][selectedSlot.slotIndex];
              if (otherSlot && typeof otherSlot === 'object' && otherSlot.teachers && otherSlot.teachers.includes(coTeacherName)) {
                hasConflict = true;
              }
            }
          });
          
          return !hasConflict;
        });
        
        if (availableCoTeachers.length === 0) {
          addLog(`경고: ${selectedSlot.className} ${selectedSlot.day}요일 ${selectedSlot.period}교시에 수업 가능한 부교사가 없습니다.`, 'warning');
          continue;
        }
        
        if (balanceMode) {
          // 균형 모드
          const sortedCoTeachers = [...availableCoTeachers].sort((a, b) => 
            (coTeacherParticipation[a] || 0) - (coTeacherParticipation[b] || 0)
          );
          
          for (let i = 0; i < Math.min(maxCoTeachers, sortedCoTeachers.length); i++) {
            const selectedTeacher = sortedCoTeachers[i];
            selectedCoTeachers.push(selectedTeacher);
            coTeacherParticipation[selectedTeacher] = (coTeacherParticipation[selectedTeacher] || 0) + 1;
          }
        } else {
          // 완화 모드: 랜덤 선택
          const shuffledCoTeachers = [...availableCoTeachers].sort(() => Math.random() - 0.5);
          
          for (let i = 0; i < Math.min(maxCoTeachers, shuffledCoTeachers.length); i++) {
            const selectedTeacher = shuffledCoTeachers[i];
            selectedCoTeachers.push(selectedTeacher);
            coTeacherParticipation[selectedTeacher] = (coTeacherParticipation[selectedTeacher] || 0) + 1;
          }
        }
        
        // 슬롯 배치
        schedule[selectedSlot.className][selectedSlot.day][selectedSlot.slotIndex] = {
          subject: subject,
          teachers: [constraint.mainTeacher, ...selectedCoTeachers],
          isCoTeaching: true,
          isFixed: false,
          source: 'constraint',
          constraintType: 'specific_teacher_co_teaching'
        };
        
        placedHours++;
        addLog(`✅ 공동수업 배치: ${selectedSlot.className} ${selectedSlot.day}요일 ${selectedSlot.period}교시 ${subject} (${constraint.mainTeacher} + ${selectedCoTeachers.join(', ')})`, 'success');
      }
      
      addLog(`📊 ${constraint.mainTeacher} 공동수업 완료: ${placedHours}시간/${mainTeacherWeeklyHours}시간`, 'info');
    }
  });
};

// 교사별 같은 학급 일일 제한 처리
export const processTeacherSameClassDailyLimit = (schedule, data, addLog) => {
  const dailyLimitConstraints = (data.constraints?.must || []).filter(c =>
    c.type === 'teacher_same_class_daily_limit'
  );
  
  if (dailyLimitConstraints.length === 0) {
    return;
  }
  
  addLog(`교사별 같은 학급 일일 제한 ${dailyLimitConstraints.length}개를 처리합니다.`, 'info');
  
  dailyLimitConstraints.forEach(constraint => {
    const { teacher, maxHoursPerDay } = constraint;
    
    Object.keys(schedule).forEach(className => {
      ['월', '화', '수', '목', '금'].forEach(day => {
        let teacherHoursInDay = 0;
        
        if (schedule[className] && schedule[className][day]) {
          schedule[className][day].forEach(slot => {
            if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.includes(teacher)) {
              teacherHoursInDay++;
            }
          });
        }
        
        if (teacherHoursInDay > maxHoursPerDay) {
          addLog(`⚠️ ${teacher} 교사 ${className} ${day}요일 일일 시수 초과: ${teacherHoursInDay}시간/${maxHoursPerDay}시간`, 'warning');
        }
      });
    });
  });
};

// 공동수업 제약조건 검증
export const validateCoTeachingConstraints = (schedule, data, addLog) => {
  const violations = [];
  
  const coTeachingConstraints = (data.constraints?.must || []).filter(c =>
    c.type === 'co_teaching_requirement' || c.type === 'specific_teacher_co_teaching'
  );
  
  coTeachingConstraints.forEach(constraint => {
    if (constraint.mainTeacher && constraint.coTeachers && constraint.coTeachers.length > 0) {
      const mainTeacher = data.teachers.find(t => t.name === constraint.mainTeacher);
      if (!mainTeacher) {
        addLog(`경고: 주교사 ${constraint.mainTeacher}을 찾을 수 없습니다.`, 'warning');
        return;
      }
      
      const subject = constraint.subject || '공동수업';
      const maxTeachersPerClass = constraint.maxTeachersPerClass || 2;
      
      // 공동수업이 올바르게 배치되었는지 확인
      Object.keys(schedule).forEach(className => {
        ['월', '화', '수', '목', '금'].forEach(day => {
          if (schedule[className] && schedule[className][day]) {
            schedule[className][day].forEach((slot, period) => {
              if (slot && typeof slot === 'object' && slot.subject === subject && slot.isCoTeaching) {
                // 주교사가 포함되어 있는지 확인
                if (!slot.teachers || !slot.teachers.includes(constraint.mainTeacher)) {
                  violations.push({
                    type: 'co_teaching_missing_main_teacher',
                    className: className,
                    day: day,
                    period: period,
                    subject: subject,
                    mainTeacher: constraint.mainTeacher
                  });
                  addLog(`⚠️ ${className} ${day}요일 ${period}교시 공동수업에 주교사 ${constraint.mainTeacher} 누락`, 'warning');
                }
                
                // 부교사 수가 제한을 초과하지 않는지 확인
                if (slot.teachers && slot.teachers.length > maxTeachersPerClass) {
                  violations.push({
                    type: 'co_teaching_too_many_teachers',
                    className: className,
                    day: day,
                    period: period,
                    subject: subject,
                    teacherCount: slot.teachers.length,
                    maxTeachers: maxTeachersPerClass
                  });
                  addLog(`⚠️ ${className} ${day}요일 ${period}교시 공동수업 교사 수 초과: ${slot.teachers.length}명/${maxTeachersPerClass}명`, 'warning');
                }
              }
            });
          }
        });
      });
    }
  });
  
  return violations;
};

// 일일 과목 한 번 제약조건 검증
export const validateDailySubjectOnceConstraints = (schedule, data, addLog) => {
  const violations = [];
  
  const dailyOnceConstraints = (data.constraints?.must || []).filter(c =>
    c.type === 'daily_subject_once'
  );
  
  dailyOnceConstraints.forEach(constraint => {
    const subject = constraint.subject;
    
    Object.keys(schedule).forEach(className => {
      ['월', '화', '수', '목', '금'].forEach(day => {
        let subjectCount = 0;
        
        if (schedule[className] && schedule[className][day]) {
          schedule[className][day].forEach((slot, period) => {
            if (slot && typeof slot === 'object' && slot.subject === subject) {
              subjectCount++;
            }
          });
        }
        
        if (subjectCount > 1) {
          violations.push({
            type: 'daily_subject_more_than_once',
            className: className,
            day: day,
            subject: subject,
            count: subjectCount
          });
          addLog(`⚠️ ${className} ${day}요일 ${subject} 과목이 ${subjectCount}번 배치됨 (일일 한 번 제약 위반)`, 'warning');
        }
      });
    });
  });
  
  return violations;
};

// 시간표 통계 계산
export const getScheduleStats = (schedule) => {
  if (!schedule) return null;
  
  let totalSlots = 0;
  let filledSlots = 0;
  const days = ['월', '화', '수', '목', '금'];
  
  Object.keys(schedule).forEach(className => {
    days.forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        schedule[className][day].forEach(slot => {
          totalSlots++;
          if (slot && typeof slot === 'object' && slot.subject) {
            filledSlots++;
          }
        });
      }
    });
  });
  
  const emptySlots = totalSlots - filledSlots;
  const fillRate = totalSlots > 0 ? ((filledSlots / totalSlots) * 100).toFixed(1) : '0.0';
  
  return {
    totalSlots,
    filledSlots,
    emptySlots,
    fillRate
  };
};

// 헬퍼 함수들 import
import { 
  checkTeacherUnavailable,
  checkTeacherClassHoursLimit,
  checkClassWeeklyHoursLimit,
  checkClassDailyHoursLimit
} from './TimetableGenerationHelpers'; 