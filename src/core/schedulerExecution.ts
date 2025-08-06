import { Schedule, TimetableData, Teacher, PlacementPlan, TeacherHoursTracker, GenerationLog, ScheduleSlot } from '../types';
import { DAYS, generateClassNames, getDefaultWeeklyHours, getCurrentSubjectHours, initializeTeacherHours, convertClassNameToKey, getCurrentTeacherHours, initializeSchedule } from '../utils/helpers';
import { validateSlotPlacement, checkTeacherUnavailable, validateCoTeachingConstraints, checkSubjectFixedOnly, checkTeacherTimeConflict, validateScheduleTeacherConflicts, checkBlockPeriodRequirement, placeBlockPeriodSubject, validateBlockPeriodConstraints, checkTeacherMutualExclusion, validateTeacherMutualExclusions, checkSequentialGradeTeaching, validateSequentialGradeTeaching } from './constraints';
import { processCoTeachingConstraints } from './coTeaching';
import { findAvailableSlots } from './slotFinder';
import { validateFixedClassesConstraints } from './fixedClasses';

// 배치 계획 실행 (기본 버전)
export const executePlacementPlan = (
  schedule: Schedule,
  placementPlan: PlacementPlan[],
  data: TimetableData,
  teacherHours: TeacherHoursTracker,
  addLog: (message: string, type?: string) => void
): number => {
  let placedCount = 0;
  
  addLog(`📋 배치 계획 실행 시작: ${placementPlan.length}개 과목`, 'info');
  
  for (const plan of placementPlan) {
    const { className, subject, availableTeachers } = plan;
    
    // 해당 과목을 가르칠 수 있는 교사들 중에서 최적의 교사 선택
    let bestTeacher = null;
    let bestSlot = null;
    
    for (const teacher of availableTeachers) {
      // 교사별로 사용 가능한 슬롯 찾기
      const availableSlots = findAvailableSlots(schedule, className, teacher, subject, false);
      
      if (availableSlots.length > 0) {
        // 첫 번째 사용 가능한 슬롯 선택
        bestTeacher = teacher;
        bestSlot = availableSlots[0];
        break;
      }
    }
    
    if (bestTeacher && bestSlot) {
      // 슬롯에 과목 배치
      const { day, period } = bestSlot;
      const slotIndex = period - 1;
      
      // 슬롯 검증
      if (validateSlotPlacement(schedule, className, day, period, bestTeacher, subject, data, addLog)) {
        // 슬롯 배치
        schedule[className][day][slotIndex] = {
          subject: subject,
          teachers: [bestTeacher.name],
          isCoTeaching: false,
          isFixed: false
        };
        
                  // 교사 시수 업데이트
          if (!teacherHours[bestTeacher.name]) {
            teacherHours[bestTeacher.name] = initializeTeacherHours([bestTeacher]);
          }
        teacherHours[bestTeacher.name].current++;
        
        placedCount++;
        addLog(`✅ ${className} ${day} ${period}교시: ${subject} (${bestTeacher.name})`, 'success');
      } else {
        addLog(`❌ ${className} ${subject} 배치 실패: 제약조건 위반`, 'error');
      }
    } else {
      addLog(`❌ ${className} ${subject}: 사용 가능한 슬롯이 없습니다.`, 'error');
    }
  }
  
  addLog(`📊 배치 완료: ${placedCount}/${placementPlan.length}개 과목 배치됨`, 'info');
  return placedCount;
};

// 배치 계획 실행 (엄격한 버전)
export const executePlacementPlanStrict = (
  schedule: Schedule,
  placementPlan: PlacementPlan[],
  data: TimetableData,
  teacherHours: TeacherHoursTracker,
  addLog: (message: string, type?: string) => void
): number => {
  let placedCount = 0;
  let retryCount = 0;
  const maxRetries = 3;
  
  addLog(`📋 엄격한 배치 계획 실행 시작: ${placementPlan.length}개 과목`, 'info');
  
  while (placementPlan.length > 0 && retryCount < maxRetries) {
    const remainingPlan = [];
    
    for (const plan of placementPlan) {
      const { className, subject, availableTeachers } = plan;
      
      // 해당 과목을 가르칠 수 있는 교사들 중에서 최적의 교사 선택
      let bestTeacher = null;
      let bestSlot = null;
      let bestScore = -1;
      
      for (const teacher of availableTeachers) {
        // 교사별로 사용 가능한 슬롯 찾기
        const availableSlots = findAvailableSlots(schedule, className, teacher, subject, data, false, false);
        
        for (const slot of availableSlots) {
          // 슬롯 점수 계산 (교시, 요일 등 고려)
          let score = 0;
          
          // 좋은 시간대 우선 (1-4교시)
          if (slot.period >= 1 && slot.period <= 4) {
            score += 10;
          }
          
          // 교사 시수 균형 고려
          const teacherCurrentHours = teacherHours[teacher.name]?.current || 0;
          const teacherMaxHours = teacher.max_hours_per_week || teacher.maxHours || 22;
          const teacherUtilization = teacherCurrentHours / teacherMaxHours;
          
          if (teacherUtilization < 0.7) {
            score += 5; // 시수가 부족한 교사 우선
          }
          
          if (score > bestScore) {
            bestScore = score;
            bestTeacher = teacher;
            bestSlot = slot;
          }
        }
      }
      
      if (bestTeacher && bestSlot) {
        // 슬롯에 과목 배치
        const { day, period } = bestSlot;
        const slotIndex = period - 1;
        
        // 슬롯 검증
        if (validateSlotPlacement(schedule, className, day, period, bestTeacher, subject, data, addLog)) {
          // 슬롯 배치
          schedule[className][day][slotIndex] = {
            subject: subject,
            teachers: [bestTeacher.name],
            isCoTeaching: false,
            isFixed: false
          };
          
          // 교사 시수 업데이트
          if (!teacherHours[bestTeacher.name]) {
            teacherHours[bestTeacher.name] = initializeTeacherHours([bestTeacher]);
          }
          teacherHours[bestTeacher.name].current++;
          
          placedCount++;
          addLog(`✅ ${className} ${day} ${period}교시: ${subject} (${bestTeacher.name})`, 'success');
        } else {
          remainingPlan.push(plan);
          addLog(`⚠️ ${className} ${subject}: 제약조건 위반으로 재시도 예정`, 'warning');
        }
      } else {
        remainingPlan.push(plan);
        addLog(`⚠️ ${className} ${subject}: 사용 가능한 슬롯이 없어 재시도 예정`, 'warning');
      }
    }
    
    placementPlan = remainingPlan;
    retryCount++;
    
    if (placementPlan.length > 0) {
      addLog(`🔄 재시도 ${retryCount}/${maxRetries}: ${placementPlan.length}개 과목 남음`, 'info');
    }
  }
  
  if (placementPlan.length > 0) {
    addLog(`❌ 최대 재시도 횟수 초과: ${placementPlan.length}개 과목 배치 실패`, 'error');
  }
  
  addLog(`📊 엄격한 배치 완료: ${placedCount}개 과목 배치됨`, 'info');
  return placedCount;
}; 