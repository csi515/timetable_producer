import { Schedule, ScheduleStats, TeacherHoursTracker } from '../types';
import { DAYS, getClassSubjectHours } from './helpers';

// 시간표 통계 계산
export const calculateScheduleStats = (
  schedule: Schedule, 
  teacherHours: TeacherHoursTracker
): ScheduleStats => {
  let totalSlots = 0;
  let filledSlots = 0;
  const subjectHours: Record<string, number> = {};
  const teacherHoursStats: Record<string, number> = {};
  const classSubjectHours: Record<string, Record<string, number>> = {};

  // 각 학급별로 통계 계산
  Object.keys(schedule).forEach(className => {
    classSubjectHours[className] = getClassSubjectHours(schedule, className);
    
    DAYS.forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        Object.values(schedule[className][day]).forEach(slot => {
          totalSlots++;
          
          if (slot && typeof slot === 'object' && 'subject' in slot) {
            filledSlots++;
            
            // 과목별 시수 계산
            subjectHours[slot.subject] = (subjectHours[slot.subject] || 0) + 1;
            
            // 교사별 시수 계산
            if ('teachers' in slot) {
              slot.teachers.forEach(teacherName => {
                teacherHoursStats[teacherName] = (teacherHoursStats[teacherName] || 0) + 1;
              });
            }
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
    fillRate,
    subjectHours,
    teacherHours: teacherHoursStats,
    classSubjectHours
  };
};

// 교사별 시수 통계 계산
export const calculateTeacherStats = (teacherHours: TeacherHoursTracker) => {
  const stats: Record<string, { current: number; max: number; utilization: string }> = {};
  
  Object.keys(teacherHours).forEach(teacherName => {
    const info = teacherHours[teacherName];
    const utilization = info.max > 0 ? ((info.current / info.max) * 100).toFixed(1) : '0.0';
    
    stats[teacherName] = {
      current: info.current,
      max: info.max,
      utilization: `${utilization}%`
    };
  });
  
  return stats;
};

// 학급별 과목 시수 통계 계산
export const calculateClassSubjectStats = (schedule: Schedule) => {
  const stats: Record<string, Record<string, number>> = {};
  
  Object.keys(schedule).forEach(className => {
    stats[className] = getClassSubjectHours(schedule, className);
  });
  
  return stats;
}; 