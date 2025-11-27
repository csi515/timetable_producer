import { Schedule, Teacher, ValidationResult, TimetableData } from '../../types';
import { DAYS, convertClassNameToKey, getCurrentTeacherHours } from '../../utils/helpers';

// 공동수업 제약조건 검증
export const validateCoTeachingConstraints = (
  schedule: Schedule,
  data: TimetableData,
  addLog: (message: string, type?: string) => void
): boolean => {
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
        DAYS.forEach(day => {
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
  
  return violations.length === 0;
};

// 과목 고정 전용 확인
export const checkSubjectFixedOnly = (
  subjectName: string,
  data: TimetableData
): boolean => {
  const subject = data.subjects?.find(s => s.name === subjectName);
  return subject?.fixedOnly === true;
};

// 스케줄 교사 충돌 검증
export const validateScheduleTeacherConflicts = (
  schedule: Schedule,
  addLog: (message: string, type?: string) => void
): boolean => {
  const violations = [];
  const teacherSchedules = {};
  
  // 교사별 스케줄 수집
  Object.keys(schedule).forEach(className => {
    DAYS.forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        schedule[className][day].forEach((slot, periodIndex) => {
          if (slot && typeof slot === 'object' && slot.teachers) {
            const period = periodIndex + 1;
            slot.teachers.forEach(teacherName => {
              if (!teacherSchedules[teacherName]) {
                teacherSchedules[teacherName] = {};
              }
              if (!teacherSchedules[teacherName][day]) {
                teacherSchedules[teacherName][day] = [];
              }
              
              // 이미 해당 시간에 수업이 있는지 확인
              if (teacherSchedules[teacherName][day].includes(period)) {
                violations.push(`${teacherName} 교사 시간 충돌: ${day}요일 ${period}교시`);
              } else {
                teacherSchedules[teacherName][day].push(period);
              }
            });
          }
        });
      }
    });
  });
  
  if (violations.length > 0) {
    addLog(`교사 시간 충돌 ${violations.length}건 발견:`, 'warning');
    violations.forEach(violation => addLog(`  - ${violation}`, 'warning'));
  }
  
  return violations.length === 0;
};

// 블록제 요구사항 확인
export const checkBlockPeriodRequirement = (
  schedule: Schedule,
  className: string,
  day: string,
  period: number,
  teacherName: string,
  data: TimetableData,
  subjectName?: string
): ValidationResult => {
  const teacher = data.teachers?.find(t => t.name === teacherName);
  if (!teacher) {
    return { allowed: true };
  }
  
  // 블록제 제약조건 확인
  const blockConstraints = (data.constraints?.must || []).filter(c => 
    c.type === 'block_period_requirement' && c.subject === teacherName
  );
  
  if (blockConstraints.length === 0) {
    return { allowed: true };
  }
  
  // 블록제 교사는 연속된 두 교시에 배치되어야 함
  const nextPeriod = period + 1;
  const prevPeriod = period - 1;
  
  // 다음 교시나 이전 교시에 같은 교사가 배치되어 있는지 확인
  const hasAdjacentSlot = (
    (schedule[className]?.[day]?.[nextPeriod] && 
     typeof schedule[className][day][nextPeriod] === 'object' && 
     schedule[className][day][nextPeriod].teachers?.includes(teacherName)) ||
    (schedule[className]?.[day]?.[prevPeriod] && 
     typeof schedule[className][day][prevPeriod] === 'object' && 
     schedule[className][day][prevPeriod].teachers?.includes(teacherName))
  );
  
  if (!hasAdjacentSlot) {
    return {
      allowed: false,
      reason: 'block_period_requirement',
      message: `${teacherName} 교사는 블록제 교사로 연속된 두 교시에 배치되어야 합니다.`
    };
  }
  
  return { allowed: true };
};

// 블록제 과목 배치
export const placeBlockPeriodSubject = (
  schedule: Schedule,
  className: string,
  day: string,
  period: number,
  teacherName: string,
  teacher: Teacher,
  data: TimetableData,
  subjectName?: string
): boolean => {
  const subject = subjectName || teacher.subjects[0];
  
  // 현재 교시와 다음 교시에 배치
  schedule[className][day][period] = {
    subject: subject,
    teachers: [teacherName],
    isCoTeaching: false,
    isFixed: false,
    isBlockPeriod: true,
    blockPartner: period + 1
  };
  
  schedule[className][day][period + 1] = {
    subject: subject,
    teachers: [teacherName],
    isCoTeaching: false,
    isFixed: false,
    isBlockPeriod: true,
    blockPartner: period
  };
  
  return true;
};

