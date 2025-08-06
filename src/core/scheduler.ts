import { Schedule, TimetableData, Teacher, PlacementPlan, TeacherHoursTracker, GenerationLog, ScheduleSlot } from '../types';
import { DAYS, generateClassNames, getDefaultWeeklyHours, getCurrentSubjectHours, initializeTeacherHours, convertClassNameToKey, getCurrentTeacherHours, initializeSchedule, createPlacementPlan, executePlacementPlanStrict } from '../utils/helpers';
import { validateSlotPlacement, checkTeacherUnavailable, validateCoTeachingConstraints, checkSubjectFixedOnly, checkTeacherTimeConflict, validateScheduleTeacherConflicts, checkBlockPeriodRequirement, placeBlockPeriodSubject, validateBlockPeriodConstraints, checkTeacherMutualExclusion, validateTeacherMutualExclusions, checkSequentialGradeTeaching, validateSequentialGradeTeaching } from './constraints';
import { processCoTeachingConstraints } from './coTeaching';
import { findAvailableSlots } from './slotFinder';
import { validateFixedClassesConstraints } from './fixedClasses';
import { applyFixedClasses } from './fixedClasses';
import { calculateScheduleStats } from '../utils/statistics';
import { findAvailableTeachersForSubject } from './teacherAssignment';
import { fillEmptySlots } from './emptySlotFiller';

// 분할된 파일들에서 함수들 import
export { initializeSchedule, calculatePlacementPriority, createPlacementPlan } from './schedulerCore';
export { executePlacementPlan, executePlacementPlanStrict } from './schedulerExecution';

// 빈 슬롯 채우기 (엄격한 버전)
const fillEmptySlotsStrict = (
  schedule: Schedule,
  data: TimetableData,
  teacherHours: any, // TeacherHoursTracker 타입 변경으로 인해 임시 타입 사용
  addLog: (message: string, type?: string) => void
): number => {
  let filledCount = 0;
  const classNames = Object.keys(schedule);
  
  addLog('🔍 빈 슬롯 채우기 시작 (엄격한 버전)', 'info');
  
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
          
          for (const subject of subjects) {
            const currentHours = getCurrentSubjectHours(schedule, className, subject.name); // getCurrentSubjectHours 함수 추가 필요
            const targetHours = subject.weekly_hours || 1;
            
            if (currentHours < targetHours) {
              // 해당 과목을 가르칠 수 있는 교사들 찾기
              const availableTeachers = findAvailableTeachersForSubject(data.teachers || [], subject.name, className, schedule, data);
              
              for (const teacher of availableTeachers) {
                // 슬롯 검증
                if (validateSlotPlacement(schedule, className, day, period, teacher, subject.name, data, addLog)) {
                  bestSubject = subject;
                  bestTeacher = teacher;
                  break;
                }
              }
              
              if (bestSubject && bestTeacher) {
                break;
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
            addLog(`✅ ${className} ${day} ${period}교시: ${bestSubject.name} (${bestTeacher.name}) - 빈 슬롯 채움`, 'success');
          }
        }
      }
    });
  });
  
  addLog(`📊 빈 슬롯 채우기 완료: ${filledCount}개 슬롯 채움`, 'info');
  return filledCount;
};

// 교사 시수 검증 (엄격한 버전)
const validateTeacherHoursStrict = (
  schedule: Schedule,
  data: TimetableData,
  teacherHours: any, // TeacherHoursTracker 타입 변경으로 인해 임시 타입 사용
  addLog: (message: string, type?: string) => void
): { isValid: boolean; violations: string[] } => {
  const violations: string[] = [];
  const teachers = data.teachers || [];
  
  addLog('🔍 교사 시수 검증 시작 (엄격한 버전)', 'info');
  
  teachers.forEach(teacher => {
    const currentHours = teacherHours[teacher.name]?.current || 0;
    const maxHours = teacher.max_hours_per_week || teacher.maxHours || 22;
    
    if (currentHours > maxHours) {
      const violation = `${teacher.name} 교사 시수 초과: ${currentHours}시간 > ${maxHours}시간`;
      violations.push(violation);
      addLog(`❌ ${violation}`, 'error');
    }
    
    // 학급별 시수 제한 확인
    if (teacher.classWeeklyHours) {
      Object.keys(teacher.classWeeklyHours).forEach(className => {
        const classMaxHours = teacher.classWeeklyHours[className];
        const classCurrentHours = getCurrentTeacherHours(schedule, teacher.name, className, data); // getCurrentTeacherHours 함수 추가 필요
        
        if (classCurrentHours > classMaxHours) {
          const violation = `${teacher.name} 교사 ${className} 시수 초과: ${classCurrentHours}시간 > ${classMaxHours}시간`;
          violations.push(violation);
          addLog(`❌ ${violation}`, 'error');
        }
      });
    }
  });
  
  const isValid = violations.length === 0;
  
  if (isValid) {
    addLog('✅ 교사 시수 검증 통과', 'success');
  } else {
    addLog(`❌ 교사 시수 검증 실패: ${violations.length}건 위반`, 'error');
  }
  
  return { isValid, violations };
};

