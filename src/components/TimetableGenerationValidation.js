// 헬퍼 함수들 import
import { 
  getCurrentTeacherHours,
  checkTeacherClassHoursLimit,
  checkClassWeeklyHoursLimit,
  checkClassDailyHoursLimit
} from './TimetableGenerationHelpers';

// 시간표 생성 검증 관련 함수들

// 교사 제약조건 검증
export const validateTeacherConstraints = (schedule, data, addLog) => {
  const violations = [];
  
  data.teachers.forEach(teacher => {
    // 교사별 주간 시수 제한 확인
    const maxHours = teacher.weeklyHours || teacher.maxHours || 25;
    const currentHours = getCurrentTeacherHours(schedule, teacher.name, null, ['월', '화', '수', '목', '금']);
    
    if (currentHours > maxHours) {
      violations.push({
        type: 'teacher_weekly_hours',
        teacher: teacher.name,
        current: currentHours,
        max: maxHours
      });
      addLog(`⚠️ ${teacher.name} 교사 주간 시수 초과: ${currentHours}시간/${maxHours}시간`, 'warning');
    }
    
    // 교사별 학급별 시수 제한 확인
    Object.keys(schedule).forEach(className => {
      const classHoursCheck = checkTeacherClassHoursLimit(teacher, className, schedule, ['월', '화', '수', '목', '금']);
      if (!classHoursCheck.allowed) {
        violations.push({
          type: 'teacher_class_hours',
          teacher: teacher.name,
          className: className,
          current: classHoursCheck.current,
          max: classHoursCheck.max,
          reason: classHoursCheck.reason
        });
        addLog(`⚠️ ${teacher.name} 교사 ${className} 시수 제한 위반: ${classHoursCheck.current}시간/${classHoursCheck.max}시간`, 'warning');
      }
    });
  });
  
  return violations;
};

// 학급 시수 제약조건 검증
export const validateClassHoursConstraints = (schedule, data, addLog) => {
  const violations = [];
  
  Object.keys(schedule).forEach(className => {
    // 학급별 주간 시수 제한 확인
    const classWeeklyCheck = checkClassWeeklyHoursLimit(className, schedule, data);
    if (!classWeeklyCheck.allowed) {
      violations.push({
        type: 'class_weekly_hours',
        className: className,
        current: classWeeklyCheck.current,
        max: classWeeklyCheck.max
      });
      addLog(`⚠️ ${className} 주간 시수 초과: ${classWeeklyCheck.current}시간/${classWeeklyCheck.max}시간`, 'warning');
    }
    
    // 학급별 일일 시수 제한 확인
    ['월', '화', '수', '목', '금'].forEach(day => {
      const classDailyCheck = checkClassDailyHoursLimit(className, day, schedule, data);
      if (!classDailyCheck.allowed) {
        violations.push({
          type: 'class_daily_hours',
          className: className,
          day: day,
          current: classDailyCheck.current,
          max: classDailyCheck.max
        });
        addLog(`⚠️ ${className} ${day}요일 시수 초과: ${classDailyCheck.current}시간/${classDailyCheck.max}시간`, 'warning');
      }
    });
  });
  
  return violations;
};

// 교사 시간 충돌 검증
export const validateTeacherTimeConflicts = (schedule, data, addLog) => {
  const violations = [];
  
  data.teachers.forEach(teacher => {
    const teacherSchedule = {};
    
    // 교사의 모든 수업 시간을 수집
    Object.keys(schedule).forEach(className => {
      ['월', '화', '수', '목', '금'].forEach(day => {
        if (schedule[className] && schedule[className][day]) {
          schedule[className][day].forEach((slot, period) => {
            if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.includes(teacher.name)) {
              if (!teacherSchedule[day]) teacherSchedule[day] = {};
              if (teacherSchedule[day][period]) {
                violations.push({
                  type: 'teacher_time_conflict',
                  teacher: teacher.name,
                  day: day,
                  period: period,
                  class1: teacherSchedule[day][period],
                  class2: className
                });
                addLog(`⚠️ ${teacher.name} 교사 ${day}요일 ${period}교시 시간 충돌: ${teacherSchedule[day][period]} ↔ ${className}`, 'warning');
              } else {
                teacherSchedule[day][period] = className;
              }
            }
          });
        }
      });
    });
  });
  
  return violations;
};

