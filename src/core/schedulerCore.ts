import { Schedule, TimetableData, Teacher, PlacementPlan, TeacherHoursTracker, GenerationLog, ScheduleSlot } from '../types';
import { DAYS, generateClassNames, getDefaultWeeklyHours, getCurrentSubjectHours, initializeTeacherHours, convertClassNameToKey, getCurrentTeacherHours, findAvailableTeachersForSubject } from '../utils/helpers';
import { validateSlotPlacement, checkTeacherUnavailable, validateCoTeachingConstraints, checkSubjectFixedOnly, checkTeacherTimeConflict, validateScheduleTeacherConflicts, checkBlockPeriodRequirement, placeBlockPeriodSubject, validateBlockPeriodConstraints, checkTeacherMutualExclusion, validateTeacherMutualExclusions, checkSequentialGradeTeaching, validateSequentialGradeTeaching } from './constraints';
import { processCoTeachingConstraints } from './coTeaching';
import { findAvailableSlots } from './slotFinder';
import { validateFixedClassesConstraints } from './fixedClasses';

// 스케줄 초기화
export const initializeSchedule = (data: TimetableData): Schedule => {
  const schedule: Schedule = {};
  const classNames = generateClassNames(data);
  const periodsPerDay = data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };

  classNames.forEach(className => {
    // 0시간 설정 학급은 스케줄에서 제외 (classWeeklyHours가 없는 경우 포함)
    if (data.classWeeklyHours && data.classWeeklyHours[className] === 0) {
      return;
    }

    schedule[className] = {};
    DAYS.forEach(day => {
      const maxPeriods = periodsPerDay[day] || 7;
      schedule[className][day] = {};
      
      for (let period = 0; period < maxPeriods; period++) {
        schedule[className][day][period] = '';
      }
    });
  });

  return schedule;
};

// 배치 우선순위 계산 함수
export const calculatePlacementPriority = (
  className: string,
  subjectName: string,
  availableTeachers: any[],
  data: TimetableData,
  schedule: Schedule
): number => {
  let priority = 0;
  
  // 1. 교사 수가 적을수록 높은 우선순위 (배치하기 어려운 과목 우선)
  priority += (10 - Math.min(availableTeachers.length, 10)) * 10;
  
  // 2. 특별실이 필요한 과목 우선순위 증가
  const subject = data.subjects?.find(s => s.name === subjectName);
  if (subject?.is_space_limited) {
    priority += 20;
  }
  
  // 3. 공동수업이 필요한 과목 우선순위 증가
  if (subject?.requires_co_teaching) {
    priority += 15;
  }
  
  // 4. 블록제 교사 우선순위 증가 (가장 높은 우선순위)
  const blockPeriodConstraints = data.constraints?.must?.filter(c => c.type === 'block_period_requirement') || [];
  const isBlockPeriodTeacher = availableTeachers.some(teacher => 
    blockPeriodConstraints.some(c => c.subject === teacher.name)
  );
  if (isBlockPeriodTeacher) {
    priority += 200; // 블록제 교사는 가장 높은 우선순위 (더욱 강화)
  }
  
  // 5. 학년별 순차 수업 배정 교사 우선순위 증가 (높은 우선순위)
  const isSequentialGradeTeacher = availableTeachers.some(teacher => teacher.sequential_grade_teaching);
  if (isSequentialGradeTeacher) {
    priority += 150; // 학년별 순차 수업 배정 교사는 높은 우선순위
  }
  
  // 6. 주간 시수가 많은 과목 우선순위 증가
  const weeklyHours = subject?.weekly_hours || 1;
  priority += weeklyHours * 2;
  
  // 7. 교사별 학급 담당 우선순위
  const primaryTeachers = availableTeachers.filter(teacher => {
    const classKey = convertClassNameToKey(className);
    return (teacher.classWeeklyHours && teacher.classWeeklyHours[className] > 0) ||
           (teacher.weeklyHoursByGrade && teacher.weeklyHoursByGrade[classKey] > 0);
  });
  
  if (primaryTeachers.length > 0) {
    priority += 50; // 담당 학급이 있는 교사 우선
  }
  
  // 8. 교사 시수 부족도 우선순위
  const teachersWithLowHours = availableTeachers.filter(teacher => {
    const currentHours = getCurrentTeacherHours(schedule, teacher.name, undefined, data);
    const maxHours = teacher.max_hours_per_week || teacher.maxHours || 22;
    return currentHours < maxHours * 0.7; // 70% 미만인 교사
  });
  
  if (teachersWithLowHours.length > 0) {
    priority += 30; // 시수가 부족한 교사 우선
  }
  
  return priority;
};

// 과목별 배치 계획 수립 (교사 시수 제한 고려)
export const createPlacementPlan = (
  schedule: Schedule,
  data: TimetableData,
  addLog: (message: string, type?: string) => void
): PlacementPlan[] => {
  const subjects = data.subjects || [];
  const teachers = data.teachers || [];
  const classNames = Object.keys(schedule);
  const subjectPlacementPlan: PlacementPlan[] = [];
  const defaultWeeklyHours = getDefaultWeeklyHours();

  // 교사별 현재 시수 추적
  const teacherCurrentHours: Record<string, number> = {};
  teachers.forEach(teacher => {
    teacherCurrentHours[teacher.name] = getCurrentTeacherHours(schedule, teacher.name, undefined, data);
  });

  classNames.forEach(className => {
    subjects.forEach(subject => {
      // 더 정확한 시수 계산: 교사별 학급 시수를 우선 고려
      let targetHours = subject.weekly_hours || defaultWeeklyHours[subject.name] || 1;
      
      // 교사별 학급 시수에서 최대값을 사용 (중복 계산 방지)
      const teachersForSubject = teachers.filter(t => t.subjects && t.subjects.includes(subject.name));
      let maxCalculatedHours = 0;
      
      teachersForSubject.forEach(teacher => {
        const classKey = convertClassNameToKey(className);
        const teacherHours = teacher.weeklyHoursByGrade?.[classKey] || 0;
        maxCalculatedHours = Math.max(maxCalculatedHours, teacherHours);
      });
      
      // 계산된 시수가 있으면 우선 사용
      if (maxCalculatedHours > 0) {
        targetHours = maxCalculatedHours;
        addLog(`📊 ${className} ${subject.name}: 최대 교사 시수 ${maxCalculatedHours}시간 적용`, 'info');
      }
      
      // 현재 배치된 시수 계산
      const currentHours = getCurrentSubjectHours(schedule, className, subject.name);
      
      // 배치해야 할 시수 계산
      const remainingHours = targetHours - currentHours;
      
              if (remainingHours > 0) {
          // 해당 과목을 가르칠 수 있는 교사들 찾기
          const availableTeachers = findAvailableTeachersForSubject(teachers, subject.name, className, schedule, data);
          
          if (availableTeachers.length > 0) {
            // 우선순위 계산
            const priority = calculatePlacementPriority(className, subject.name, availableTeachers, data, schedule);
            
            subjectPlacementPlan.push({
              className,
              subject: subject.name,
              availableTeachers,
              priority
            });
          } else {
            addLog(`⚠️ ${className} ${subject.name}: 가르칠 수 있는 교사가 없습니다.`, 'warning');
          }
        }
    });
  });

  // 우선순위에 따라 정렬 (높은 우선순위가 먼저)
  return subjectPlacementPlan.sort((a, b) => b.priority - a.priority);
}; 