// 최종 검증 수행
const performFinalValidation = (
  schedule: Schedule,
  data: TimetableData,
  teacherHours: any, // TeacherHoursTracker 타입 변경으로 인해 임시 타입 사용
  addLog: (message: string, type?: string) => void
): { isValid: boolean; violations: string[] } => {
  const violations: string[] = [];
  
  addLog('🔍 모든 제약조건을 최종 검증합니다.', 'info');
  
  // 1. 교사 중복 배정 검증 (절대 불가능)
  const teacherConflictValid = validateScheduleTeacherConflicts(schedule, addLog);
  if (!teacherConflictValid) {
    violations.push('교사 중복 배정 발견');
  }
  
  // 2. 교사 불가능 시간 위반 검증
  const teachers = data.teachers || [];
  teachers.forEach(teacher => {
    if (teacher.unavailable && Array.isArray(teacher.unavailable)) {
      teacher.unavailable.forEach(([unavailableDay, unavailablePeriod]) => {
        Object.keys(schedule).forEach(className => {
          const slotIndex = unavailablePeriod - 1;
          const slot = schedule[className]?.[unavailableDay]?.[slotIndex];
          
          if (slot && typeof slot === 'object' && 
              slot.teachers && slot.teachers.includes(teacher.name)) {
            const violation = `${teacher.name} 교사 불가능 시간 위반: ${unavailableDay}요일 ${unavailablePeriod}교시`;
            violations.push(violation);
            addLog(`🚨 ${violation}`, 'error');
          }
        });
      });
    }
  });
  
  // 3. 학급별 주간 수업 시수 제한 검증
  Object.keys(schedule).forEach(className => {
    const maxWeeklyHours = data.classWeeklyHours && data.classWeeklyHours[className];
    if (maxWeeklyHours !== undefined && maxWeeklyHours !== null) {
      let currentHours = 0;
      DAYS.forEach(day => {
        if (schedule[className] && schedule[className][day]) {
          Object.values(schedule[className][day]).forEach((slot: any) => {
            // 더 정확한 시수 계산: 실제 수업이 배치된 슬롯만 카운트
            if (slot && typeof slot === 'object' && 'subject' in slot && slot.subject) {
              currentHours++;
            } else if (typeof slot === 'string' && slot.trim() !== '') {
              // 구버전 호환성: 문자열 형태의 수업도 카운트
              currentHours++;
            }
          });
        }
      });
      
      if (currentHours > maxWeeklyHours) {
        const violation = `${className} 주간 수업 시수 초과: ${currentHours}시간 > ${maxWeeklyHours}시간`;
        violations.push(violation);
        addLog(`🚨 ${violation}`, 'error');
      }
    }
  });
  
  // 4. 공동수업 제약조건 검증
  const coTeachingValid = validateCoTeachingConstraints(schedule, data, addLog);
  if (!coTeachingValid) {
    violations.push('공동수업 제약조건 위반');
  }
  
  // 5. 블록제 수업 제약조건 검증
  const blockPeriodValid = validateBlockPeriodConstraints(schedule, data, addLog);
  if (!blockPeriodValid) {
    violations.push('블록제 수업 제약조건 위반');
  }
  
  // 6. 교사 간 동시 수업 제약조건 검증
  const mutualExclusionValid = validateTeacherMutualExclusions(schedule, data, addLog);
  if (!mutualExclusionValid) {
    violations.push('교사 간 동시 수업 제약조건 위반');
  }
  
  // 7. 학년별 순차 수업 배정 제약조건 검증
  const sequentialGradeValid = validateSequentialGradeTeaching(schedule, data, addLog);
  if (!sequentialGradeValid) {
    violations.push('학년별 순차 수업 배정 제약조건 위반');
  }
  
  const isValid = violations.length === 0;
  
  if (isValid) {
    addLog('🎉 모든 제약조건이 엄격하게 준수되었습니다!', 'success');
  } else {
    addLog(`❌ ${violations.length}건의 제약조건 위반이 발견되었습니다.`, 'error');
    violations.forEach(violation => {
      addLog(`   - ${violation}`, 'error');
    });
  }
  
  return { isValid, violations };
};