// 교사 수업 불가 시간 검증
export const validateTeacherUnavailableTimes = (schedule, data, addLog) => {
  const violations = [];
  
  data.teachers.forEach(teacher => {
    if (!teacher.unavailable || !Array.isArray(teacher.unavailable)) {
      return;
    }
    
    teacher.unavailable.forEach(slot => {
      let day, period;
      
      if (Array.isArray(slot) && slot.length >= 2) {
        [day, period] = slot;
      } else if (typeof slot === 'object' && slot.day && slot.period) {
        day = slot.day;
        period = slot.period;
      } else {
        return;
      }
      
      // 해당 시간에 교사가 수업 중인지 확인
      Object.keys(schedule).forEach(className => {
        if (schedule[className] && schedule[className][day] && schedule[className][day][period]) {
          const slotData = schedule[className][day][period];
          if (slotData && typeof slotData === 'object' && slotData.teachers && slotData.teachers.includes(teacher.name)) {
            violations.push({
              type: 'teacher_unavailable_time',
              teacher: teacher.name,
              day: day,
              period: period,
              className: className
            });
            addLog(`⚠️ ${teacher.name} 교사 수업 불가 시간 위반: ${day}요일 ${period}교시 ${className}`, 'warning');
          }
        }
      });
    });
  });
  
  return violations;
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

// 블록제 수업 제약조건 검증
export const validateBlockPeriodConstraints = (schedule, data, addLog) => {
  const violations = [];
  
  const blockPeriodConstraints = (data.constraints?.must || []).filter(c =>
    c.type === 'block_period_requirement'
  );
  
  blockPeriodConstraints.forEach(constraint => {
    const subject = constraint.subject;
    const requiredPeriods = constraint.periods || 2;
    
    Object.keys(schedule).forEach(className => {
      ['월', '화', '수', '목', '금'].forEach(day => {
        let consecutiveCount = 0;
        let maxConsecutive = 0;
        
        if (schedule[className] && schedule[className][day]) {
          schedule[className][day].forEach((slot, period) => {
            if (slot && typeof slot === 'object' && slot.subject === subject) {
              consecutiveCount++;
              maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
            } else {
              consecutiveCount = 0;
            }
          });
        }
        
        if (maxConsecutive < requiredPeriods) {
          violations.push({
            type: 'block_period_insufficient',
            className: className,
            day: day,
            subject: subject,
            required: requiredPeriods,
            actual: maxConsecutive
          });
          addLog(`⚠️ ${className} ${day}요일 ${subject} 블록제 부족: ${maxConsecutive}교시/${requiredPeriods}교시`, 'warning');
        }
      });
    });
  });
  
  return violations;
};

// 교사 상호 배타 제약조건 검증
export const validateTeacherMutualExclusions = (schedule, data, addLog) => {
  const violations = [];
  
  const mutualExclusions = (data.constraints?.must || []).filter(c =>
    c.type === 'teacher_mutual_exclusion'
  );
  
  mutualExclusions.forEach(constraint => {
    const teacher1 = constraint.teacher1;
    const teacher2 = constraint.teacher2;
    
    Object.keys(schedule).forEach(className => {
      ['월', '화', '수', '목', '금'].forEach(day => {
        if (schedule[className] && schedule[className][day]) {
          schedule[className][day].forEach((slot, period) => {
            if (slot && typeof slot === 'object' && slot.teachers) {
              const hasTeacher1 = slot.teachers.includes(teacher1);
              const hasTeacher2 = slot.teachers.includes(teacher2);
              
              if (hasTeacher1 && hasTeacher2) {
                violations.push({
                  type: 'teacher_mutual_exclusion_violation',
                  className: className,
                  day: day,
                  period: period + 1,
                  teacher1: teacher1,
                  teacher2: teacher2
                });
                addLog(`⚠️ ${className} ${day}요일 ${period + 1}교시 상호 배타 교사 동시 배치: ${teacher1}, ${teacher2}`, 'warning');
              }
            }
          });
        }
      });
    });
  });
  
  return violations;
};

// 과목별 특별실 제약조건 검증 (개선된 버전)
export const validateSpecialRoomConstraints = (schedule, data, addLog) => {
  const violations = [];
  
  // 특별실 제약조건 가져오기
  const specialRoomConstraints = (data.constraints?.must || []).filter(c =>
    c.type === 'special_room_requirement' || c.type === 'special_room_capacity'
  );
  
  // 특별실별 사용 현황 추적
  const specialRoomUsage = {};
  
  Object.keys(schedule).forEach(className => {
    ['월', '화', '수', '목', '금'].forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        schedule[className][day].forEach((slot, period) => {
          if (slot && typeof slot === 'object' && slot.subject) {
            const subject = data.subjects?.find(s => s.name === slot.subject);
            
            if (subject && subject.requiresSpecialRoom) {
              const roomType = subject.specialRoomType || 'default';
              const timeKey = `${day}-${period}`;
              
              if (!specialRoomUsage[timeKey]) {
                specialRoomUsage[timeKey] = {};
              }
              if (!specialRoomUsage[timeKey][roomType]) {
                specialRoomUsage[timeKey][roomType] = [];
              }
              
              specialRoomUsage[timeKey][roomType].push({
                className: className,
                subject: slot.subject,
                roomType: roomType
              });
            }
          }
        });
      }
    });
  });
  
  // 특별실 제약조건 검증
  Object.keys(specialRoomUsage).forEach(timeKey => {
    const [day, period] = timeKey.split('-');
    
    Object.keys(specialRoomUsage[timeKey]).forEach(roomType => {
      const usage = specialRoomUsage[timeKey][roomType];
      
      if (usage.length > 1) {
        // 1. 기본 충돌 검사 (같은 특별실 동시 사용)
        const conflictClasses = usage.map(u => u.className);
        const subjects = usage.map(u => u.subject);
        
        violations.push({
          type: 'special_room_conflict',
          day: day,
          period: parseInt(period) + 1,
          roomType: roomType,
          conflictClasses: conflictClasses,
          subjects: subjects,
          message: `${roomType} 특별실 동시 사용 충돌`
        });
        
        addLog(`⚠️ ${day}요일 ${parseInt(period) + 1}교시 ${roomType} 특별실 충돌: ${conflictClasses.join(', ')} (${subjects.join(', ')})`, 'warning');
        
        // 2. 특별실 용량 제한 검사
        const capacityConstraint = specialRoomConstraints.find(c => 
          c.type === 'special_room_capacity' && c.roomType === roomType
        );
        
        if (capacityConstraint && capacityConstraint.maxClasses && usage.length > capacityConstraint.maxClasses) {
          violations.push({
            type: 'special_room_capacity_exceeded',
            day: day,
            period: parseInt(period) + 1,
            roomType: roomType,
            currentClasses: usage.length,
            maxClasses: capacityConstraint.maxClasses,
            conflictClasses: conflictClasses,
            message: `${roomType} 특별실 용량 초과`
          });
          
          addLog(`🚫 ${day}요일 ${parseInt(period) + 1}교시 ${roomType} 특별실 용량 초과: ${usage.length}개 학급/${capacityConstraint.maxClasses}개 학급`, 'error');
        }
        
        // 3. 학급별 특별실 사용 제한 검사
        usage.forEach(usageItem => {
          const classConstraint = specialRoomConstraints.find(c => 
            c.type === 'special_room_requirement' && 
            c.className === usageItem.className && 
            c.roomType === roomType
          );
          
          if (classConstraint && classConstraint.maxConcurrent && usage.length > classConstraint.maxConcurrent) {
            violations.push({
              type: 'special_room_class_limit_exceeded',
              className: usageItem.className,
              day: day,
              period: parseInt(period) + 1,
              roomType: roomType,
              currentClasses: usage.length,
              maxConcurrent: classConstraint.maxConcurrent,
              message: `${usageItem.className}의 ${roomType} 특별실 동시 사용 제한 초과`
            });
            
            addLog(`🚫 ${usageItem.className} ${day}요일 ${parseInt(period) + 1}교시 ${roomType} 특별실 동시 사용 제한 초과: ${usage.length}개 학급/${classConstraint.maxConcurrent}개 학급`, 'error');
          }
        });
      }
    });
  });
  
  return violations;
};

