import { DAYS, generateClassNames, getDefaultWeeklyHours, getCurrentSubjectHours, initializeTeacherHours, convertClassNameToKey, getCurrentTeacherHours, initializeSchedule } from '../utils/helpers';
import { Schedule, TimetableData, Teacher, PlacementPlan, TeacherHoursTracker, GenerationLog, ScheduleSlot } from '../types';
import { validateSlotPlacementStrict, CONSTRAINT_PRIORITY } from './constraints';
import { calculateScheduleStats } from '../utils/statistics';
import { validateTimetableConstraints } from './constraintValidator';
import { createPlacementPlan } from './schedulerCore';
import { findAvailableSlots } from './slotFinder';
import { findAvailableTeachersForSubject } from './teacherAssignment';
import { applyFixedClasses } from './fixedClasses';
import { processCoTeachingConstraints } from './coTeaching';

// 최적화된 배치 계획 실행
const executeOptimizedPlacementPlan = (
  schedule: Schedule,
  placementPlan: PlacementPlan[],
  data: TimetableData,
  teacherHours: any,
  addLog: (message: string, type?: string) => void
): number => {
  let placedCount = 0;
  let retryCount = 0;
  const maxRetries = 5;
  
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
    
    // 3. 교과과목 우선
    const aCategory = aSubject?.category || '교과과목';
    const bCategory = bSubject?.category || '교과과목';
    if (aCategory !== bCategory) {
      return aCategory === '교과과목' ? -1 : 1;
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
          // 제약조건 우선순위에 따른 검증
          let priorityLevel = CONSTRAINT_PRIORITY.CRITICAL;
          
          // 재시도 횟수에 따라 제약조건 우선순위 조정
          if (currentRetry >= 3) {
            priorityLevel = CONSTRAINT_PRIORITY.HIGH; // 3회 이상 재시도 시 중간 우선순위 제약조건 완화
          }
          if (currentRetry >= 4) {
            priorityLevel = CONSTRAINT_PRIORITY.MEDIUM; // 4회 이상 재시도 시 낮은 우선순위 제약조건 완화
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
            
            if (teacherUtilization < 0.7) {
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
        addLog(`✅ ${className} ${day} ${period}교시: ${subject} (${bestTeacher.name}) - 최적화 배치`, 'success');
      } else {
        remainingPlan.push(plan);
        addLog(`⚠️ ${className} ${subject}: 사용 가능한 슬롯이 없어 재시도 예정`, 'warning');
      }
    }
    
    sortedPlan.length = 0;
    sortedPlan.push(...remainingPlan);
    retryCount++;
  }
  
  if (sortedPlan.length > 0) {
    addLog(`❌ 최적화 배치 실패: ${sortedPlan.length}개 과목 배치 실패`, 'error');
    addLog(`💡 해결 방안: 제약조건을 완화하거나 교사/과목 설정을 재검토해주세요.`, 'info');
  }
  
  addLog(`📊 최적화 배치 완료: ${placedCount}개 과목 배치됨`, 'info');
  return placedCount;
};

// 강화된 빈 슬롯 채우기
const fillEmptySlotsOptimized = (
  schedule: Schedule,
  data: TimetableData,
  teacherHours: any,
  addLog: (message: string, type?: string) => void
): number => {
  let filledCount = 0;
  const classNames = Object.keys(schedule);
  
  addLog('🔍 최적화된 빈 슬롯 채우기 시작', 'info');
  
  classNames.forEach(className => {
    DAYS.forEach(day => {
      const maxPeriods = data.base?.periods_per_day?.[day] || 7;
      
      for (let period = 1; period <= maxPeriods; period++) {
        const slotIndex = period - 1;
        const slot = schedule[className]?.[day]?.[slotIndex];
        
        // 빈 슬롯인 경우에만 처리
        if (slot === '' || slot === undefined || slot === null) {
          // 해당 학급에서 부족한 과목들 찾기
          const subjects = data.subjects || [];
          let bestSubject = null;
          let bestTeacher = null;
          let bestScore = -1;
          
          for (const subject of subjects) {
            const currentHours = getCurrentSubjectHours(schedule, className, subject.name);
            const targetHours = subject.weekly_hours || 1;
            
            if (currentHours < targetHours) {
              // 해당 과목을 가르칠 수 있는 교사들 찾기
              const availableTeachers = findAvailableTeachersForSubject(data.teachers || [], subject.name, className, schedule, data);
              
              for (const teacher of availableTeachers) {
                // 강화된 슬롯 검증
                const validation = validateSlotPlacementStrict(
                  schedule, className, day, period, teacher, subject.name, data, addLog, CONSTRAINT_PRIORITY.HIGH
                );
                
                if (validation.allowed) {
                  // 점수 계산 (시수 부족도, 교사 시수 균형 등 고려)
                  let score = 0;
                  
                  // 시수 부족도가 클수록 높은 점수
                  const hoursNeeded = targetHours - currentHours;
                  score += hoursNeeded * 10;
                  
                  // 교사 시수 균형 고려
                  const teacherCurrentHours = teacherHours[teacher.name]?.current || 0;
                  const teacherMaxHours = teacher.max_hours_per_week || teacher.maxHours || 22;
                  const teacherUtilization = teacherCurrentHours / teacherMaxHours;
                  
                  if (teacherUtilization < 0.8) {
                    score += 5; // 시수가 부족한 교사 우선
                  }
                  
                  if (score > bestScore) {
                    bestScore = score;
                    bestSubject = subject;
                    bestTeacher = teacher;
                  }
                }
              }
            }
          }
          
          if (bestSubject && bestTeacher) {
            // 슬롯 배치
            schedule[className][day][slotIndex] = {
              subject: bestSubject.name,
              teachers: [bestTeacher.name],
              isCoTeaching: false,
              isFixed: false
            };
            
            // 교사 시수 업데이트
            if (!teacherHours[bestTeacher.name]) {
              teacherHours[bestTeacher.name] = initializeTeacherHours([bestTeacher]);
            }
            teacherHours[bestTeacher.name].current++;
            
            filledCount++;
            addLog(`✅ ${className} ${day} ${period}교시: ${bestSubject.name} (${bestTeacher.name}) - 최적화 빈 슬롯 채움`, 'success');
          }
        }
      }
    });
  });
  
  addLog(`📊 최적화된 빈 슬롯 채우기 완료: ${filledCount}개 슬롯 채움`, 'info');
  return filledCount;
};

