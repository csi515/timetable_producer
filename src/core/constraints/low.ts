import { Schedule, TimetableData } from '../../types';
import { DAYS } from '../../utils/helpers';
import { ConstraintViolation } from './types';

// Low 우선순위 제약조건 검증
export const validateLowConstraints = (
  schedule: Schedule,
  data: TimetableData,
  addLog?: (message: string, type?: string) => void
): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];
  
  // 1. 점심시간 전 특정 교사에게 몰리는 패턴 방지
  const lunchPeriod = 4; // 점심시간 전 (4교시까지)
  const teacherMorningLoad: Record<string, number> = {};
  
  Object.keys(schedule).forEach(className => {
    DAYS.forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        schedule[className][day].forEach((slot, periodIndex) => {
          if (periodIndex + 1 <= lunchPeriod && 
              slot && typeof slot === 'object' && 
              slot.teachers && slot.teachers.length > 0) {
            slot.teachers.forEach(teacherName => {
              if (!teacherMorningLoad[teacherName]) {
                teacherMorningLoad[teacherName] = 0;
              }
              teacherMorningLoad[teacherName]++;
            });
          }
        });
      }
    });
  });
  
  // 점심시간 전 과부하 교사 검출 (하루 평균 3교시 이상)
  Object.keys(teacherMorningLoad).forEach(teacherName => {
    const averageLoad = teacherMorningLoad[teacherName] / DAYS.length;
    if (averageLoad > 3) {
      violations.push({
        type: 'low',
        category: 'teacher_morning_overload',
        message: `${teacherName} 교사가 점심시간 전에 과도하게 배정되었습니다. (평균: ${averageLoad.toFixed(1)}교시)`,
        teacher: teacherName,
        details: {
          averageLoad,
          totalMorningHours: teacherMorningLoad[teacherName]
        }
      });
    }
  });
  
  // 2. 월요일 첫 교시 피하기 (선호도)
  Object.keys(schedule).forEach(className => {
    if (schedule[className] && schedule[className]['월']) {
      const mondayFirstSlot = schedule[className]['월'][0];
      if (mondayFirstSlot && typeof mondayFirstSlot === 'object' && mondayFirstSlot.teachers) {
        mondayFirstSlot.teachers.forEach(teacherName => {
          violations.push({
            type: 'low',
            category: 'monday_first_period',
            message: `${className}의 월요일 첫 교시에 ${teacherName} 교사가 배정되었습니다. (선호도 낮음)`,
            className,
            teacher: teacherName,
            day: '월',
            period: 1,
            details: {
              preference: 'low'
            }
          });
        });
      }
    }
  });
  
  // 3. 같은 과목은 하루 2개 이상 금지 (선호도)
  Object.keys(schedule).forEach(className => {
    DAYS.forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        const subjectCounts: Record<string, number> = {};
        
        schedule[className][day].forEach((slot, periodIndex) => {
          if (slot && typeof slot === 'object' && slot.subject) {
            if (!subjectCounts[slot.subject]) {
              subjectCounts[slot.subject] = 0;
            }
            subjectCounts[slot.subject]++;
            
            if (subjectCounts[slot.subject] > 2) {
              violations.push({
                type: 'low',
                category: 'subject_multiple_per_day',
                message: `${className}의 ${day}요일에 ${slot.subject} 과목이 2개 이상 배정되었습니다. (선호도 낮음)`,
                className,
                subject: slot.subject,
                day,
                period: periodIndex + 1,
                details: {
                  count: subjectCounts[slot.subject]
                }
              });
            }
          }
        });
      }
    });
  });
  
  // 4. 특정 교사는 금요일에 적은 시수 선호
  data.teachers.forEach(teacher => {
    if (teacher.name.includes('선호') || teacher.name.includes('금요일')) {
      let fridayHours = 0;
      
      Object.keys(schedule).forEach(className => {
        if (schedule[className] && schedule[className]['금']) {
          schedule[className]['금'].forEach(slot => {
            if (slot && typeof slot === 'object' && 
                slot.teachers && 
                slot.teachers.includes(teacher.name)) {
              fridayHours++;
            }
          });
        }
      });
      
      if (fridayHours > 2) {
        violations.push({
          type: 'low',
          category: 'friday_hours_preference',
          message: `${teacher.name} 교사가 금요일에 많은 시수가 배정되었습니다. (현재: ${fridayHours}교시, 선호: 2교시 이하)`,
          teacher: teacher.name,
          day: '금',
          details: {
            current: fridayHours,
            preferred: 2
          }
        });
      }
    }
  });
  
  return violations;
};
