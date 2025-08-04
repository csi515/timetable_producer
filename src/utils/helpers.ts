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

// 교사별 현재 시수 계산
export const getCurrentTeacherHours = (
  schedule: Schedule, 
  teacherName: string, 
  specificClassName?: string
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
    message,
    type,
    timestamp: new Date()
  };
}; 