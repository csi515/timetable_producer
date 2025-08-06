import { Schedule, Teacher, Subject, ValidationResult, TeacherHoursTracker, TimetableData } from '../types';

export const DAYS = ['월', '화', '수', '목', '금'];

// 학급 이름을 키 형태로 변환 (예: "3학년 1반" -> "3학년-1")
export const convertClassNameToKey = (className: string): string => {
  const match = className.match(/(\d+)학년\s+(\d+)반/);
  if (match) {
    return `${match[1]}학년-${match[2]}`;
  }
  return className;
};

// 학급 이름 목록 생성
export const generateClassNames = (data: TimetableData): string[] => {
  const classNames: string[] = [];
  const grades = data.base?.grades || 3;
  const classesPerGrade = data.base?.classes_per_grade || [];

  // grades가 숫자인 경우 배열로 변환
  const gradeArray = Array.isArray(grades) ? grades : Array.from({ length: grades }, (_, i) => i + 1);

  gradeArray.forEach((grade: number) => {
    const classCount = classesPerGrade[grade - 1] || 0;
    for (let classNum = 1; classNum <= classCount; classNum++) {
      classNames.push(`${grade}학년 ${classNum}반`);
    }
  });

  return classNames;
};

// 과목별 기본 주간 시수
export const getDefaultWeeklyHours = (): Record<string, number> => ({
  '국어': 5, '수학': 5, '과학': 4, '영어': 4,
  '역사': 3, '사회': 3, '체육': 3,
  '도덕': 2, '기술가정': 2, '음악': 2, '미술': 2,
  '정보': 1, '원어민': 1, '보건': 1, '진로와직업': 1,
  '동아리': 1, '스포츠': 1
});

// 현재 과목 시수 계산
export const getCurrentSubjectHours = (schedule: Schedule, className: string, subjectName: string): number => {
  let hours = 0;
  if (!schedule[className]) return hours;
  
  DAYS.forEach(day => {
    if (schedule[className][day]) {
      Object.values(schedule[className][day]).forEach(slot => {
        if (slot && typeof slot === 'object' && 'subject' in slot && slot.subject === subjectName) {
          hours++;
        }
      });
    }
  });
  return hours;
};

// 교사별 현재 시수 계산 (교과과목만)
export const getCurrentTeacherHours = (
  schedule: Schedule, 
  teacherName: string, 
  specificClassName?: string,
  data?: TimetableData
): number => {
  let hours = 0;
  
  Object.keys(schedule).forEach(className => {
    if (specificClassName && className !== specificClassName) {
      return;
    }
    
    DAYS.forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        Object.values(schedule[className][day]).forEach(slot => {
          if (slot && typeof slot === 'object' && 'teachers' in slot && slot.teachers.includes(teacherName)) {
            // 교과과목만 계산 (data가 제공된 경우)
            if (data && slot.subject) {
              const subject = data.subjects?.find(s => s.name === slot.subject);
              if (subject && subject.category === '창의적 체험활동') {
                return; // 창의적 체험활동은 제외
              }
            }
            hours++;
          }
        });
      }
    });
  });
  return hours;
};

// 학급별 과목 시수 계산
export const getClassSubjectHours = (schedule: Schedule, className: string): Record<string, number> => {
  const subjectHours: Record<string, number> = {};
  
  if (schedule[className]) {
    DAYS.forEach(day => {
      if (schedule[className][day]) {
        Object.values(schedule[className][day]).forEach(slot => {
          if (slot && typeof slot === 'object' && 'subject' in slot && typeof slot.subject === 'string') {
            subjectHours[slot.subject] = (subjectHours[slot.subject] || 0) + 1;
          }
        });
      }
    });
  }
  
  return subjectHours;
};

// 교사 시수 추적기 초기화
export const initializeTeacherHours = (teachers: Teacher[]): TeacherHoursTracker => {
  const teacherHours: TeacherHoursTracker = {};
  
  teachers.forEach(teacher => {
    teacherHours[teacher.name] = {
      current: 0,
      max: teacher.maxHours || 25,
      subjects: {},
      classHours: {}
    };
    
    // 학급별 시수 초기화
    if (teacher.weeklyHoursByGrade) {
      Object.keys(teacher.weeklyHoursByGrade).forEach(classKey => {
        teacherHours[teacher.name].classHours![classKey] = {
          current: 0,
          max: teacher.weeklyHoursByGrade[classKey]
        };
      });
    }
    
    if (teacher.classWeeklyHours) {
      Object.keys(teacher.classWeeklyHours).forEach(className => {
        teacherHours[teacher.name].classHours![className] = {
          current: 0,
          max: teacher.classWeeklyHours[className]
        };
      });
    }
  });
  
  return teacherHours;
};

// 0시간 설정 학급 확인
export const isClassDisabled = (className: string, data: TimetableData): boolean => {
  return data.classWeeklyHours && data.classWeeklyHours[className] === 0;
};

