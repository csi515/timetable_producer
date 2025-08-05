import { Teacher, Schedule, TimetableData } from '../types';
import { convertClassNameToKey } from '../utils/helpers';

// 과목을 가르칠 수 있는 교사들 찾기 (3단계 전략)
export const findAvailableTeachersForSubject = (
  teachers: Teacher[],
  subjectName: string,
  className: string,
  schedule: Schedule,
  data: TimetableData
): Teacher[] => {
  // 1단계: 명시적으로 해당 학급을 담당하는 교사들 (최우선)
  const primaryTeachers = teachers.filter(teacher => {
    const teacherSubjects = teacher.subjects || [];
    if (!teacherSubjects.includes(subjectName)) {
      return false;
    }

    const classKey = convertClassNameToKey(className);
    const hasClassAssignment = (teacher.classWeeklyHours && teacher.classWeeklyHours[className] > 0) ||
                              (teacher.weeklyHoursByGrade && teacher.weeklyHoursByGrade[classKey] > 0);

    if (!hasClassAssignment) {
      return false;
    }

    // 교사가 해당 학급에서 이미 최대 시수에 도달했는지 확인
    const currentHours = getCurrentTeacherHours(schedule, teacher.name, className, data);
    const maxHours = teacher.classWeeklyHours?.[className] || 
                    teacher.weeklyHoursByGrade?.[classKey] || 
                    teacher.max_hours_per_week || 
                    22;
    
    if (currentHours >= maxHours) {
      return false;
    }

    return true;
  });

  if (primaryTeachers.length > 0) {
    // 우선순위 정렬: 시수가 적은 교사 우선
    return primaryTeachers.sort((a, b) => {
      const aHours = getCurrentTeacherHours(schedule, a.name, className, data);
      const bHours = getCurrentTeacherHours(schedule, b.name, className, data);
      return aHours - bHours;
    });
  }

  // 2단계: 해당 과목을 가르칠 수 있는 모든 교사들 (명시적으로 금지되지 않은 경우)
  const secondaryTeachers = teachers.filter(teacher => {
    const teacherSubjects = teacher.subjects || [];
    if (!teacherSubjects.includes(subjectName)) {
      return false;
    }

    // 0시간으로 설정된 학급은 제외
    const classKey = convertClassNameToKey(className);
    const hasZeroHours = (teacher.classWeeklyHours && teacher.classWeeklyHours[className] === 0) ||
                        (teacher.weeklyHoursByGrade && teacher.weeklyHoursByGrade[classKey] === 0);

    if (hasZeroHours) {
      return false;
    }

    // 교사 전체 시수 제한 확인
    const currentTotalHours = getCurrentTeacherHours(schedule, teacher.name, undefined, data);
    const maxTotalHours = teacher.max_hours_per_week || teacher.maxHours || 22;
    
    if (currentTotalHours >= maxTotalHours) {
      return false;
    }

    return true;
  });

  if (secondaryTeachers.length > 0) {
    // 우선순위 정렬: 전체 시수가 적고, 불가능 시간이 적은 교사 우선
    return secondaryTeachers.sort((a, b) => {
      const aTotalHours = getCurrentTeacherHours(schedule, a.name, undefined, data);
      const bTotalHours = getCurrentTeacherHours(schedule, b.name, undefined, data);
      
      if (aTotalHours !== bTotalHours) {
        return aTotalHours - bTotalHours;
      }
      
      const aUnavailableCount = a.unavailable ? a.unavailable.length : 0;
      const bUnavailableCount = b.unavailable ? b.unavailable.length : 0;
      return aUnavailableCount - bUnavailableCount;
    });
  }

  // 3단계: 완전히 배치 불가능한 경우, 과목을 가르칠 수 있는 모든 교사 (응급 배치)
  const emergencyTeachers = teachers.filter(teacher => {
    const teacherSubjects = teacher.subjects || [];
    return teacherSubjects.includes(subjectName);
  });
  
  if (emergencyTeachers.length > 0) {
    // 응급 교사들을 가용성에 따라 우선순위 정렬
    const sortedEmergencyTeachers = emergencyTeachers.sort((a, b) => {
      // 전체 시수가 적은 교사 우선
      const aTotalHours = getCurrentTeacherHours(schedule, a.name, undefined, data);
      const bTotalHours = getCurrentTeacherHours(schedule, b.name, undefined, data);
      
      if (aTotalHours !== bTotalHours) {
        return aTotalHours - bTotalHours;
      }
      
      // 수업 불가 시간이 적은 교사 우선
      const aUnavailableCount = a.unavailable ? a.unavailable.length : 0;
      const bUnavailableCount = b.unavailable ? b.unavailable.length : 0;
      
      if (aUnavailableCount !== bUnavailableCount) {
        return aUnavailableCount - bUnavailableCount;
      }
      
      // 최대 시수가 높은 교사 우선
      const aMaxHours = a.max_hours_per_week || a.maxHours || 18;
      const bMaxHours = b.max_hours_per_week || b.maxHours || 18;
      return bMaxHours - aMaxHours;
    });
    
    console.warn(`⚠️ ${className} ${subjectName}: 응급 교사 배정 (${sortedEmergencyTeachers.length}명, 최우선: ${sortedEmergencyTeachers[0].name})`);
    return sortedEmergencyTeachers;
  }

  return [];
};

// 교사별 현재 시수 계산 (학급별 또는 전체)
const getCurrentTeacherHours = (
  schedule: Schedule, 
  teacherName: string, 
  className?: string, 
  data?: TimetableData
): number => {
  let totalHours = 0;
  
  Object.keys(schedule).forEach(classKey => {
    // 특정 학급만 계산하는 경우
    if (className && classKey !== className) {
      return;
    }
    
    const classSchedule = schedule[classKey];
    if (!classSchedule) return;
    
    Object.keys(classSchedule).forEach(day => {
      const daySchedule = classSchedule[day];
      if (!daySchedule) return;
      
      Object.values(daySchedule).forEach(slot => {
        if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.includes(teacherName)) {
          // 창의적 체험활동은 시수에서 제외 (선택적)
          if (data && slot.subject) {
            const subject = data.subjects?.find(s => s.name === slot.subject);
            if (subject && subject.category === '창의적 체험활동') {
              return; // 시수 계산에서 제외
            }
          }
          totalHours++;
        }
      });
    });
  });
  
  return totalHours;
}; 