// 블록제 제약조건 검증
export const validateBlockPeriodConstraints = (
  schedule: Schedule,
  data: TimetableData,
  addLog: (message: string, type?: string) => void
): boolean => {
  const violations = [];
  
  data.teachers?.forEach(teacher => {
    const blockConstraints = (data.constraints?.must || []).filter(c => 
      c.type === 'block_period_requirement' && c.subject === teacher.name
    );
    
    if (blockConstraints.length > 0) {
      // 해당 교사가 블록제로 배치되었는지 확인
      let hasBlockPeriod = false;
      
      Object.keys(schedule).forEach(className => {
        DAYS.forEach(day => {
          if (schedule[className] && schedule[className][day]) {
            schedule[className][day].forEach((slot, periodIndex) => {
              if (slot && typeof slot === 'object' && slot.teachers?.includes(teacher.name) && slot.isBlockPeriod) {
                hasBlockPeriod = true;
              }
            });
          }
        });
      });
      
      if (!hasBlockPeriod) {
        violations.push(`${teacher.name} 교사가 블록제로 배치되지 않았습니다.`);
      }
    }
  });
  
  if (violations.length > 0) {
    addLog(`블록제 제약조건 위반 ${violations.length}건 발견:`, 'warning');
    violations.forEach(violation => addLog(`  - ${violation}`, 'warning'));
  }
  
  return violations.length === 0;
};

// 학년별 순차 수업 배정 확인
export const checkSequentialGradeTeaching = (
  schedule: Schedule,
  teacherName: string,
  day: string,
  period: number,
  className: string,
  data: TimetableData
): ValidationResult => {
  const teacher = data.teachers?.find(t => t.name === teacherName);
  if (!teacher || !teacher.sequential_grade_teaching) {
    return { allowed: true };
  }
  
  const grade = extractGradeFromClassName(className);
  if (grade === null) {
    return { allowed: true };
  }
  
  // 같은 날짜에 다른 학년에서 수업하는지 확인
  const otherGrades = [];
  Object.keys(schedule).forEach(otherClassName => {
    if (otherClassName !== className) {
      const otherGrade = extractGradeFromClassName(otherClassName);
      if (otherGrade !== null && otherGrade !== grade) {
        const otherSlot = schedule[otherClassName]?.[day]?.[period];
        if (otherSlot && typeof otherSlot === 'object' && otherSlot.teachers?.includes(teacherName)) {
          otherGrades.push(otherGrade);
        }
      }
    }
  });
  
  if (otherGrades.length > 0) {
    return {
      allowed: false,
      reason: 'sequential_grade_teaching',
      message: `${teacherName} 교사는 학년별 순차 수업 배정이 적용되어 ${day}요일 ${period}교시에 ${grade}학년과 ${otherGrades.join(', ')}학년에서 동시에 수업할 수 없습니다.`
    };
  }
  
  return { allowed: true };
};

// 학년별 순차 수업 배정 검증
export const validateSequentialGradeTeaching = (
  schedule: Schedule,
  data: TimetableData,
  addLog: (message: string, type?: string) => void
): boolean => {
  const violations = [];
  
  data.teachers?.forEach(teacher => {
    if (teacher.sequential_grade_teaching) {
      const gradeGroups = {};
      
      // 교사별로 학년별 수업 시간을 그룹화
      Object.keys(schedule).forEach(className => {
        const grade = extractGradeFromClassName(className);
        if (grade !== null) {
          DAYS.forEach(day => {
            if (schedule[className] && schedule[className][day]) {
              schedule[className][day].forEach((slot, periodIndex) => {
                if (slot && typeof slot === 'object' && slot.teachers?.includes(teacher.name)) {
                  const period = periodIndex + 1;
                  if (!gradeGroups[grade]) {
                    gradeGroups[grade] = [];
                  }
                  gradeGroups[grade].push(period);
                }
              });
            }
          });
        }
      });
      
      // 학년별 순차 배정 위반 확인
      const violations = checkGradeSequentialViolations(gradeGroups);
      violations.forEach(violation => {
        addLog(`⚠️ ${teacher.name} 교사: ${violation}`, 'warning');
      });
    }
  });
  
  return violations.length === 0;
};

// 학년별 순차 수업 배정 정보 가져오기
export const getSequentialGradeTeachingInfo = (data: TimetableData): string[] => {
  const info = [];
  
  data.teachers?.forEach(teacher => {
    if (teacher.sequential_grade_teaching) {
      info.push(`${teacher.name}: 학년별 순차 수업 배정 적용`);
    }
  });
  
  return info;
};

// 학급명에서 학년 추출
const extractGradeFromClassName = (className: string): number | null => {
  const match = className.match(/(\d+)학년/);
  return match ? parseInt(match[1]) : null;
};

// 학년별 순차 배정 위반 확인
const checkGradeSequentialViolations = (
  gradeGroups: Record<number, number[]>, 
  currentPeriod?: number, 
  currentGrade?: number
): string[] => {
  const violations = [];
  
  // 각 학년별로 연속된 교시가 있는지 확인
  Object.entries(gradeGroups).forEach(([grade, periods]) => {
    const sortedPeriods = periods.sort((a, b) => a - b);
    
    for (let i = 0; i < sortedPeriods.length - 1; i++) {
      if (sortedPeriods[i + 1] - sortedPeriods[i] > 1) {
        violations.push(`${grade}학년: ${sortedPeriods[i]}교시와 ${sortedPeriods[i + 1]}교시 사이에 빈 교시가 있습니다.`);
      }
    }
  });
  
  return violations;
}; 