// 수업 배치 전 최종 안전 확인
export const canPlaceClassInSchedule = (className: string, data: TimetableData): boolean => {
  return !isClassDisabled(className, data);
};

// 로그 메시지 생성
export const createLogMessage = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
  return {
    message: `[${new Date().toLocaleTimeString()}] ${message}`,
    type,
    timestamp: new Date()
  };
};

// 스케줄 초기화 함수
export const initializeSchedule = (data: TimetableData): Schedule => {
  const schedule: Schedule = {};
  const classNames = generateClassNames(data);
  const periodsPerDay = data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };

  classNames.forEach(className => {
    schedule[className] = {};
    DAYS.forEach(day => {
      const maxPeriods = periodsPerDay[day] || 7;
      schedule[className][day] = {};
      for (let period = 1; period <= maxPeriods; period++) {
        schedule[className][day][period] = undefined;
      }
    });
  });

  return schedule;
};

// 배치 계획 생성 함수
export const createPlacementPlan = (
  className: string,
  subject: string,
  availableTeachers: Teacher[],
  priority: number
) => {
  return {
    className,
    subject,
    availableTeachers,
    priority
  };
};

// 배치 계획 실행 함수 (엄격한 제약조건)
export const executePlacementPlanStrict = (
  schedule: Schedule,
  placementPlan: any,
  data: TimetableData,
  teacherHours: TeacherHoursTracker,
  addLog: (message: string, type?: string) => void
): boolean => {
  const { className, subject, availableTeachers } = placementPlan;
  
  // 사용 가능한 슬롯 찾기
  const availableSlots = findAvailableSlots(schedule, className, availableTeachers[0], subject);
  
  if (availableSlots.length === 0) {
    addLog(`경고: ${className} ${subject} 수업을 배치할 수 있는 슬롯이 없습니다.`, 'warning');
    return false;
  }

  // 첫 번째 사용 가능한 슬롯에 배치
  const selectedSlot = availableSlots[0];
  
  // 슬롯 배치
  schedule[className][selectedSlot.day][selectedSlot.period] = {
    subject: subject,
    teachers: [availableTeachers[0].name],
    isCoTeaching: false,
    isFixed: false,
    source: 'placement_plan'
  };

  // 교사 시수 업데이트
  if (!teacherHours[availableTeachers[0].name]) {
    teacherHours[availableTeachers[0].name] = {
      current: 0,
      max: availableTeachers[0].maxHours || 25,
      subjects: {}
    };
  }
  teacherHours[availableTeachers[0].name].current++;
  
  if (!teacherHours[availableTeachers[0].name].subjects[subject]) {
    teacherHours[availableTeachers[0].name].subjects[subject] = 0;
  }
  teacherHours[availableTeachers[0].name].subjects[subject]++;

  addLog(`✅ ${className} ${selectedSlot.day}요일 ${selectedSlot.period}교시 ${subject} 배치 완료 (${availableTeachers[0].name})`, 'success');
  return true;
};

// 사용 가능한 슬롯 찾기 함수
export const findAvailableSlots = (
  schedule: Schedule,
  className: string,
  teacher: Teacher,
  subjectName: string
): Array<{ day: string; period: number }> => {
  const availableSlots: Array<{ day: string; period: number }> = [];
  
  DAYS.forEach(day => {
    if (schedule[className] && schedule[className][day]) {
      Object.entries(schedule[className][day]).forEach(([periodStr, slot]) => {
        const period = parseInt(periodStr);
        
        // 빈 슬롯인 경우
        if (!slot) {
          // 교사 수업 불가 시간 확인
          const isUnavailable = teacher.unavailable?.some(([unavailableDay, unavailablePeriod]) => 
            unavailableDay === day && unavailablePeriod === period
          );
          
          if (!isUnavailable) {
            availableSlots.push({ day, period });
          }
        }
      });
    }
  });
  
  return availableSlots;
};

// 특정 과목을 가르칠 수 있는 교사들 찾기
export const findAvailableTeachersForSubject = (
  subjectName: string,
  teachers: Teacher[],
  schedule: Schedule,
  className: string,
  day: string,
  period: number
): Teacher[] => {
  return teachers.filter(teacher => {
    // 해당 과목을 가르칠 수 있는지 확인
    if (!teacher.subjects.includes(subjectName)) {
      return false;
    }
    
    // 해당 시간에 수업 불가능한지 확인
    const isUnavailable = teacher.unavailable?.some(([unavailableDay, unavailablePeriod]) => 
      unavailableDay === day && unavailablePeriod === period
    );
    
    if (isUnavailable) {
      return false;
    }
    
    // 해당 시간에 다른 학급에서 수업 중인지 확인
    const hasConflict = Object.keys(schedule).some(otherClassName => {
      if (otherClassName === className) return false;
      
      const otherSlot = schedule[otherClassName]?.[day]?.[period];
      if (otherSlot && typeof otherSlot === 'object' && 'teachers' in otherSlot) {
        return otherSlot.teachers.includes(teacher.name);
      }
      return false;
    });
    
    return !hasConflict;
  });
}; 