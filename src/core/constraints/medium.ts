import { Schedule, TimetableData } from '../../types';
import { DAYS } from '../../utils/helpers';
import { ConstraintViolation } from './types';

// Medium 우선순위 제약조건 검증
export const validateMediumConstraints = (
  schedule: Schedule,
  data: TimetableData,
  addLog?: (message: string, type?: string) => void
): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];
  
  // 1. 공동수업 슬롯 충족 검증
  const coTeachingConstraints = (data.constraints?.must || []).filter(c =>
    c.type === 'co_teaching_requirement' || c.type === 'specific_teacher_co_teaching'
  );
  
  coTeachingConstraints.forEach(constraint => {
    if (constraint.mainTeacher && constraint.coTeachers && constraint.coTeachers.length > 0) {
      const subject = constraint.subject || '공동수업';
      let coTeachingCount = 0;
      
      Object.keys(schedule).forEach(className => {
        DAYS.forEach(day => {
          if (schedule[className] && schedule[className][day]) {
            schedule[className][day].forEach((slot, periodIndex) => {
              if (slot && typeof slot === 'object' && 
                  slot.subject === subject && 
                  slot.isCoTeaching &&
                  slot.teachers &&
                  slot.teachers.includes(constraint.mainTeacher!)) {
                coTeachingCount++;
              }
            });
          }
        });
      });
      
      // 공동수업이 필요한 만큼 배치되지 않은 경우
      const requiredHours = constraint.maxPeriods || 0;
      if (coTeachingCount < requiredHours) {
        violations.push({
          type: 'medium',
          category: 'co_teaching_insufficient',
          message: `공동수업 ${subject}의 배정이 부족합니다. (현재: ${coTeachingCount}, 필요: ${requiredHours})`,
          subject,
          details: {
            current: coTeachingCount,
            required: requiredHours,
            mainTeacher: constraint.mainTeacher,
            coTeachers: constraint.coTeachers
          }
        });
      }
    }
  });
  
  // 2. 블록수업 배치 검증
  const blockSubjects = data.subjects.filter(s => s.block);
  
  blockSubjects.forEach(subject => {
    Object.keys(schedule).forEach(className => {
      DAYS.forEach(day => {
        if (schedule[className] && schedule[className][day]) {
          let blockCount = 0;
          let isConsecutive = false;
          
          schedule[className][day].forEach((slot, periodIndex) => {
            if (slot && typeof slot === 'object' && slot.subject === subject.name) {
              blockCount++;
              
              // 다음 교시도 같은 과목인지 확인
              const nextSlot = schedule[className][day][periodIndex + 1];
              if (nextSlot && typeof nextSlot === 'object' && nextSlot.subject === subject.name) {
                isConsecutive = true;
              }
            }
          });
          
          // 블록 수업이 연속으로 배치되지 않은 경우
          if (blockCount > 0 && !isConsecutive && blockCount < 2) {
            violations.push({
              type: 'medium',
              category: 'block_period_not_consecutive',
              message: `${className}의 ${day}요일에 블록 수업 ${subject.name}이 연속으로 배치되지 않았습니다.`,
              className,
              subject: subject.name,
              day,
              details: {
                blockCount,
                isConsecutive
              }
            });
          }
        }
      });
    });
  });
  
  // 3. 연속 3교시 이상 금지 규칙
  Object.keys(schedule).forEach(className => {
    DAYS.forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        let consecutiveCount = 0;
        let lastTeacher: string | null = null;
        
        schedule[className][day].forEach((slot, periodIndex) => {
          if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.length > 0) {
            const currentTeacher = slot.teachers[0];
            
            if (currentTeacher === lastTeacher) {
              consecutiveCount++;
              
              if (consecutiveCount >= 3) {
                violations.push({
                  type: 'medium',
                  category: 'consecutive_3_periods',
                  message: `${className}의 ${day}요일에 ${currentTeacher} 교사가 연속 3교시 이상 수업합니다.`,
                  className,
                  teacher: currentTeacher,
                  day,
                  period: periodIndex + 1,
                  details: {
                    consecutiveCount
                  }
                });
              }
            } else {
              consecutiveCount = 1;
              lastTeacher = currentTeacher;
            }
          } else {
            consecutiveCount = 0;
            lastTeacher = null;
          }
        });
      }
    });
  });
  
  return violations;
};