// 특별실 사용 가능 시간 검증
export const validateSpecialRoomAvailability = (schedule, data, addLog) => {
  const violations = [];
  
  const availabilityConstraints = (data.constraints?.must || []).filter(c =>
    c.type === 'special_room_availability'
  );
  
  availabilityConstraints.forEach(constraint => {
    const roomType = constraint.roomType;
    const restrictedDays = constraint.restrictedDays || [];
    const restrictedPeriods = constraint.restrictedPeriods || [];
    
    Object.keys(schedule).forEach(className => {
      ['월', '화', '수', '목', '금'].forEach(day => {
        if (schedule[className] && schedule[className][day]) {
          schedule[className][day].forEach((slot, period) => {
            if (slot && typeof slot === 'object' && slot.subject) {
              const subject = data.subjects?.find(s => s.name === slot.subject);
              
              if (subject && subject.requiresSpecialRoom && subject.specialRoomType === roomType) {
                // 제한된 요일 검사
                if (restrictedDays.includes(day)) {
                  violations.push({
                    type: 'special_room_day_restriction',
                    className: className,
                    day: day,
                    period: period + 1,
                    roomType: roomType,
                    subject: slot.subject,
                    message: `${roomType} 특별실 ${day}요일 사용 제한`
                  });
                  
                  addLog(`🚫 ${className} ${day}요일 ${period + 1}교시 ${roomType} 특별실 사용 제한: ${slot.subject}`, 'error');
                }
                
                // 제한된 교시 검사
                if (restrictedPeriods.includes(period + 1)) {
                  violations.push({
                    type: 'special_room_period_restriction',
                    className: className,
                    day: day,
                    period: period + 1,
                    roomType: roomType,
                    subject: slot.subject,
                    message: `${roomType} 특별실 ${period + 1}교시 사용 제한`
                  });
                  
                  addLog(`🚫 ${className} ${day}요일 ${period + 1}교시 ${roomType} 특별실 사용 제한: ${slot.subject}`, 'error');
                }
              }
            }
          });
        }
      });
    });
  });
  
  return violations;
}; 