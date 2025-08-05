import { Teacher, Schedule, TimetableData } from '../types';
import { convertClassNameToKey } from '../utils/helpers';

// 과목을 가르칠 수 있는 교사들 찾기 (2단계 전략)
export const findAvailableTeachersForSubject = (
  teachers: Teacher[],
  subjectName: string,
  className: string,
  schedule: Schedule,
  data: TimetableData
): Teacher[] => {
  // 1단계: 명시적으로 해당 학급을 담당하는 교사들
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

    return true;
  });

  if (primaryTeachers.length > 0) {
    return primaryTeachers;
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

    return true;
  });

  // 3단계: 완전히 배치 불가능한 경우, 과목을 가르칠 수 있는 모든 교사 (응급 배치)
  if (secondaryTeachers.length === 0) {
    const emergencyTeachers = teachers.filter(teacher => {
      const teacherSubjects = teacher.subjects || [];
      return teacherSubjects.includes(subjectName);
    });
    
    if (emergencyTeachers.length > 0) {
      // 응급 교사들을 가용성에 따라 우선순위 정렬
      const sortedEmergencyTeachers = emergencyTeachers.sort((a, b) => {
        // 수업 불가 시간이 적은 교사 우선
        const aUnavailableCount = a.unavailable ? a.unavailable.length : 0;
        const bUnavailableCount = b.unavailable ? b.unavailable.length : 0;
        
        if (aUnavailableCount !== bUnavailableCount) {
          return aUnavailableCount - bUnavailableCount;
        }
        
        // 최대 시수가 높은 교사 우선
        const aMaxHours = a.maxHours || 18;
        const bMaxHours = b.maxHours || 18;
        return bMaxHours - aMaxHours;
      });
      
      console.warn(`⚠️ ${className} ${subjectName}: 제한적 교사 확장 검색 (${sortedEmergencyTeachers.length}명, 최우선: ${sortedEmergencyTeachers[0].name})`);
      return sortedEmergencyTeachers;
    }
  }

  return secondaryTeachers;
}; 