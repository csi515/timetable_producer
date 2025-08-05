import { Schedule, TimetableData, TeacherHoursTracker } from '../types';
import { initializeTeacherHours } from '../utils/helpers';
import { applyFixedClasses, validateFixedClassesConstraints } from './fixedClasses';
import { processCoTeachingConstraints } from './coTeaching';
import { calculateScheduleStats } from '../utils/statistics';

// 스케줄 초기화
export const initializeSchedule = (data: TimetableData): Schedule => {
  const schedule: Schedule = {};
  const classNames = generateClassNames(data);
  const periodsPerDay = data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };

  classNames.forEach(className => {
    // 0시간 설정 학급은 스케줄에서 제외
    if (data.classWeeklyHours && data.classWeeklyHours[className] === 0) {
      return;
    }

    schedule[className] = {};
    ['월', '화', '수', '목', '금'].forEach(day => {
      const maxPeriods = periodsPerDay[day] || 7;
      schedule[className][day] = {};
      
      for (let period = 0; period < maxPeriods; period++) {
        schedule[className][day][period] = '';
      }
    });
  });

  return schedule;
};

// 학급 이름 생성
const generateClassNames = (data: TimetableData): string[] => {
  const classNames: string[] = [];
  const grades = data.base?.grades || 3;
  const classesPerGrade = data.base?.classes_per_grade || [4, 4, 4];

  for (let grade = 1; grade <= grades; grade++) {
    const classCount = classesPerGrade[grade - 1] || 4;
    for (let classNum = 1; classNum <= classCount; classNum++) {
      classNames.push(`${grade}학년 ${classNum}반`);
    }
  }

  return classNames;
};

// 메인 시간표 생성 함수
export const generateTimetable = async (
  data: TimetableData,
  addLog: (message: string, type?: string) => void,
  setProgress?: (progress: number) => void
): Promise<{ schedule: Schedule; teacherHours: TeacherHoursTracker; stats: any; hasErrors: boolean; errorMessage?: string }> => {
  addLog('🚀 시간표 생성을 시작합니다.', 'info');
  setProgress?.(10);

  let hasErrors = false;
  let errorMessage = '';
  let placedCount = 0;
  let filledSlots = 0;
  let blockPeriodCount = 0;
  let coTeachingCount = 0;

  try {
    // 1단계: 스케줄 초기화
    addLog('1단계: 스케줄을 초기화합니다.', 'info');
    const schedule = initializeSchedule(data);
    setProgress?.(20);

    // 2단계: 교사 시수 추적기 초기화
    addLog('2단계: 교사 시수를 추적합니다.', 'info');
    const teacherHours = initializeTeacherHours(data.teachers || []);
    setProgress?.(30);

    // 3단계: 고정 수업 적용
    addLog('3단계: 고정 수업을 먼저 적용합니다.', 'info');
    const fixedCount = applyFixedClasses(schedule, data, addLog);
    addLog(`✅ 고정 수업 ${fixedCount}개 적용 완료`, 'success');
    
    // 고정 수업 제약조건 검증
    addLog('3b단계: 고정 수업 적용 후 제약조건 검증을 수행합니다.', 'info');
    const fixedClassValidation = validateFixedClassesConstraints(schedule, data, teacherHours);
    if (!fixedClassValidation.isValid) {
      addLog('🚨 고정 수업으로 인한 제약조건 위반이 발견되었습니다!', 'error');
      addLog(`❌ ${fixedClassValidation.message}`, 'error');
      hasErrors = true;
      errorMessage = `고정 수업 제약조건 위반: ${fixedClassValidation.message}`;
    } else {
      addLog('✅ 고정 수업 제약조건 검증 완료', 'success');
    }
    setProgress?.(40);

    // 4단계: 공동수업 제약조건 처리
    if (!hasErrors) {
      addLog('4단계: 공동수업을 배치합니다.', 'info');
      coTeachingCount = processCoTeachingConstraints(schedule, data, teacherHours, addLog);
      addLog(`✅ 공동수업 ${coTeachingCount}개 배치 완료`, 'success');
      setProgress?.(50);
    }

    // 5단계: 기본 배치 (간단한 버전)
    if (!hasErrors) {
      addLog('5단계: 기본 수업을 배치합니다.', 'info');
      placedCount = performBasicPlacement(schedule, data, teacherHours, addLog);
      addLog(`✅ 기본 수업 ${placedCount}개 배치 완료`, 'success');
      setProgress?.(70);
    }

    // 6단계: 통계 계산
    addLog('6단계: 통계를 계산합니다.', 'info');
    const stats = calculateScheduleStats(schedule, teacherHours);
    setProgress?.(100);

    if (hasErrors) {
      addLog(`⚠️ 시간표 생성 중 오류가 발생했습니다: ${errorMessage}`, 'warning');
      addLog('📊 부분적으로 생성된 시간표를 확인할 수 있습니다.', 'info');
    } else {
      addLog(`🎉 시간표 생성 완료: ${placedCount + filledSlots + blockPeriodCount + coTeachingCount}개 수업 배치`, 'success');
    }

    return { schedule, teacherHours, stats, hasErrors, errorMessage };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    addLog(`시간표 생성 중 오류가 발생했습니다: ${errorMessage}`, 'error');
    return {
      schedule: {},
      teacherHours: {},
      stats: {},
      hasErrors: true,
      errorMessage: errorMessage
    };
  }
};

// 기본 배치 함수 (간단한 버전)
const performBasicPlacement = (
  schedule: Schedule,
  data: TimetableData,
  teacherHours: TeacherHoursTracker,
  addLog: (message: string, type?: string) => void
): number => {
  let placedCount = 0;
  
  // 간단한 배치 로직
  Object.keys(schedule).forEach(className => {
    ['월', '화', '수', '목', '금'].forEach(day => {
      Object.keys(schedule[className][day]).forEach(periodStr => {
        const period = parseInt(periodStr);
        const slot = schedule[className][day][period];
        
        if (slot === '') {
          // 빈 슬롯에 기본 과목 배치
          const availableSubjects = data.subjects || [];
          if (availableSubjects.length > 0) {
            const subject = availableSubjects[0];
            const availableTeachers = data.teachers?.filter(t => 
              t.subjects.indexOf(subject.name) !== -1
            ) || [];
            
            if (availableTeachers.length > 0) {
              const teacher = availableTeachers[0];
              schedule[className][day][period] = {
                subject: subject.name,
                teachers: [teacher.name],
                isCoTeaching: false,
                isFixed: false
              };
              placedCount++;
            }
          }
        }
      });
    });
  });
  
  return placedCount;
}; 