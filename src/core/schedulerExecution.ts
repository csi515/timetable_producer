import { Schedule, TimetableData, Teacher, PlacementPlan, TeacherHoursTracker, GenerationLog, ScheduleSlot } from '../types';
import { DAYS, generateClassNames, getDefaultWeeklyHours, getCurrentSubjectHours, initializeTeacherHours, convertClassNameToKey, getCurrentTeacherHours, initializeSchedule } from '../utils/helpers';
import { validateSlotPlacement, validateSlotPlacementStrict, checkTeacherUnavailable, validateCoTeachingConstraints, checkSubjectFixedOnly, checkTeacherTimeConflict, validateScheduleTeacherConflicts, checkBlockPeriodRequirement, placeBlockPeriodSubject, validateBlockPeriodConstraints, checkTeacherMutualExclusion, validateTeacherMutualExclusions, checkSequentialGradeTeaching, validateSequentialGradeTeaching, CONSTRAINT_PRIORITY } from './constraints';
import { processCoTeachingConstraints } from './coTeaching';
import { findAvailableSlots } from './slotFinder';
import { validateFixedClassesConstraints } from './fixedClasses';
import { validateTeacherAssignment } from './teacherAssignment';

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
      const availableSlots = findAvailableSlots(schedule, className, teacher, subject, data, false);
      
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
          teacherHours[bestTeacher.name] = {
            current: 0,
            max: bestTeacher.max_hours_per_week || bestTeacher.maxHours || 22,
            subjects: {}
          };
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

