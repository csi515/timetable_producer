import { Schedule, TimetableData, Teacher, PlacementPlan, TeacherHoursTracker, GenerationLog, ScheduleSlot } from '../types';
import { DAYS, generateClassNames, getDefaultWeeklyHours, getCurrentSubjectHours, initializeTeacherHours, convertClassNameToKey, getCurrentTeacherHours } from '../utils/helpers';
import { validateSlotPlacement, checkTeacherUnavailable, validateCoTeachingConstraints, checkSubjectFixedOnly, checkTeacherTimeConflict, validateScheduleTeacherConflicts, checkBlockPeriodRequirement, placeBlockPeriodSubject, validateBlockPeriodConstraints, checkTeacherMutualExclusion, validateTeacherMutualExclusions, checkSequentialGradeTeaching, validateSequentialGradeTeaching } from './constraints';
import { processCoTeachingConstraints } from './coTeaching';
import { findAvailableSlots } from './slotFinder';
import { validateFixedClassesConstraints } from './fixedClasses';
import { findAvailableTeachersForSubject } from './teacherAssignment';

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
  
  // 0. 학급별 주간시수 설정 최우선 (절대 최고 우선순위)
  if (data.classWeeklyHours && data.classWeeklyHours[className]) {
    const classHours = data.classWeeklyHours[className];
    if (typeof classHours === 'object' && classHours[subjectName]) {
      priority += 2000; // 학급별 주간시수 설정은 절대 최고 우선순위
      const targetHours = classHours[subjectName];
      const currentHours = getCurrentSubjectHours(schedule, className, subjectName);
      const remainingHours = targetHours - currentHours;
      
      // 남은 시수가 많을수록 더 높은 우선순위
      priority += remainingHours * 100;
    }
  }
  
  // 1. 블록제 과목 (두 번째 우선순위)
  const subject = data.subjects?.find(s => s.name === subjectName);
  if (subject?.block === true) {
    priority += 1000; // 블록제 과목은 높은 우선순위
  }
  
  // 2. 블록제 교사 우선순위 (세 번째 우선순위)
  const blockPeriodConstraints = data.constraints?.must?.filter(c => c.type === 'block_period_requirement') || [];
  const isBlockPeriodTeacher = availableTeachers.some(teacher => 
    blockPeriodConstraints.some(c => c.subject === teacher.name)
  );
  if (isBlockPeriodTeacher) {
    priority += 500; // 블록제 교사는 높은 우선순위
  }
  
  // 3. 교사 수가 적을수록 높은 우선순위 (배치하기 어려운 과목 우선)
  priority += (10 - Math.min(availableTeachers.length, 10)) * 10;
  
  // 4. 특별실이 필요한 과목 우선순위 증가
  if (subject?.is_space_limited) {
    priority += 20;
  }
  
  // 5. 공동수업이 필요한 과목 우선순위 증가
  if (subject?.requires_co_teaching) {
    priority += 15;
  }
  
  // 6. 학년별 순차 수업 배정 교사 우선순위 증가 (높은 우선순위)
  const isSequentialGradeTeacher = availableTeachers.some(teacher => teacher.sequential_grade_teaching);
  if (isSequentialGradeTeacher) {
    priority += 150; // 학년별 순차 수업 배정 교사는 높은 우선순위
  }
  
  // 7. 주간 시수가 많은 과목 우선순위 증가
  const weeklyHours = subject?.weekly_hours || 1;
  priority += weeklyHours * 2;
  
  // 8. 교사별 학급 담당 우선순위
  const primaryTeachers = availableTeachers.filter(teacher => {
    const classKey = convertClassNameToKey(className);
    return (teacher.classWeeklyHours && teacher.classWeeklyHours[className] > 0) ||
           (teacher.weeklyHoursByGrade && teacher.weeklyHoursByGrade[classKey] > 0);
  });
  
  if (primaryTeachers.length > 0) {
    priority += 50; // 담당 학급이 있는 교사 우선
  }
  
  // 9. 교사 시수 부족도 우선순위
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
  try {
    const subjects = data.subjects || [];
    const teachers = data.teachers || [];
    const classNames = Object.keys(schedule);
    const subjectPlacementPlan: PlacementPlan[] = [];
    const defaultWeeklyHours = getDefaultWeeklyHours();

    // 입력 데이터 검증
    if (!Array.isArray(subjects) || !Array.isArray(teachers) || classNames.length === 0) {
      addLog('⚠️ 배치 계획 수립: 필수 데이터가 누락되었습니다.', 'warning');
      return [];
    }

    // 교사별 현재 시수 추적
    const teacherCurrentHours: Record<string, number> = {};
    teachers.forEach(teacher => {
      teacherCurrentHours[teacher.name] = getCurrentTeacherHours(schedule, teacher.name, undefined, data);
    });

    classNames.forEach(className => {
      subjects.forEach(subject => {
        // 학급별 주간시수 설정을 최우선으로 확인
        let targetHours = 0;
        let shouldPlaceSubject = false;
        let isClassWeeklyHoursSetting = false; // 학급별 주간시수 설정 여부
        
        // 1. 학급별 주간시수 설정에서 해당 과목의 시수 확인 (최우선)
        if (data.classWeeklyHours && data.classWeeklyHours[className]) {
          const classHours = data.classWeeklyHours[className];
          if (typeof classHours === 'object' && classHours[subject.name]) {
            targetHours = classHours[subject.name];
            shouldPlaceSubject = true; // 설정된 학급에만 배치
            isClassWeeklyHoursSetting = true; // 학급별 주간시수 설정임을 표시
            addLog(`📊 ${className} ${subject.name}: 학급별 주간시수 설정 ${targetHours}시간 적용 (최우선)`, 'info');
          }
        }
        
        // 2. 학급별 주간시수 설정에 없으면 교사별 학급 시수 확인
        if (targetHours === 0) {
          const teachersForSubject = teachers.filter(t => t.subjects && t.subjects.includes(subject.name));
          let maxCalculatedHours = 0;
          
          teachersForSubject.forEach(teacher => {
            const classKey = convertClassNameToKey(className);
            const teacherHours = teacher.weeklyHoursByGrade?.[classKey] || 0;
            
            // 0시간으로 설정된 학급은 제외 (강화된 제약조건)
            if (teacherHours === 0) {
              addLog(`⚠️ ${teacher.name} 교사는 ${className}에서 ${subject.name} 과목을 0시간으로 설정되어 있어 배정하지 않습니다.`, 'warning');
              return;
            }
            
            maxCalculatedHours = Math.max(maxCalculatedHours, teacherHours);
          });
          
          if (maxCalculatedHours > 0) {
            targetHours = maxCalculatedHours;
            shouldPlaceSubject = true; // 교사별 시수가 설정된 경우 배치
            addLog(`📊 ${className} ${subject.name}: 교사별 학급 시수 ${maxCalculatedHours}시간 적용`, 'info');
          }
        }
        
        // 3. 위 두 설정에 없으면 기본 과목 시수 사용 (단, 학급별 설정이 없는 경우에만)
        if (targetHours === 0 && !data.classWeeklyHours?.[className]) {
          targetHours = subject.weekly_hours || defaultWeeklyHours[subject.name] || 1;
          shouldPlaceSubject = true; // 학급별 설정이 없는 경우에만 기본 시수 사용
          addLog(`📊 ${className} ${subject.name}: 기본 과목 시수 ${targetHours}시간 적용`, 'info');
        }
        
        // 학급별 주간시수 설정이 있는데 해당 과목이 설정되지 않은 경우 배치하지 않음
        if (!shouldPlaceSubject) {
          addLog(`⚠️ ${className} ${subject.name}: 학급별 주간시수 설정에 해당 과목이 없어 배치하지 않습니다.`, 'warning');
          return; // 해당 과목을 배치하지 않음
        }
        
        // 현재 배치된 시수 계산
        const currentHours = getCurrentSubjectHours(schedule, className, subject.name);
        
        // 배치해야 할 시수 계산
        const remainingHours = targetHours - currentHours;
        
        if (remainingHours > 0) {
          // 해당 과목을 가르칠 수 있는 교사들 찾기 (강화된 검증 적용)
          const availableTeachers = findAvailableTeachersForSubject(teachers, subject.name, className, schedule, data);
          
          if (availableTeachers.length > 0) {
            // 우선순위 계산
            const priority = calculatePlacementPriority(className, subject.name, availableTeachers, data, schedule);
            
            subjectPlacementPlan.push({
              className,
              subject: subject.name,
              availableTeachers,
              priority,
              targetHours, // 목표 시수 추가
              currentHours, // 현재 시수 추가
              remainingHours, // 남은 시수 추가
              isClassWeeklyHoursSetting // 학급별 주간시수 설정 여부 추가
            });
          } else {
            addLog(`⚠️ ${className} ${subject.name}: 가르칠 수 있는 교사가 없습니다.`, 'warning');
          }
        } else if (remainingHours < 0) {
          // 초과 배치된 경우 경고
          addLog(`⚠️ ${className} ${subject.name}: 목표 시수 초과 배치됨 (목표: ${targetHours}시간, 현재: ${currentHours}시간)`, 'warning');
        }
      });
    });

    // 우선순위에 따라 정렬 (학급별 주간시수 설정이 최우선)
    subjectPlacementPlan.sort((a, b) => b.priority - a.priority);
    
    addLog(`📋 배치 계획 수립 완료: ${subjectPlacementPlan.length}개 과목`, 'info');
    return subjectPlacementPlan;
  } catch (error) {
    addLog(`❌ 배치 계획 수립 중 오류 발생: ${error}`, 'error');
    return [];
  }
}; 