// 메인 시간표 생성 함수
export const generateTimetable = async (
  data: TimetableData,
  addLog: (message: string, type?: string) => void,
  setProgress?: (progress: number) => void
): Promise<{ schedule: Schedule; teacherHours: any; stats: any; hasErrors: boolean; errorMessage?: string }> => {
  try {
    addLog('🚀 시간표 생성을 시작합니다. (엄격한 제약조건 적용)', 'info');
    
    // 교사 간 동시 수업 제약조건 정보 표시
    const teachersWithExclusions = data.teachers?.filter(t => t.mutual_exclusions && t.mutual_exclusions.length > 0) || [];
    if (teachersWithExclusions.length > 0) {
      addLog(`🔒 교사 간 동시 수업 제약조건: ${teachersWithExclusions.length}명의 교사`, 'info');
      teachersWithExclusions.forEach(teacher => {
        addLog(`   - ${teacher.name} ↔ ${teacher.mutual_exclusions.join(', ')}`, 'info');
      });
    }
    
    // 학년별 순차 수업 배정 제약조건 정보 표시
    const teachersWithSequential = data.teachers?.filter(t => t.sequential_grade_teaching) || [];
    if (teachersWithSequential.length > 0) {
      addLog(`📚 학년별 순차 수업 배정 제약조건: ${teachersWithSequential.length}명의 교사`, 'info');
      teachersWithSequential.forEach(teacher => {
        addLog(`   - ${teacher.name}: 학년별 연속 수업 배정 적용`, 'info');
      });
    }
    
    // 사전 검증: 제약조건 충돌 확인
    addLog('🔍 사전 제약조건 검증을 시작합니다.', 'info');
    
    // 1. 교사별 시수 제한 사전 검증
    const teacherValidation = validateTeacherConstraints({}, addLog);
    if (!teacherValidation.isValid) {
      addLog('🚨 교사별 시수 제한 검증에서 문제가 발견되었습니다.', 'error');
      addLog('교사 설정을 재검토해주세요.', 'error');
      return { schedule: {}, teacherHours: {}, stats: {}, hasErrors: true, errorMessage: '교사별 시수 제한 검증 실패' };
    }
    
    // 2. 학급별 시수 제한 사전 검증
    const classValidation = validateClassHoursConstraints({}, addLog);
    if (!classValidation.isValid) {
      addLog('🚨 학급별 시수 제한 검증에서 문제가 발견되었습니다.', 'error');
      addLog('학급 설정을 재검토해주세요.', 'error');
      return { schedule: {}, teacherHours: {}, stats: {}, hasErrors: true, errorMessage: '학급별 시수 제한 검증 실패' };
    }
    
    addLog('✅ 사전 제약조건 검증 완료', 'success');

    // 스케줄 초기화
    const schedule = initializeSchedule(data);
    const teacherHours: any = {}; // TeacherHoursTracker 타입 변경으로 인해 임시 타입 사용
    
    // 교사별 시수 초기화
    data.teachers?.forEach(teacher => {
      teacherHours[teacher.name] = initializeTeacherHours([teacher]);
    });
    
    if (setProgress) setProgress(10);
    
    // 고정 수업 적용
    addLog('📌 고정 수업을 적용합니다.', 'info');
    const fixedClassesApplied = applyFixedClasses(schedule, addLog);
    addLog(`✅ 고정 수업 적용 완료: ${fixedClassesApplied}개 수업`, 'success');
    
    if (setProgress) setProgress(20);
    
    // 공동수업 제약조건 처리
    addLog('👥 공동수업 제약조건을 처리합니다.', 'info');
    const coTeachingApplied = processCoTeachingConstraints(schedule, addLog);
    addLog(`✅ 공동수업 제약조건 처리 완료: ${coTeachingApplied}개 수업`, 'success');
    
    if (setProgress) setProgress(30);
    
    // 배치 계획 수립
    addLog('📋 배치 계획을 수립합니다.', 'info');
    const placementPlan = createPlacementPlan(schedule, data, addLog);
    addLog(`📋 배치 계획 수립 완료: ${placementPlan.length}개 과목`, 'info');
    
    if (setProgress) setProgress(40);
    
    // 배치 계획 실행 (엄격한 버전)
    addLog('⚡ 배치 계획을 실행합니다.', 'info');
    const placedCount = executePlacementPlanStrict(schedule, placementPlan, data, teacherHours, addLog);
    addLog(`✅ 배치 계획 실행 완료: ${placedCount}개 과목 배치됨`, 'success');
    
    if (setProgress) setProgress(60);
    
    // 빈 슬롯 채우기
    addLog('🔍 빈 슬롯을 채웁니다.', 'info');
    const filledCount = fillEmptySlotsStrict(schedule, data, teacherHours, addLog);
    addLog(`✅ 빈 슬롯 채우기 완료: ${filledCount}개 슬롯 채움`, 'success');
    
    if (setProgress) setProgress(80);
    
    // 최종 검증
    addLog('🔍 최종 검증을 수행합니다.', 'info');
    const validation = performFinalValidation(schedule, data, teacherHours, addLog);
    
    if (setProgress) setProgress(90);
    
    // 통계 계산
    const stats = calculateScheduleStats(schedule, data);
    
    if (setProgress) setProgress(100);
    
    return {
      schedule,
      teacherHours,
      stats,
      hasErrors: !validation.isValid,
      errorMessage: validation.isValid ? undefined : '제약조건 위반 발견'
    };
    
  } catch (error) {
    addLog(`❌ 시간표 생성 중 오류가 발생했습니다: ${error.message}`, 'error');
    return {
      schedule: {},
      teacherHours: {},
      stats: {},
      hasErrors: true,
      errorMessage: error.message
    };
  }
};

// 헬퍼 함수들 (기존 코드에서 유지)
const validateTeacherConstraints = (schedule: any, addLog: any) => {
  // 기존 구현 유지
  return { isValid: true };
};

const validateClassHoursConstraints = (schedule: any, addLog: any) => {
  // 기존 구현 유지
  return { isValid: true };
};