// 배치 계획 실행 (강화된 엄격한 버전)
export const executePlacementPlanStrict = (
  schedule: Schedule,
  placementPlan: PlacementPlan[],
  data: TimetableData,
  teacherHours: TeacherHoursTracker,
  addLog: (message: string, type?: string) => void
): number => {
  let placedCount = 0;
  let retryCount = 0;
  const maxRetries = 5; // 재시도 횟수 증가
  
  addLog(`📋 강화된 엄격한 배치 계획 실행 시작: ${placementPlan.length}개 과목`, 'info');
  
  while (placementPlan.length > 0 && retryCount < maxRetries) {
    const remainingPlan = [];
    const currentRetry = retryCount + 1;
    
    addLog(`🔄 재시도 ${currentRetry}/${maxRetries}: ${placementPlan.length}개 과목 처리 중...`, 'info');
    
    for (const plan of placementPlan) {
      const { className, subject, availableTeachers, isClassWeeklyHoursSetting, targetHours, currentHours, remainingHours } = plan;
      
      // 학급별 주간시수 설정이 있는 경우 특별 처리
      if (isClassWeeklyHoursSetting && targetHours !== undefined && remainingHours !== undefined) {
        addLog(`🎯 학급별 주간시수 설정 처리: ${className} ${subject} (목표: ${targetHours}시간, 현재: ${currentHours}시간, 남은: ${remainingHours}시간)`, 'info');
        
        // 목표 시수에 도달한 경우 스킵
        if (remainingHours <= 0) {
          addLog(`✅ ${className} ${subject}: 목표 시수 달성 (${targetHours}시간)`, 'success');
          continue;
        }
      }
      
      // 블록제 과목인지 확인
      const subjectData = data.subjects?.find(s => s.name === subject);
      const isBlockSubject = subjectData?.block === true;
      
      // 블록제 교사인지 확인
      const blockPeriodConstraints = data.constraints?.must?.filter(c => c.type === 'block_period_requirement') || [];
      const isBlockPeriodTeacher = availableTeachers.some(teacher => 
        blockPeriodConstraints.some(c => c.subject === teacher.name)
      );
      
      let placed = false;
      
      // 블록제 과목/교사인 경우 특별 처리
      if (isBlockSubject || isBlockPeriodTeacher) {
        addLog(`🔗 블록제 과목/교사 처리: ${subject} (${className})`, 'info');
        
        // 블록제 교사 중에서 해당 과목을 가르칠 수 있는 교사 찾기
        const blockTeachers = availableTeachers.filter(teacher => 
          blockPeriodConstraints.some(c => c.subject === teacher.name) ||
          (isBlockSubject && teacher.subjects.includes(subject))
        );
        
        for (const teacher of blockTeachers) {
          // 홀수 교시에서만 블록제 배치 시도
          for (const day of DAYS) {
            const maxPeriods = data.base?.periods_per_day?.[day] || 7;
            
            for (let period = 1; period <= maxPeriods - 1; period += 2) { // 홀수 교시만
              // 블록제 배치 시도
              if (placeBlockPeriodSubject(schedule, className, day, period, teacher.name, teacher, data, subject)) {
                // 교사 시수 업데이트 (블록제는 2시간으로 계산)
                if (!teacherHours[teacher.name]) {
                  teacherHours[teacher.name] = {
                    current: 0,
                    max: teacher.max_hours_per_week || teacher.maxHours || 22,
                    subjects: {}
                  };
                }
                teacherHours[teacher.name].current += 2; // 블록제는 2시간
                
                placedCount += 2; // 블록제는 2시간으로 계산
                placed = true;
                addLog(`✅ 블록제 배치 성공: ${className} ${day} ${period}-${period + 1}교시: ${subject} (${teacher.name})`, 'success');
                break;
              }
            }
            if (placed) break;
          }
          if (placed) break;
        }
      }
      
      // 일반 과목 처리 (블록제가 아닌 경우 또는 블록제 배치 실패한 경우)
      if (!placed) {
        // 해당 과목을 가르칠 수 있는 교사들 중에서 최적의 교사 선택
        let bestTeacher = null;
        let bestSlot = null;
        
        for (const teacher of availableTeachers) {
          // 교사별로 사용 가능한 슬롯 찾기
          const availableSlots = findAvailableSlots(schedule, className, teacher, subject, data, false);
          
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
          
          // 슬롯 검증 (강화된 검증)
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
              teacherHours[bestTeacher.name] = {
                current: 0,
                max: bestTeacher.max_hours_per_week || bestTeacher.maxHours || 22,
                subjects: {}
              };
            }
            teacherHours[bestTeacher.name].current++;
            
            placedCount++;
            placed = true;
            addLog(`✅ ${className} ${day} ${period}교시: ${subject} (${bestTeacher.name})`, 'success');
          } else {
            addLog(`❌ ${className} ${subject} 배치 실패: 제약조건 위반`, 'error');
          }
        } else {
          addLog(`❌ ${className} ${subject}: 사용 가능한 슬롯이 없습니다.`, 'error');
        }
      }
      
      // 배치되지 않은 과목은 다음 재시도에 포함
      if (!placed) {
        remainingPlan.push(plan);
      }
    }
    
    placementPlan = remainingPlan;
    retryCount++;
  }
  
  if (placementPlan.length > 0) {
    addLog(`⚠️ 배치 실패: ${placementPlan.length}개 과목이 배치되지 않았습니다.`, 'warning');
  }
  
  addLog(`📊 강화된 엄격한 배치 완료: ${placedCount}개 과목 배치됨`, 'info');
  return placedCount;
};