// 최적화된 시간표 생성 함수
export const generateOptimizedTimetable = async (
  data: TimetableData,
  addLog: (message: string, type?: string) => void,
  setProgress?: (progress: number) => void
): Promise<{ schedule: Schedule; teacherHours: any; stats: any; hasErrors: boolean; errorMessage?: string; validationReport?: any }> => {
  try {
    addLog('🚀 최적화된 시간표 생성을 시작합니다.', 'info');
    
    // 사전 검증
    addLog('🔍 사전 제약조건 검증을 시작합니다.', 'info');
    
    // 스케줄 초기화
    const schedule = initializeSchedule(data);
    const teacherHours: any = {};
    
    // 교사별 시수 초기화
    data.teachers?.forEach(teacher => {
      teacherHours[teacher.name] = initializeTeacherHours([teacher]);
    });
    
    if (setProgress) setProgress(10);
    
    // 고정 수업 적용
    addLog('📌 고정 수업을 적용합니다.', 'info');
    const fixedClassesApplied = applyFixedClasses(schedule, data, addLog);
    addLog(`✅ 고정 수업 적용 완료: ${fixedClassesApplied}개 수업`, 'success');
    
    if (setProgress) setProgress(20);
    
    // 공동수업 제약조건 처리
    addLog('👥 공동수업 제약조건을 처리합니다.', 'info');
    const coTeachingApplied = processCoTeachingConstraints(schedule, data, teacherHours, addLog);
    addLog(`✅ 공동수업 제약조건 처리 완료: ${coTeachingApplied}개 수업`, 'success');
    
    if (setProgress) setProgress(30);
    
    // 배치 계획 수립
    addLog('📋 배치 계획을 수립합니다.', 'info');
    const placementPlan = createPlacementPlan(schedule, data, addLog);
    addLog(`📋 배치 계획 수립 완료: ${placementPlan.length}개 과목`, 'info');
    
    if (setProgress) setProgress(40);
    
    // 최적화된 배치 계획 실행
    addLog('⚡ 최적화된 배치 계획을 실행합니다.', 'info');
    const placedCount = executeOptimizedPlacementPlan(schedule, placementPlan, data, teacherHours, addLog);
    addLog(`✅ 최적화된 배치 계획 실행 완료: ${placedCount}개 과목 배치됨`, 'success');
    
    if (setProgress) setProgress(60);
    
    // 최적화된 빈 슬롯 채우기
    addLog('🔍 최적화된 빈 슬롯을 채웁니다.', 'info');
    const filledCount = fillEmptySlotsOptimized(schedule, data, teacherHours, addLog);
    addLog(`✅ 최적화된 빈 슬롯 채우기 완료: ${filledCount}개 슬롯 채움`, 'success');
    
    if (setProgress) setProgress(80);
    
    // 종합적인 제약조건 검증
    addLog('🔍 종합적인 제약조건 검증을 수행합니다.', 'info');
    const validationReport = validateTimetableConstraints(schedule, data, addLog);
    
    if (setProgress) setProgress(90);
    
    // 통계 계산
    const stats = calculateScheduleStats(schedule, teacherHours);
    
    if (setProgress) setProgress(100);
    
    return {
      schedule,
      teacherHours,
      stats,
      hasErrors: !validationReport.isValid,
      errorMessage: validationReport.isValid ? undefined : '제약조건 위반 발견',
      validationReport
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    addLog(`❌ 최적화된 시간표 생성 중 오류가 발생했습니다: ${errorMessage}`, 'error');
    return {
      schedule: {},
      teacherHours: {},
      stats: {},
      hasErrors: true,
      errorMessage: errorMessage
    };
  }
}; 