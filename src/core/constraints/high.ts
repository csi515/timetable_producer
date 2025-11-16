import { Schedule, TimetableData } from '../../types';
import { DAYS, getCurrentSubjectHours, getCurrentTeacherHours, convertClassNameToKey } from '../../utils/helpers';
import { ConstraintViolation } from './types';

// High 우선순위 제약조건 검증
export const validateHighConstraints = (
  schedule: Schedule,
  data: TimetableData,
  addLog?: (message: string, type?: string) => void
): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];
  
  // 1. 특별실 중복 사용 검증
  const specialRoomUsage: Record<string, { day: string; period: number; className: string }[]> = {};
  
  Object.keys(schedule).forEach(className => {
    DAYS.forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        schedule[className][day].forEach((slot, periodIndex) => {
          if (slot && typeof slot === 'object' && slot.subject) {
            const subject = data.subjects.find(s => s.name === slot.subject);
            if (subject && subject.is_space_limited) {
              const roomKey = `${slot.subject}_${day}_${periodIndex + 1}`;
              
              if (!specialRoomUsage[roomKey]) {
                specialRoomUsage[roomKey] = [];
              }
              
              specialRoomUsage[roomKey].push({
                day,
                period: periodIndex + 1,
                className
              });
              
              if (specialRoomUsage[roomKey].length > (subject.max_classes_at_once || 1)) {
                violations.push({
                  type: 'high',
                  category: 'special_room_conflict',
                  message: `특별실 ${slot.subject}가 ${day}요일 ${periodIndex + 1}교시에 중복 사용됩니다.`,
                  className,
                  subject: slot.subject,
                  day,
                  period: periodIndex + 1,
                  details: {
                    conflictingClasses: specialRoomUsage[roomKey].map(c => c.className)
                  }
                });
              }
            }
          }
        });
      }
    });
  });
  
  // 2. 시수 초과/부족 검증
  // 교사 시수 제한 검증
  data.teachers.forEach(teacher => {
    const currentHours = getCurrentTeacherHours(schedule, teacher.name, data);
    
    if (teacher.max_hours_per_week && currentHours > teacher.max_hours_per_week) {
      violations.push({
        type: 'high',
        category: 'teacher_hours_exceeded',
        message: `${teacher.name} 교사의 주간 시수가 제한을 초과했습니다. (현재: ${currentHours}, 제한: ${teacher.max_hours_per_week})`,
        teacher: teacher.name,
        details: {
          current: currentHours,
          max: teacher.max_hours_per_week
        }
      });
    }
  });
  
  // 학급별 시수 제한 검증
  Object.keys(schedule).forEach(className => {
    const classHours = data.classWeeklyHours?.[className];
    if (classHours) {
      let totalHours = 0;
      
      DAYS.forEach(day => {
        if (schedule[className] && schedule[className][day]) {
          schedule[className][day].forEach(slot => {
            if (slot && slot !== '' && slot !== undefined && slot !== null) {
              totalHours++;
            }
          });
        }
      });
      
      if (totalHours > classHours) {
        violations.push({
          type: 'high',
          category: 'class_hours_exceeded',
          message: `${className}의 주간 시수가 제한을 초과했습니다. (현재: ${totalHours}, 제한: ${classHours})`,
          className,
          details: {
            current: totalHours,
            max: classHours
          }
        });
      }
    }
  });
  
  // 3. 일일 동일 과목 중복 수업 방지
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
            
            if (subjectCounts[slot.subject] > 1) {
              violations.push({
                type: 'high',
                category: 'duplicate_subject_per_day',
                message: `${className}의 ${day}요일에 ${slot.subject} 과목이 중복 배정되었습니다.`,
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
  
  return violations;
};