// 최적화된 배치 계획 실행 (새로운 버전)
export const executePlacementPlanOptimized = (
  schedule: Schedule,
  placementPlan: PlacementPlan[],
  data: TimetableData,
  teacherHours: TeacherHoursTracker,
  addLog: (message: string, type?: string) => void
): number => {
  // placementPlan이 배열인지 검증
  if (!Array.isArray(placementPlan)) {
    addLog(`❌ 배치 계획이 배열이 아닙니다: ${typeof placementPlan}`, 'error');
    return 0;
  }
  
  if (placementPlan.length === 0) {
    addLog('⚠️ 배치할 과목이 없습니다.', 'warning');
    return 0;
  }
  
  let placedCount = 0;
  let retryCount = 0;
  const maxRetries = 5; // 재시도 횟수 증가
  
  addLog(`🚀 최적화된 배치 계획 실행 시작: ${placementPlan.length}개 과목`, 'info');
  
  // 배치 계획을 우선순위에 따라 정렬
  const sortedPlan = [...placementPlan].sort((a, b) => {
    // 1. 공간 제한이 있는 과목 우선
    const aSubject = data.subjects?.find(s => s.name === a.subject);
    const bSubject = data.subjects?.find(s => s.name === b.subject);
    const aSpaceLimited = aSubject?.is_space_limited || false;
    const bSpaceLimited = bSubject?.is_space_limited || false;
    
    if (aSpaceLimited !== bSpaceLimited) {
      return bSpaceLimited ? 1 : -1; // 공간 제한이 있는 과목을 먼저 배치
    }
    
    // 2. 시수가 많은 과목 우선
    const aHours = aSubject?.weekly_hours || 1;
    const bHours = bSubject?.weekly_hours || 1;
    if (aHours !== bHours) {
      return bHours - aHours; // 시수가 많은 과목을 먼저 배치
    }
    
    // 3. 블록제 수업 우선
    const aIsBlock = aSubject?.block || false;
    const bIsBlock = bSubject?.block || false;
    if (aIsBlock !== bIsBlock) {
      return bIsBlock ? 1 : -1; // 블록제 수업을 먼저 배치
    }
    
    return 0;
  });
  
  while (sortedPlan.length > 0 && retryCount < maxRetries) {
    const remainingPlan = [];
    const currentRetry = retryCount + 1;
    
    addLog(`🔄 최적화 재시도 ${currentRetry}/${maxRetries}: ${sortedPlan.length}개 과목 처리 중...`, 'info');
    
    for (const plan of sortedPlan) {
      const { className, subject, availableTeachers } = plan;
      
      // 교사 우선순위 정렬 (시수 부족한 교사 우선)
      const sortedTeachers = [...availableTeachers].sort((a, b) => {
        const aHours = teacherHours[a.name]?.current || 0;
        const bHours = teacherHours[b.name]?.current || 0;
        const aMaxHours = a.max_hours_per_week || a.maxHours || 22;
        const bMaxHours = b.max_hours_per_week || b.maxHours || 22;
        const aUtilization = aHours / aMaxHours;
        const bUtilization = bHours / bMaxHours;
        
        return aUtilization - bUtilization; // 시수 부족한 교사 우선
      });
      
      let bestTeacher = null;
      let bestSlot = null;
      let bestScore = -1;
      
      for (const teacher of sortedTeachers) {
        const availableSlots = findAvailableSlots(schedule, className, teacher, subject, data, false, false);
        
        for (const slot of availableSlots) {
          // 제약조건 우선순위에 따른 검증 (재시도 횟수에 따라 완화)
          let priorityLevel = CONSTRAINT_PRIORITY.CRITICAL;
          
          if (currentRetry >= 2) {
            priorityLevel = CONSTRAINT_PRIORITY.HIGH; // 2회 이상 재시도 시 높은 우선순위 제약조건까지 완화
          }
          if (currentRetry >= 3) {
            priorityLevel = CONSTRAINT_PRIORITY.MEDIUM; // 3회 이상 재시도 시 중간 우선순위 제약조건까지 완화
          }
          if (currentRetry >= 4) {
            priorityLevel = CONSTRAINT_PRIORITY.LOW; // 4회 이상 재시도 시 낮은 우선순위 제약조건까지 완화
          }
          
          const validation = validateSlotPlacementStrict(
            schedule, className, slot.day, slot.period, teacher, subject, data, addLog, priorityLevel
          );
          
          if (validation.allowed) {
            // 슬롯 점수 계산
            let score = 0;
            
            // 좋은 시간대 우선 (1-4교시)
            if (slot.period >= 1 && slot.period <= 4) {
              score += 10;
            }
            
            // 교사 시수 균형 고려
            const teacherCurrentHours = teacherHours[teacher.name]?.current || 0;
            const teacherMaxHours = teacher.max_hours_per_week || teacher.maxHours || 22;
            const teacherUtilization = teacherCurrentHours / teacherMaxHours;
            
            if (teacherUtilization < 0.8) {
              score += 5; // 시수가 부족한 교사 우선
            }
            
            // 제약조건 위반이 적을수록 높은 점수
            score += (5 - validation.priority) * 2;
            
            if (score > bestScore) {
              bestScore = score;
              bestTeacher = teacher;
              bestSlot = slot;
            }
          }
        }
      }
      
      if (bestTeacher && bestSlot) {
        const { day, period } = bestSlot;
        const slotIndex = period - 1;
        
        // 엄격한 검증 수행
        const validation = validateSlotPlacementStrict(
          schedule, className, day, period, bestTeacher, subject, data, addLog, CONSTRAINT_PRIORITY.CRITICAL
        );
        
        if (validation.allowed) {
          // 블록제 수업인지 확인
          const isBlockPeriod = checkBlockPeriodRequirement(
            schedule, className, day, period, bestTeacher.name, data, subject
          ).allowed;
          
          // 슬롯 배치
          schedule[className][day][slotIndex] = {
            subject: subject,
            teachers: [bestTeacher.name],
            isCoTeaching: false,
            isFixed: false,
            isBlockPeriod: isBlockPeriod
          };
          
          // 블록제 수업인 경우 다음 교시도 배치
          if (isBlockPeriod) {
            const nextSlotIndex = period;
            const maxPeriods = data.base?.periods_per_day?.[day] || 7;
            
            if (period + 1 <= maxPeriods) {
              schedule[className][day][nextSlotIndex] = {
                subject: subject,
                teachers: [bestTeacher.name],
                isCoTeaching: false,
                isFixed: false,
                isBlockPeriod: true,
                blockPartner: period
              };
              
              addLog(`✅ ${className} ${day} ${period}-${period + 1}교시: ${subject} (${bestTeacher.name}) - 블록제 수업 배치`, 'success');
            }
          } else {
            addLog(`✅ ${className} ${day} ${period}교시: ${subject} (${bestTeacher.name}) - 최적화 배치`, 'success');
          }
          
          // 교사 시수 업데이트
          if (!teacherHours[bestTeacher.name]) {
            teacherHours[bestTeacher.name] = {
              current: 0,
              max: bestTeacher.max_hours_per_week || bestTeacher.maxHours || 22,
              subjects: {}
            };
          }
          teacherHours[bestTeacher.name].current++;
          
          placedCount++;
        } else {
          remainingPlan.push(plan);
          addLog(`⚠️ ${className} ${subject}: 제약조건 위반으로 재시도 예정 (${validation.violations.length}개 위반)`, 'warning');
        }
      } else {
        remainingPlan.push(plan);
        addLog(`⚠️ ${className} ${subject}: 사용 가능한 슬롯이 없어 재시도 예정`, 'warning');
      }
    }
    
    sortedPlan.length = 0;
    sortedPlan.push(...remainingPlan);
    retryCount++;
    
    if (remainingPlan.length > 0) {
      addLog(`📊 재시도 ${currentRetry} 완료: ${placedCount}개 배치, ${remainingPlan.length}개 남음`, 'info');
    }
  }
  
  if (sortedPlan.length > 0) {
    addLog(`❌ 최대 재시도 횟수 초과: ${sortedPlan.length}개 과목 배치 실패`, 'error');
    addLog(`💡 해결 방안: 제약조건을 완화하거나 교사/과목 설정을 재검토해주세요.`, 'info');
  }
  
  addLog(`📊 최적화된 배치 완료: ${placedCount}개 과목 배치됨`, 'info');
  return placedCount;
}; 