import { Schedule, TimetableData, Teacher, PlacementPlan, TeacherHoursTracker, GenerationLog, ScheduleSlot } from '../types';
import { DAYS, generateClassNames, getDefaultWeeklyHours, getCurrentSubjectHours, initializeTeacherHours, convertClassNameToKey, getCurrentTeacherHours } from '../utils/helpers';
import { findAvailableSlots } from './slotFinder';
import { validateSlotPlacement, checkTeacherUnavailable, validateCoTeachingConstraints, checkSubjectFixedOnly, checkTeacherTimeConflict, validateScheduleTeacherConflicts, checkBlockPeriodRequirement, placeBlockPeriodSubject, validateBlockPeriodConstraints, validateAllConstraints, validateAllConstraintsCompliance, generateConstraintViolationReport, debugTimetableConstraints } from './constraints';
import { applyFixedClasses } from './fixedClasses';
import { processCoTeachingConstraints } from './coTeaching';
import { calculateScheduleStats } from '../utils/statistics';
import { findAvailableTeachersForSubject } from './teacherAssignment';
import { fillEmptySlots } from './emptySlotFiller';

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
const calculatePlacementPriority = (
  className: string,
  subjectName: string,
  availableTeachers: any[],
  data: TimetableData
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
  
  // 5. 주간 시수가 많은 과목 우선순위 증가
  const weeklyHours = subject?.weekly_hours || 1;
  priority += weeklyHours * 2;
  
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
    teacherCurrentHours[teacher.name] = getCurrentTeacherHours(schedule, teacher.name);
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
      
      const currentHours = getCurrentSubjectHours(schedule, className, subject.name);
      const remainingHours = targetHours - currentHours;

      if (remainingHours > 0) {
        // 고정수업 전용 과목인지 확인
        if (checkSubjectFixedOnly(subject.name, data)) {
          addLog(`📌 ${subject.name}은 고정수업 전용 과목으로 설정되어 랜덤 배치에서 제외됩니다.`, 'info');
          return; // 이 과목은 고정수업으로만 배치
        }

        // 단계별 교사 찾기 전략
        let availableTeachers = findAvailableTeachersForSubject(teachers, subject.name, className, schedule, data);
        
        if (availableTeachers.length > 0) {
          // 블록제 교사가 있는지 확인
          const blockPeriodConstraints = data.constraints?.must?.filter(c => c.type === 'block_period_requirement') || [];
          const hasBlockPeriodTeacher = availableTeachers.some(teacher => 
            blockPeriodConstraints.some(c => c.subject === teacher.name)
          );
          
          if (hasBlockPeriodTeacher) {
            // 블록제 교사가 있으면 2시간 단위로 배치하므로 remainingHours를 2로 나눈 횟수만큼만 배치 계획 생성
            const blockCount = Math.ceil(remainingHours / 2);
            for (let i = 0; i < blockCount; i++) {
              const basePriority = calculatePlacementPriority(className, subject.name, availableTeachers, data);
              const randomFactor = Math.random() * 0.1;
              
              subjectPlacementPlan.push({
                className,
                subject: subject.name,
                availableTeachers,
                priority: basePriority + randomFactor
              });
            }
            addLog(`📋 블록제 교사 배치 계획: ${className} ${subject.name} - ${blockCount}개 블록 (총 ${remainingHours}시간)`, 'info');
          } else {
            // 일반 수업은 1시간 단위로 배치
            for (let i = 0; i < remainingHours; i++) {
              const basePriority = calculatePlacementPriority(className, subject.name, availableTeachers, data);
              const randomFactor = Math.random() * 0.1;
              
              subjectPlacementPlan.push({
                className,
                subject: subject.name,
                availableTeachers,
                priority: basePriority + randomFactor
              });
            }
          }
        } else {
          addLog(`경고: ${className} ${subject.name} 과목을 가르칠 수 있는 교사가 없습니다.`, 'warning');
        }
      }
    });
  });

  return subjectPlacementPlan;
};



// 과목 배치 실행
export const executePlacementPlan = (
  schedule: Schedule,
  placementPlan: PlacementPlan[],
  data: TimetableData,
  teacherHours: TeacherHoursTracker,
  addLog: (message: string, type?: string) => void
): number => {
  let placedCount = 0;
  const maxAttempts = placementPlan.length * 200; // 더 많은 시도 허용
  let attempts = 0;
  const failedPlacements: PlacementPlan[] = []; // 실패한 배치 추적

  // 블록제 교사가 있는 수업과 일반 수업 분리
  const blockPlacements = placementPlan.filter(p => {
    const blockPeriodConstraints = data.constraints?.must?.filter(c => c.type === 'block_period_requirement') || [];
    return p.availableTeachers.some(teacher => 
      blockPeriodConstraints.some(c => c.subject === teacher.name)
    );
  });
  const regularPlacements = placementPlan.filter(p => {
    const blockPeriodConstraints = data.constraints?.must?.filter(c => c.type === 'block_period_requirement') || [];
    return !p.availableTeachers.some(teacher => 
      blockPeriodConstraints.some(c => c.subject === teacher.name)
    );
  });

  // 블록제 교사가 있는 수업 우선 정렬 (높은 우선순위부터)
  blockPlacements.sort((a, b) => b.priority - a.priority);
  regularPlacements.sort((a, b) => b.priority - a.priority);

  // 블록제 교사가 있는 수업을 먼저 배치한 후 일반 수업 배치
  const finalPlacementPlan = [...blockPlacements, ...regularPlacements];
  
  addLog(`📋 배치 계획: 블록제 교사 수업 ${blockPlacements.length}개, 일반 수업 ${regularPlacements.length}개`, 'info');

  while (finalPlacementPlan.length > 0 && attempts < maxAttempts) {
    attempts++;
    const placement = finalPlacementPlan.shift()!;

    // 교사별 시수 균형을 고려하여 교사 선택 (시수 제한 엄격 적용)
    const teachersWithPriority = placement.availableTeachers.map(teacher => {
      const currentHours = teacherHours[teacher.name]?.current || 0;
      const maxHours = teacher.max_hours_per_week || teacherHours[teacher.name]?.max || teacher.maxHours || 22;
      const remainingHours = maxHours - currentHours;

      let priority = 0;

      // 블록제 교사인지 확인
      const blockPeriodConstraints = data.constraints?.must?.filter(c => c.type === 'block_period_requirement') || [];
      const isBlockPeriodTeacher = blockPeriodConstraints.some(c => c.subject === teacher.name);
      const requiredHours = isBlockPeriodTeacher ? 2 : 1;

      // 시수 초과 교사는 완전히 제외 (블록제 수업은 2시간 필요)
      if (remainingHours < requiredHours) {
        return { teacher, priority: -1, remainingHours, excluded: true };
      }

      // 해당 학급 시수 제한 확인 (더 엄격하게)
      const classKey = convertClassNameToKey(placement.className);
      const classHoursLimit = teacher.weeklyHoursByGrade?.[classKey] || 0;
      const currentClassHours = getCurrentTeacherHours(schedule, teacher.name, placement.className);
      
      if (classHoursLimit > 0 && currentClassHours >= classHoursLimit) {
        return { teacher, priority: -1, remainingHours, excluded: true }; // 학급 시수 제한 초과 시 완전 배제
      }

      // 공동수업 제약조건이 있는 교사는 우선순위를 낮춤
      const coTeachingConstraints = (data.constraints?.must || []).filter(c =>
        c.type === 'specific_teacher_co_teaching' && c.mainTeacher === teacher.name
      );
      if (coTeachingConstraints.length > 0) {
        priority += 1000;
      }

      // 교사 시수 부족도 (부족할수록 우선) - 시수 제한을 더 엄격하게 적용
      priority += Math.max(0, maxHours - remainingHours) * 100;

      // 시수 여유도가 적은 교사는 우선순위를 낮춤 (시수 초과 방지)
      if (remainingHours <= 2) {
        priority -= 1000; // 더 강한 페널티
      }

      // 랜덤 요소
      priority += Math.random() * 10;

      return { teacher, priority, remainingHours, excluded: false };
    });

    // 제외된 교사 필터링 후 정렬
    const availableTeachers = teachersWithPriority
      .filter(t => !t.excluded && t.remainingHours > 0)
      .sort((a, b) => a.priority - b.priority);

    if (availableTeachers.length === 0) {
      addLog(`⚠️ ${placement.subject} 과목을 가르칠 수 있는 시수 여유가 있는 교사가 없습니다.`, 'warning');
      failedPlacements.push(placement);
      continue;
    }

    // 적합한 교사와 슬롯 찾기
    let placed = false;
    for (const teacherInfo of availableTeachers) {
      const { teacher, remainingHours } = teacherInfo;

      // 시수 제한 재확인
      if (teacherHours[teacher.name]?.current >= teacherHours[teacher.name]?.max) {
        continue;
      }

      // 2단계 전략 적용
      const classKey = convertClassNameToKey(placement.className);
      const hasExplicitAssignment = (teacher.classWeeklyHours && teacher.classWeeklyHours[placement.className] > 0) ||
                                   (teacher.weeklyHoursByGrade && teacher.weeklyHoursByGrade[classKey] > 0);

      const isExplicitlyForbidden = (teacher.classWeeklyHours && teacher.classWeeklyHours[placement.className] === 0) ||
                                   (teacher.weeklyHoursByGrade && teacher.weeklyHoursByGrade[classKey] === 0);

      if (isExplicitlyForbidden) {
        continue;
      }

      if (hasExplicitAssignment) {
        // 명시적 할당이 있는 경우에만 시수 제한 확인
        const currentHours = teacherHours[teacher.name]?.current || 0;
        const maxHours = teacherHours[teacher.name]?.max || 25;
        if (currentHours >= maxHours) {
          continue;
        }
      }

      // 일반 모드로 먼저 시도
      let availableSlots = findAvailableSlots(schedule, placement.className, teacher, placement.subject, data);

      // 슬롯이 없으면 응급 모드로 재시도 (매우 제한적 조건)
      let isEmergencyMode = false;
      if (availableSlots.length === 0 && attempts > maxAttempts * 0.95) {
        availableSlots = findAvailableSlots(schedule, placement.className, teacher, placement.subject, data, false, true);
        isEmergencyMode = true;
        addLog(`⚠️ 제한적 응급 모드 발동: ${placement.className} ${placement.subject} (${teacher.name})`, 'warning');
      }

      if (availableSlots.length > 0) {
        const selectedSlot = availableSlots[Math.floor(Math.random() * availableSlots.length)];

        // 🚨 배치 직전 교사 시간 충돌 검사 (절대 우회 불가능!)
        const finalConflictCheck = checkTeacherTimeConflict(schedule, teacher.name, selectedSlot.day, selectedSlot.period, placement.className);
        if (!finalConflictCheck.allowed) {
          addLog(`🚨 교사 중복 배정 방지: ${teacher.name} - ${selectedSlot.day}요일 ${selectedSlot.period}교시`, 'error');
          continue; // 절대 배치하지 않음
        }
        
        // 배치 직전 수업 불가 시간 최종 확인 (응급 모드에서는 우회)
        if (!isEmergencyMode) {
          const unavailableCheck = checkTeacherUnavailable(teacher, selectedSlot.day, selectedSlot.period);
          if (!unavailableCheck.allowed) {
            continue;
          }
        }

        // 슬롯 배치 전 최종 중복 검증
        if (!validateSlotPlacement(schedule, placement.className, selectedSlot.day, selectedSlot.period, teacher, placement.subject, data, addLog)) {
          continue;
        }

        // 블록제 수업인지 확인하고 적절한 배치 방식 선택
        const subject = data.subjects?.find(s => s.name === placement.subject);
        const isBlockPeriod = subject?.block === true;
        
        if (isBlockPeriod) {
          // 블록제 수업은 특별한 배치 함수 사용
          const blockPlaced = placeBlockPeriodSubject(
            schedule,
            placement.className,
            selectedSlot.day,
            selectedSlot.period,
            teacher.name,
            teacher,
            data,
            placement.subject // 특정 과목명 전달
          );
          
          if (blockPlaced) {
            // 블록제 수업은 2시간 배치되므로 시수 2 증가
            if (teacherHours[teacher.name]) {
              teacherHours[teacher.name].current += 2;
              teacherHours[teacher.name].subjects[placement.subject] = 
                (teacherHours[teacher.name].subjects[placement.subject] || 0) + 2;
            }
            addLog(`✅ 블록제 수업 배치 성공: ${placement.className} ${placement.subject} (${teacher.name}) - ${selectedSlot.day}요일 ${selectedSlot.period}-${selectedSlot.period + 1}교시`, 'success');
          } else {
            addLog(`❌ 블록제 수업 배치 실패: ${placement.className} ${placement.subject} (${teacher.name}) - ${selectedSlot.day}요일 ${selectedSlot.period}교시`, 'error');
            continue; // 블록제 배치 실패 시 다음 교사 시도
          }
        } else {
          // 일반 수업 배치
          schedule[placement.className][selectedSlot.day][selectedSlot.slotIndex] = {
            subject: placement.subject,
            teachers: [teacher.name],
            isCoTeaching: false,
            isFixed: false
          };

          // 시수 업데이트
          if (teacherHours[teacher.name]) {
            teacherHours[teacher.name].current++;
            teacherHours[teacher.name].subjects[placement.subject] = 
              (teacherHours[teacher.name].subjects[placement.subject] || 0) + 1;
          }
        }

        placed = true;
        placedCount++;
        break;
      }
    }

    if (!placed) {
      // 배치 실패한 경우 처리
      failedPlacements.push(placement);
      
      // 일정 실패 횟수마다 재시도 (우선순위 조정)
      if (failedPlacements.length > 20 && placementPlan.length < failedPlacements.length / 2) {
        // 실패한 배치들을 더 적극적으로 재시도
        const retryPlacements = failedPlacements.splice(0, 15); // 더 많이 재시도
        retryPlacements.forEach(p => {
          // 더 큰 우선순위 조정으로 다양한 배치 시도
          p.priority -= Math.random() * 1000 + 500; 
          placementPlan.push(p);
        });
        
        // 배치 계획 재정렬
        placementPlan.sort((a, b) => b.priority - a.priority);
        
        addLog(`🔄 실패 배치 재시도: ${retryPlacements.length}개 (남은 실패: ${failedPlacements.length}개)`, 'info');
      }
    }
  }

  return placedCount;
};



// 메인 시간표 생성 함수
import { NewScheduler } from './newScheduler';

export const generateTimetable = async (
  data: TimetableData,
  addLog: (message: string, type?: string) => void,
  setProgress?: (progress: number) => void
): Promise<{ schedule: Schedule; teacherHours: TeacherHoursTracker; stats: any }> => {
  // 새로운 우선순위 기반 스케줄러 사용
  const newScheduler = new NewScheduler(data);
  
  // 시간표 생성 가능성 사전 검사
  const feasibilityCheck = newScheduler.checkFeasibility(addLog);
  if (!feasibilityCheck.isFeasible) {
    addLog('❌ 시간표 생성이 불가능합니다. 제약조건을 확인해주세요.', 'error');
    return {
      schedule: {},
      teacherHours: {},
      stats: {}
    };
  }

  // 새로운 스케줄러로 시간표 생성
  const result = await newScheduler.generateTimetable(addLog, setProgress);
  
  if (!result.success) {
    addLog('❌ 시간표 생성에 실패했습니다.', 'error');
    return {
      schedule: result.schedule,
      teacherHours: result.teacherHours,
      stats: result.stats
    };
  }

  return {
    schedule: result.schedule,
    teacherHours: result.teacherHours,
    stats: result.stats
  };
};

// 교사 시수 균형 재조정 함수
const rebalanceTeacherHours = (
  schedule: Schedule,
  data: TimetableData,
  teacherHours: TeacherHoursTracker,
  addLog: (message: string, type?: string) => void
): number => {
  let rebalancedCount = 0;
  const teachers = data.teachers || [];
  
  teachers.forEach(teacher => {
    const currentHours = teacherHours[teacher.name]?.current || 0;
    const targetHours = teacher.maxHours || 18;
    
    // 시수가 크게 부족한 교사 처리 (시수 제한 엄격 적용)
    if (currentHours < targetHours * 0.7) {
      // 시수 제한 확인
      const maxHours = teacher.max_hours_per_week || teacherHours[teacher.name]?.max || teacher.maxHours || 22;
      if (currentHours >= maxHours) {
        addLog(`🚨 ${teacher.name} 교사 시수 제한 초과로 재조정 불가: ${currentHours}/${maxHours}시간`, 'error');
        return;
      }
      addLog(`⚖️ ${teacher.name} 교사 시수 부족 감지: ${currentHours}/${targetHours}시간`, 'warning');
      
      // 해당 교사가 가르칠 수 있는 과목으로 빈 슬롯 채우기 시도
      const teachableSubjects = teacher.subjects || [];
      teachableSubjects.forEach(subjectName => {
        // 빈 슬롯을 찾아서 해당 교사로 배정 시도
        Object.keys(schedule).forEach(className => {
          DAYS.forEach(day => {
            const periodsPerDay = data.base?.periods_per_day || {};
            const maxPeriods = periodsPerDay[day] || 7;
            
            for (let period = 0; period < maxPeriods; period++) {
              if (schedule[className][day][period] === '' || !schedule[className][day][period]) {
                // 🚨 교사 시간 충돌 검사 (절대 우회 불가능!)
                const conflictCheck = checkTeacherTimeConflict(schedule, teacher.name, day, period + 1, className);
                if (!conflictCheck.allowed) {
                  return; // 교사가 이미 다른 곳에서 수업 중이면 배치하지 않음
                }
                
                // 이 슬롯에 해당 교사가 배치 가능한지 확인 (정상 조건만)
                const unavailableCheck = checkTeacherUnavailable(teacher, day, period + 1);
                if (unavailableCheck.allowed) { // 수업 불가 시간은 엄격히 준수
                  schedule[className][day][period] = {
                    subject: subjectName,
                    teachers: [teacher.name],
                    isCoTeaching: false,
                    isFixed: false,
                    source: 'rebalance'
                  };
                  
                  if (teacherHours[teacher.name]) {
                    teacherHours[teacher.name].current++;
                  }
                  
                  rebalancedCount++;
                  addLog(`⚖️ ${teacher.name} 시수 재조정: ${className} ${day} ${period + 1}교시 ${subjectName}`, 'info');
                  
                  // 시수 제한 확인
                  const currentHoursAfterRebalance = teacherHours[teacher.name]?.current || 0;
                  const maxHours = teacher.max_hours_per_week || teacherHours[teacher.name]?.max || teacher.maxHours || 22;
                  
                  if (currentHoursAfterRebalance >= maxHours) {
                    addLog(`🚨 ${teacher.name} 교사 시수 제한 도달로 재조정 중단: ${currentHoursAfterRebalance}/${maxHours}시간`, 'warning');
                    return;
                  }
                  
                  // 목표 시수 달성하면 중단
                  if (teacherHours[teacher.name]?.current >= targetHours * 0.9) {
                    return;
                  }
                }
              }
            }
          });
        });
      });
    }
  });
  
  return rebalancedCount;
}; 

// 교사별 수업 재조정 함수 (채움률 향상)
const optimizeTeacherAssignments = (
  schedule: Schedule,
  data: TimetableData,
  teacherHours: TeacherHoursTracker,
  addLog: (message: string, type?: string) => void
): number => {
  let optimizationCount = 0;
  const teachers = data.teachers || [];
  const subjects = data.subjects || [];
  const classNames = Object.keys(schedule);
  
  addLog('🔄 교사별 수업 재조정을 시작합니다.', 'info');
  
  // 1단계: 교사별 시수 부족도 분석 (시수 제한 엄격 적용)
  const teacherDeficits = teachers.map(teacher => {
    const currentHours = teacherHours[teacher.name]?.current || 0;
    const maxHours = teacher.max_hours_per_week || teacherHours[teacher.name]?.max || teacher.maxHours || 22;
    const deficit = Math.max(0, maxHours - currentHours);
    
    // 시수 초과 교사는 제외
    if (deficit <= 0) {
      return {
        teacher,
        currentHours,
        maxHours,
        deficit: 0,
        priority: -1,
        excluded: true
      };
    }
    
    // 시수 여유도가 매우 적은 교사는 제외 (시수 초과 방지)
    if (deficit <= 1) {
      return {
        teacher,
        currentHours,
        maxHours,
        deficit,
        priority: -1,
        excluded: true
      };
    }
    
    return {
      teacher,
      currentHours,
      maxHours,
      deficit,
      priority: deficit * 10 + Math.random() * 5, // 부족도 + 랜덤 요소
      excluded: false
    };
  }).filter(t => !t.excluded).sort((a, b) => b.priority - a.priority); // 부족도가 높은 교사 우선
  
  // 2단계: 빈 슬롯과 교사 매칭 최적화
  teacherDeficits.forEach(({ teacher, deficit }) => {
    if (deficit <= 0) return;
    
    addLog(`🔍 ${teacher.name} 교사 시수 부족: ${deficit}시간, 최적화 시도 중...`, 'info');
    
    // 해당 교사가 가르칠 수 있는 과목들
    const teachableSubjects = teacher.subjects || [];
    
    // 각 학급의 빈 슬롯을 찾아서 최적 배치 시도
    classNames.forEach(className => {
      if (optimizationCount >= deficit) return; // 목표 달성 시 중단
      
      DAYS.forEach(day => {
        if (optimizationCount >= deficit) return;
        
        const periodsForDay = data.base?.periods_per_day?.[day] || 7;
        
        for (let period = 0; period < periodsForDay; period++) {
          if (optimizationCount >= deficit) break;
          
          const currentSlot = schedule[className]?.[day]?.[period];
          
          // 빈 슬롯이거나 교체 가능한 슬롯인지 확인
          if (currentSlot === '' || currentSlot === undefined) {
            // 빈 슬롯에 최적 과목 배치 시도
            const bestSubject = findBestSubjectForSlot(
              className, day, period, teachableSubjects, schedule, data, teacher
            );
            
            if (bestSubject) {
              const success = tryPlaceSubjectInSlot(
                schedule, className, day, period, bestSubject, teacher, data, teacherHours, addLog
              );
              
              if (success) {
                optimizationCount++;
                addLog(`✅ ${className} ${day}요일 ${period + 1}교시에 ${bestSubject.name} 배치 (${teacher.name})`, 'success');
              }
            }
          } else if (typeof currentSlot === 'object' && currentSlot.subject) {
            // 기존 수업이 있는 경우, 더 효율적인 교사로 교체 시도
            const currentSubject = currentSlot.subject;
            const currentTeachers = currentSlot.teachers || [];
            
            // 현재 교사가 해당 과목을 가르칠 수 있고, 더 효율적인 배치가 가능한지 확인
            if (teachableSubjects.includes(currentSubject) && 
                !currentTeachers.includes(teacher.name)) {
              
              const canOptimize = canOptimizeTeacherAssignment(
                schedule, className, day, period, currentSubject, teacher, data, teacherHours
              );
              
              if (canOptimize) {
                const success = tryReplaceTeacherInSlot(
                  schedule, className, day, period, teacher, data, teacherHours, addLog
                );
                
                if (success) {
                  optimizationCount++;
                  addLog(`🔄 ${className} ${day}요일 ${period + 1}교시 ${currentSubject} 교사 교체: ${teacher.name}`, 'success');
                }
              }
            }
          }
        }
      });
    });
  });
  
  // 3단계: 과목별 시수 부족도 기반 최적화
  const subjectDeficits = subjects.map(subject => {
    let totalDeficit = 0;
    classNames.forEach(className => {
      const currentHours = getCurrentSubjectHours(schedule, className, subject.name);
      const targetHours = subject.weekly_hours || 1;
      totalDeficit += Math.max(0, targetHours - currentHours);
    });
    
    return {
      subject,
      totalDeficit,
      priority: totalDeficit * 5 + Math.random() * 3
    };
  }).sort((a, b) => b.priority - a.priority);
  
  // 과목별 시수 부족도가 높은 과목들을 우선적으로 배치
  subjectDeficits.forEach(({ subject, totalDeficit }) => {
    if (totalDeficit <= 0) return;
    
    addLog(`📚 ${subject.name} 과목 시수 부족: ${totalDeficit}시간, 추가 배치 시도 중...`, 'info');
    
    // 해당 과목을 가르칠 수 있는 교사들
    const availableTeachers = teachers.filter(t => t.subjects?.includes(subject.name));
    
    if (availableTeachers.length === 0) return;
    
    // 빈 슬롯에 과목 배치 시도
    classNames.forEach(className => {
      if (totalDeficit <= 0) return;
      
      DAYS.forEach(day => {
        if (totalDeficit <= 0) return;
        
        const periodsForDay = data.base?.periods_per_day?.[day] || 7;
        
        for (let period = 0; period < periodsForDay; period++) {
          if (totalDeficit <= 0) break;
          
          const currentSlot = schedule[className]?.[day]?.[period];
          
          if (currentSlot === '' || currentSlot === undefined) {
            // 가장 적합한 교사 선택
            const bestTeacher = findBestTeacherForSubject(
              availableTeachers, subject.name, className, schedule, data, teacherHours
            );
            
            if (bestTeacher) {
              const success = tryPlaceSubjectInSlot(
                schedule, className, day, period, subject, bestTeacher, data, teacherHours, addLog
              );
              
              if (success) {
                optimizationCount++;
                totalDeficit--;
                addLog(`✅ ${className} ${day}요일 ${period + 1}교시에 ${subject.name} 추가 배치 (${bestTeacher.name})`, 'success');
              }
            }
          }
        }
      });
    });
  });
  
  addLog(`🎯 교사별 수업 재조정 완료: ${optimizationCount}개 최적화`, 'success');
  return optimizationCount;
};

// 지능적 재조정 및 최적화 함수 (모든 제약조건 고려)
const performIntelligentRebalancing = (
  schedule: Schedule,
  data: TimetableData,
  teacherHours: TeacherHoursTracker,
  addLog: (message: string, type?: string) => void
): number => {
  let totalOptimizations = 0;
  const maxIterations = 10; // 최대 반복 횟수
  let iterationCount = 0;
  let previousOptimizations = -1;
  
  addLog('🧠 지능적 재조정 시작: 모든 제약조건을 고려한 최적화를 수행합니다.', 'info');
  
  while (iterationCount < maxIterations && totalOptimizations !== previousOptimizations) {
    previousOptimizations = totalOptimizations;
    iterationCount++;
    
    addLog(`🔄 재조정 반복 ${iterationCount}/${maxIterations}`, 'info');
    
    // 1. 블록제 수업 최적화 (최우선)
    const blockOptimizations = optimizeBlockPeriodPlacements(schedule, data, teacherHours, addLog);
    totalOptimizations += blockOptimizations;
    
    // 2. 교사 시수 제한 위반 해결
    const violationFixes = fixTeacherHourViolations(schedule, data, teacherHours, addLog);
    totalOptimizations += violationFixes;
    
    // 3. 교사 불가능 시간 위반 해결
    const unavailabilityFixes = fixTeacherUnavailabilityViolations(schedule, data, addLog);
    totalOptimizations += unavailabilityFixes;
    
    // 4. 교사 중복 배정 해결
    const conflictFixes = fixTeacherTimeConflicts(schedule, data, teacherHours, addLog);
    totalOptimizations += conflictFixes;
    
    // 5. 과목별 시수 균형 맞추기
    const subjectBalancing = balanceSubjectHours(schedule, data, teacherHours, addLog);
    totalOptimizations += subjectBalancing;
    
    // 6. 빈 슬롯 채우기 (가능한 경우에만)
    const emptySlotFilling = fillRemainingEmptySlots(schedule, data, teacherHours, addLog);
    totalOptimizations += emptySlotFilling;
    
    // 더 이상 개선이 없으면 종료
    if (totalOptimizations === previousOptimizations) {
      addLog(`✅ 재조정 완료: 더 이상 개선할 부분이 없습니다. (반복 ${iterationCount}회)`, 'success');
      break;
    }
  }
  
  if (iterationCount >= maxIterations) {
    addLog(`⚠️ 최대 반복 횟수 도달: ${maxIterations}회 반복 후 종료`, 'warning');
  }
  
  addLog(`🎯 지능적 재조정 완료: 총 ${totalOptimizations}개 최적화`, 'success');
  return totalOptimizations;
};

// 1. 블록제 교사 최적화 (같은 반 2시간 연속 보장)
const optimizeBlockPeriodPlacements = (
  schedule: Schedule,
  data: TimetableData,
  teacherHours: TeacherHoursTracker,
  addLog: (message: string, type?: string) => void
): number => {
  let optimizations = 0;
  const blockPeriodConstraints = data.constraints?.must?.filter(c => c.type === 'block_period_requirement') || [];
  const blockPeriodTeachers = blockPeriodConstraints.map(c => c.subject);
  
  if (blockPeriodTeachers.length === 0) return 0;
  
  blockPeriodTeachers.forEach(teacherName => {
    if (!teacherName) return; // teacherName이 undefined인 경우 건너뛰기
    
    Object.keys(schedule).forEach(className => {
      DAYS.forEach(day => {
        const maxPeriods = data.base?.periods_per_day?.[day] || 7;
        
        // 홀수 교시에서 블록제 수업 찾기 (같은 반에서만)
        for (let period = 1; period <= maxPeriods; period += 2) {
          const slotIndex = period - 1;
          const nextSlotIndex = period;
          
          const currentSlot = schedule[className]?.[day]?.[slotIndex];
          const nextSlot = schedule[className]?.[day]?.[nextSlotIndex];
          
          // 블록제 교사가 잘못 배치된 경우 수정 (같은 반에서만)
          if (currentSlot && typeof currentSlot === 'object' && currentSlot.teachers && currentSlot.teachers.includes(teacherName)) {
            if (!currentSlot.isBlockPeriod || !nextSlot || 
                typeof nextSlot !== 'object' || !nextSlot.teachers || !nextSlot.teachers.includes(teacherName)) {
              
              addLog(`🔧 블록제 교사 수정: ${className} ${day} ${period}교시 ${teacherName} (같은 반 2시간 연속)`, 'info');
              
              // 현재 슬롯을 블록제로 수정 (같은 반에서만)
              if (nextSlot && (nextSlot === '' || nextSlot === undefined)) {
                // 교사 시간 중복 확인 (다른 반에서 같은 시간에 수업하는지)
                const teacherConflict = checkTeacherTimeConflict(schedule, teacherName, day, period + 1, className);
                if (!teacherConflict.allowed) {
                  addLog(`⚠️ 블록제 교사 수정 실패: ${teacherName} 교사가 ${day} ${period + 1}교시에 다른 반에서 수업 중`, 'warning');
                } else {
                  schedule[className][day][slotIndex] = {
                    ...currentSlot,
                    isBlockPeriod: true,
                    blockPartner: nextSlotIndex
                  };
                  
                  schedule[className][day][nextSlotIndex] = {
                    subject: currentSlot.subject || '',
                    teachers: currentSlot.teachers || [],
                    isCoTeaching: false,
                    isFixed: false,
                    isBlockPeriod: true,
                    blockPartner: slotIndex
                  };
                  
                  optimizations++;
                  addLog(`✅ 블록제 교사 수정 완료: ${className} ${day} ${period}-${period + 1}교시 ${teacherName}`, 'success');
                }
              }
            }
          }
        }
      });
    });
  });
  
  return optimizations;
};

// 2. 교사 시수 제한 위반 해결
const fixTeacherHourViolations = (
  schedule: Schedule,
  data: TimetableData,
  teacherHours: TeacherHoursTracker,
  addLog: (message: string, type?: string) => void
): number => {
  let fixes = 0;
  const teachers = data.teachers || [];
  
  teachers.forEach(teacher => {
    const currentHours = teacherHours[teacher.name]?.current || 0;
    const maxHours = teacher.max_hours_per_week || teacher.maxHours || 22;
    
    if (currentHours > maxHours) {
      const excessHours = currentHours - maxHours;
      addLog(`⚠️ ${teacher.name} 교사 시수 초과 감지: ${excessHours}시간 초과, 수정 시도`, 'warning');
      
      // 우선순위가 낮은 수업부터 제거
      const teacherSlots = findTeacherSlots(schedule, teacher.name);
      const removableSlots = teacherSlots
        .filter(slot => !slot.isFixed && !slot.isBlockPeriod) // 고정수업, 블록제 수업 제외
        .sort((a, b) => (a.priority || 0) - (b.priority || 0)); // 우선순위 낮은 것부터
      
      let removedHours = 0;
      for (const slot of removableSlots) {
        if (removedHours >= excessHours) break;
        
        // 슬롯 제거
        schedule[slot.className][slot.day][slot.period] = '';
        teacherHours[teacher.name].current--;
        removedHours++;
        fixes++;
        
        addLog(`🗑️ 시수 초과 해결: ${slot.className} ${slot.day} ${slot.period + 1}교시 ${slot.subject} 제거`, 'info');
      }
    }
  });
  
  return fixes;
};

// 3. 교사 불가능 시간 위반 해결
const fixTeacherUnavailabilityViolations = (
  schedule: Schedule,
  data: TimetableData,
  addLog: (message: string, type?: string) => void
): number => {
  let fixes = 0;
  const teachers = data.teachers || [];
  
  teachers.forEach(teacher => {
    if (!teacher.unavailable || !Array.isArray(teacher.unavailable)) return;
    
    teacher.unavailable.forEach(([unavailableDay, unavailablePeriod]) => {
      Object.keys(schedule).forEach(className => {
        const slotIndex = unavailablePeriod - 1;
        const slot = schedule[className]?.[unavailableDay]?.[slotIndex];
        
        if (slot && typeof slot === 'object' && 
            slot.teachers && slot.teachers.includes(teacher.name)) {
          
          // 블록제 수업은 건드리지 않음
          if (slot.isBlockPeriod) {
            addLog(`⚠️ 블록제 수업 보호: ${teacher.name} ${unavailableDay} ${unavailablePeriod}교시 블록제 수업은 수정하지 않음`, 'warning');
          } else {
            addLog(`⚠️ 교사 불가능 시간 위반 감지: ${teacher.name} ${unavailableDay} ${unavailablePeriod}교시`, 'warning');
            
            // 다른 교사로 교체 시도
            const subject = data.subjects?.find(s => s.name === slot.subject);
            if (subject) {
              const alternativeTeachers = data.teachers?.filter(t => 
                t.subjects?.includes(subject.name) && 
                t.name !== teacher.name &&
                !checkTeacherUnavailable(t, unavailableDay, unavailablePeriod).reason
              ) || [];
              
              if (alternativeTeachers.length > 0) {
                const newTeacher = alternativeTeachers[0];
                slot.teachers = [newTeacher.name];
                fixes++;
                addLog(`🔄 교사 교체: ${className} ${unavailableDay} ${unavailablePeriod}교시 ${teacher.name} → ${newTeacher.name}`, 'info');
              } else {
                // 대체 교사가 없으면 수업 제거
                schedule[className][unavailableDay][slotIndex] = '';
                fixes++;
                addLog(`🗑️ 수업 제거: ${className} ${unavailableDay} ${unavailablePeriod}교시 (대체 교사 없음)`, 'info');
              }
            }
          }
        }
      });
    });
  });
  
  return fixes;
};

// 4. 교사 중복 배정 해결
const fixTeacherTimeConflicts = (
  schedule: Schedule,
  data: TimetableData,
  teacherHours: TeacherHoursTracker,
  addLog: (message: string, type?: string) => void
): number => {
  let fixes = 0;
  const teachers = data.teachers || [];
  
  teachers.forEach(teacher => {
    DAYS.forEach(day => {
      const maxPeriods = data.base?.periods_per_day?.[day] || 7;
      
      for (let period = 1; period <= maxPeriods; period++) {
        const slotIndex = period - 1;
        const conflictingClasses: string[] = [];
        
        // 같은 시간에 여러 학급에서 수업하는지 확인
        Object.keys(schedule).forEach(className => {
          const slot = schedule[className]?.[day]?.[slotIndex];
          if (slot && typeof slot === 'object' && 
              slot.teachers && slot.teachers.includes(teacher.name)) {
            conflictingClasses.push(className);
          }
        });
        
        if (conflictingClasses.length > 1) {
          addLog(`⚠️ 교사 중복 배정 감지: ${teacher.name} ${day} ${period}교시 (${conflictingClasses.join(', ')})`, 'warning');
          
          // 블록제 수업이 있는지 확인
          const blockPeriodClasses = conflictingClasses.filter(className => {
            const slot = schedule[className][day][slotIndex];
            return slot && typeof slot === 'object' && slot.isBlockPeriod;
          });
          
          // 블록제 수업이 있으면 블록제 수업을 우선 보호
          if (blockPeriodClasses.length > 0) {
            const nonBlockClasses = conflictingClasses.filter(className => !blockPeriodClasses.includes(className));
            
            // 블록제가 아닌 수업들만 처리
            nonBlockClasses.forEach(className => {
              const slot = schedule[className][day][slotIndex];
              
              if (typeof slot === 'object') {
                // 다른 교사로 교체 시도
                const subject = data.subjects?.find(s => s.name === slot.subject);
                if (subject) {
                  const alternativeTeachers = data.teachers?.filter(t => 
                    t.subjects?.includes(subject.name) && 
                    t.name !== teacher.name
                  ) || [];
                  
                  if (alternativeTeachers.length > 0) {
                    const newTeacher = alternativeTeachers[0];
                    slot.teachers = [newTeacher.name];
                    fixes++;
                    addLog(`🔄 중복 해결 (블록제 보호): ${className} ${day} ${period}교시 ${teacher.name} → ${newTeacher.name}`, 'info');
                  } else {
                    // 대체 교사가 없으면 수업 제거
                    schedule[className][day][slotIndex] = '';
                    fixes++;
                    addLog(`🗑️ 중복 해결 (블록제 보호): ${className} ${day} ${period}교시 수업 제거 (대체 교사 없음)`, 'info');
                  }
                }
              }
            });
          } else {
            // 블록제 수업이 없으면 기존 방식대로 처리
            for (let i = 1; i < conflictingClasses.length; i++) {
              const className = conflictingClasses[i];
              const slot = schedule[className][day][slotIndex];
              
              if (typeof slot === 'object') {
                // 다른 교사로 교체 시도
                const subject = data.subjects?.find(s => s.name === slot.subject);
                if (subject) {
                  const alternativeTeachers = data.teachers?.filter(t => 
                    t.subjects?.includes(subject.name) && 
                    t.name !== teacher.name
                  ) || [];
                  
                  if (alternativeTeachers.length > 0) {
                    const newTeacher = alternativeTeachers[0];
                    slot.teachers = [newTeacher.name];
                    fixes++;
                    addLog(`🔄 중복 해결: ${className} ${day} ${period}교시 ${teacher.name} → ${newTeacher.name}`, 'info');
                  } else {
                    // 대체 교사가 없으면 수업 제거
                    schedule[className][day][slotIndex] = '';
                    fixes++;
                    addLog(`🗑️ 중복 해결: ${className} ${day} ${period}교시 수업 제거 (대체 교사 없음)`, 'info');
                  }
                }
              }
            }
          }
        }
      }
    });
  });
  
  return fixes;
};

// 5. 과목별 시수 균형 맞추기
const balanceSubjectHours = (
  schedule: Schedule,
  data: TimetableData,
  teacherHours: TeacherHoursTracker,
  addLog: (message: string, type?: string) => void
): number => {
  let balancing = 0;
  const subjects = data.subjects || [];
  
  subjects.forEach(subject => {
    Object.keys(schedule).forEach(className => {
      const currentHours = getCurrentSubjectHours(schedule, className, subject.name);
      const targetHours = subject.weekly_hours || 1;
      const deficit = targetHours - currentHours;
      
      if (deficit > 0) {
        // 해당 과목을 가르칠 수 있는 교사 찾기
        const availableTeachers = data.teachers?.filter(t => 
          t.subjects?.includes(subject.name)
        ) || [];
        
        if (availableTeachers.length === 0) return;
        
        // 빈 슬롯에 부족한 과목 배치 시도
        DAYS.forEach(day => {
          const maxPeriods = data.base?.periods_per_day?.[day] || 7;
          
          for (let period = 0; period < maxPeriods && deficit > balancing; period++) {
            const slot = schedule[className]?.[day]?.[period];
            
            if (slot === '' || slot === undefined) {
              // 시수 제한을 고려한 최적 교사 선택
              const bestTeacher = availableTeachers.find(teacher => {
                const currentTeacherHours = teacherHours[teacher.name]?.current || 0;
                const maxTeacherHours = teacher.max_hours_per_week || teacher.maxHours || 22;
                
                return currentTeacherHours < maxTeacherHours &&
                       !checkTeacherUnavailable(teacher, day, period + 1).reason &&
                       !checkTeacherTimeConflict(schedule, teacher.name, day, period + 1, className).reason;
              });
              
              if (bestTeacher) {
                schedule[className][day][period] = {
                  subject: subject.name,
                  teachers: [bestTeacher.name],
                  isCoTeaching: false,
                  isFixed: false,
                  source: 'balance'
                };
                
                if (teacherHours[bestTeacher.name]) {
                  teacherHours[bestTeacher.name].current++;
                }
                
                balancing++;
                addLog(`⚖️ 과목 시수 균형: ${className} ${day} ${period + 1}교시 ${subject.name} 추가`, 'info');
              }
            }
          }
        });
      }
    });
  });
  
  return balancing;
};

// 6. 빈 슬롯 채우기 (가능한 경우에만)
const fillRemainingEmptySlots = (
  schedule: Schedule,
  data: TimetableData,
  teacherHours: TeacherHoursTracker,
  addLog: (message: string, type?: string) => void
): number => {
  let filled = 0;
  const teachers = data.teachers || [];
  const subjects = data.subjects || [];
  
  Object.keys(schedule).forEach(className => {
    DAYS.forEach(day => {
      const maxPeriods = data.base?.periods_per_day?.[day] || 7;
      
      for (let period = 0; period < maxPeriods; period++) {
        const slot = schedule[className]?.[day]?.[period];
        
        if (slot === '' || slot === undefined) {
          // 가장 적합한 교사-과목 조합 찾기
          let bestMatch: { teacher: any, subject: any, score: number } | undefined;
          
          teachers.forEach(teacher => {
            const currentHours = teacherHours[teacher.name]?.current || 0;
            const maxHours = teacher.max_hours_per_week || teacher.maxHours || 22;
            
            // 시수 여유가 있고 불가능 시간이 아닌 교사만
            if (currentHours < maxHours &&
                !checkTeacherUnavailable(teacher, day, period + 1).reason &&
                !checkTeacherTimeConflict(schedule, teacher.name, day, period + 1, className).reason) {
              
              teacher.subjects?.forEach(subjectName => {
                const subject = subjects.find(s => s.name === subjectName);
                if (subject) {
                  const currentSubjectHours = getCurrentSubjectHours(schedule, className, subjectName);
                  const targetSubjectHours = subject.weekly_hours || 1;
                  
                  // 과목 시수가 부족한 경우 더 높은 점수
                  const deficit = Math.max(0, targetSubjectHours - currentSubjectHours);
                  const hourAvailability = maxHours - currentHours;
                  const score = deficit * 10 + hourAvailability;
                  
                  if (!bestMatch || score > bestMatch.score) {
                    bestMatch = { teacher, subject, score };
                  }
                }
              });
            }
          });
          
          if (bestMatch && 'score' in bestMatch && bestMatch.score > 0) {
            const selectedTeacher = bestMatch.teacher;
            const selectedSubject = bestMatch.subject;
            
            schedule[className][day][period] = {
              subject: selectedSubject.name,
              teachers: [selectedTeacher.name],
              isCoTeaching: false,
              isFixed: false,
              source: 'fill'
            };
            
            if (teacherHours[selectedTeacher.name]) {
              teacherHours[selectedTeacher.name].current++;
            }
            
            filled++;
            addLog(`📝 빈 슬롯 채우기: ${className} ${day} ${period + 1}교시 ${selectedSubject.name} (${selectedTeacher.name})`, 'info');
          }
        }
      }
    });
  });
  
  return filled;
};

// 교사의 모든 슬롯 찾기 헬퍼 함수
const findTeacherSlots = (schedule: Schedule, teacherName: string): any[] => {
  const slots: any[] = [];
  
  Object.keys(schedule).forEach(className => {
    DAYS.forEach(day => {
      const daySchedule = schedule[className][day];
      if (daySchedule) {
        Object.keys(daySchedule).forEach(periodStr => {
          const period = parseInt(periodStr);
          const slot = daySchedule[period];
          
          if (slot && typeof slot === 'object' && 
              slot.teachers && slot.teachers.includes(teacherName)) {
            slots.push({
              className,
              day,
              period,
              subject: slot.subject,
              isFixed: slot.isFixed || false,
              isBlockPeriod: slot.isBlockPeriod || false,
              source: slot.source,
              priority: slot.priority || 0
            });
          }
        });
      }
    });
  });
  
  return slots;
};

// 빈 슬롯에 가장 적합한 과목 찾기
const findBestSubjectForSlot = (
  className: string,
  day: string,
  period: number,
  teachableSubjects: string[],
  schedule: Schedule,
  data: TimetableData,
  teacher: any
): any => {
  const subjects = data.subjects || [];
  const availableSubjects = subjects.filter(s => teachableSubjects.includes(s.name));
  
  if (availableSubjects.length === 0) return null;
  
  // 과목별 우선순위 계산
  const subjectPriorities = availableSubjects.map(subject => {
    let priority = 0;
    
    // 1. 시수 부족도 (부족할수록 높은 우선순위)
    const currentHours = getCurrentSubjectHours(schedule, className, subject.name);
    const targetHours = subject.weekly_hours || 1;
    const deficit = Math.max(0, targetHours - currentHours);
    priority += deficit * 100;
    
    // 2. 특별실 필요 여부 (특별실이 필요한 과목은 우선순위 낮춤)
    if (subject.is_space_limited) {
      priority -= 50;
    }
    
    // 3. 공동수업 필요 여부 (공동수업이 필요한 과목은 우선순위 낮춤)
    if (subject.requires_co_teaching) {
      priority -= 30;
    }
    
    // 4. 랜덤 요소
    priority += Math.random() * 10;
    
    return { subject, priority };
  });
  
  subjectPriorities.sort((a, b) => b.priority - a.priority);
  return subjectPriorities[0]?.subject || null;
};

// 가장 적합한 교사 찾기 (시수 제한 엄격 적용)
const findBestTeacherForSubject = (
  availableTeachers: any[],
  subjectName: string,
  className: string,
  schedule: Schedule,
  data: TimetableData,
  teacherHours: TeacherHoursTracker
): any => {
  if (availableTeachers.length === 0) return null;
  
  // 교사별 우선순위 계산 (시수 제한 엄격 적용)
  const teacherPriorities = availableTeachers.map(teacher => {
    let priority = 0;
    
    // 1. 시수 초과 교사는 완전히 제외
    const currentHours = teacherHours[teacher.name]?.current || 0;
    const maxHours = teacher.max_hours_per_week || teacherHours[teacher.name]?.max || teacher.maxHours || 22;
    const remainingHours = maxHours - currentHours;
    
    if (remainingHours <= 0) {
      return { teacher, priority: -1, excluded: true };
    }
    
    // 2. 시수 부족도 (부족할수록 높은 우선순위)
    const deficit = Math.max(0, maxHours - currentHours);
    priority += deficit * 10;
    
    // 3. 해당 학급 담당 시수 제한 확인
    const classKey = convertClassNameToKey(className);
    const classHoursLimit = teacher.weeklyHoursByGrade?.[classKey] || 0;
    const currentClassHours = getCurrentTeacherHours(schedule, teacher.name, className);
    
    if (classHoursLimit > 0 && currentClassHours >= classHoursLimit) {
      return { teacher, priority: -1, excluded: true }; // 학급 시수 제한 초과 시 완전 배제
    }
    
    // 4. 시수 여유도가 적은 교사는 우선순위를 낮춤 (시수 초과 방지)
    if (remainingHours <= 2) {
      priority -= 500;
    }
    
    // 5. 공동수업 제약조건이 있는 교사는 우선순위를 낮춤
    const coTeachingConstraints = (data.constraints?.must || []).filter(c =>
      c.type === 'specific_teacher_co_teaching' && c.mainTeacher === teacher.name
    );
    if (coTeachingConstraints.length > 0) {
      priority += 1000;
    }
    
    // 6. 랜덤 요소
    priority += Math.random() * 5;
    
    return { teacher, priority, excluded: false };
  });
  
  // 제외된 교사 필터링 후 정렬
  const availableTeachersFiltered = teacherPriorities
    .filter(t => !t.excluded)
    .sort((a, b) => b.priority - a.priority);
  
  return availableTeachersFiltered[0]?.teacher || null;
};

// 슬롯에 과목 배치 시도 (시수 제한 엄격 적용)
const tryPlaceSubjectInSlot = (
  schedule: Schedule,
  className: string,
  day: string,
  period: number,
  subject: any,
  teacher: any,
  data: TimetableData,
  teacherHours: TeacherHoursTracker,
  addLog: (message: string, type?: string) => void
): boolean => {
  // 교사 시수 제한 엄격 확인 (블록제 수업 고려)
  const currentHours = teacherHours[teacher.name]?.current || 0;
  // max_hours_per_week 우선 사용, 없으면 maxHours, 기본값 22시간
  const maxHours = teacher.max_hours_per_week || teacher.max_hours_per_week || teacherHours[teacher.name]?.max || teacher.maxHours || 22;
  
  // 블록제 교사인지 확인 (제약조건에서 해당 교사가 블록제로 설정되어 있는지 확인)
  const blockPeriodConstraints = data.constraints?.must?.filter(c => c.type === 'block_period_requirement') || [];
  const isBlockPeriodTeacher = blockPeriodConstraints.some(c => c.subject === teacher.name);
  const requiredHours = isBlockPeriodTeacher ? 2 : 1; // 블록제 교사는 2교시 필요
  
  if (currentHours + requiredHours > maxHours) {
    addLog(`❌ ${teacher.name} 교사 시수 초과로 배치 불가 (현재: ${currentHours}시간, 필요: ${requiredHours}시간, 최대: ${maxHours}시간)`, 'error');
    return false;
  }
  
  // 해당 학급 시수 제한 확인
  const classKey = convertClassNameToKey(className);
  const classHoursLimit = teacher.weeklyHoursByGrade?.[classKey] || 0;
  const currentClassHours = getCurrentTeacherHours(schedule, teacher.name, className);
  
  if (classHoursLimit > 0 && currentClassHours >= classHoursLimit) {
    addLog(`❌ ${teacher.name} 교사 ${className} 학급 시수 제한 초과로 배치 불가 (현재: ${currentClassHours}시간, 제한: ${classHoursLimit}시간)`, 'error');
    return false;
  }
  
  // 통합 제약조건 엄격 검증 (모든 제약조건을 한 번에 검증)
  const constraintCheck = validateAllConstraints(schedule, className, day, period, teacher, subject.name, data, addLog);
  if (!constraintCheck.allowed) {
    addLog(`❌ 제약조건 위반으로 배치 불가: ${constraintCheck.message}`, 'error');
    return false;
  }
  
  if (isBlockPeriodTeacher) {
    // 블록제 수업 배치 (같은 반에서 2시간 연속 자동 배치)
    const success = placeBlockPeriodSubject(schedule, className, day, period, teacher.name, teacher, data, subject.name);
    if (success) {
      addLog(`✅ 블록제 수업 배치 성공: ${className} ${day} ${period}-${period + 1}교시 ${subject.name} (${teacher.name} 교사) - 같은 반 2시간 연속`, 'success');
      // 교사 시수 업데이트 (2교시 배치)
      if (teacherHours[teacher.name]) {
        teacherHours[teacher.name].current += 2;
      }
      return true;
    } else {
      return false;
    }
  } else {
    // 일반 수업 배치
    schedule[className][day][period] = {
      subject: subject.name,
      teachers: [teacher.name],
      isCoTeaching: false,
      isFixed: false
    };
    
    // 교사 시수 업데이트
    if (teacherHours[teacher.name]) {
      teacherHours[teacher.name].current++;
    }
    
    return true;
  }
};

// 교사 교체 시도
const tryReplaceTeacherInSlot = (
  schedule: Schedule,
  className: string,
  day: string,
  period: number,
  newTeacher: any,
  data: TimetableData,
  teacherHours: TeacherHoursTracker,
  addLog: (message: string, type?: string) => void
): boolean => {
  const currentSlot = schedule[className]?.[day]?.[period];
  if (!currentSlot || typeof currentSlot !== 'object') return false;
  
  const currentTeachers = currentSlot.teachers || [];
  if (currentTeachers.includes(newTeacher.name)) return false;
  
  // 기존 교사 시수 감소
  currentTeachers.forEach(teacherName => {
    if (teacherHours[teacherName]) {
      teacherHours[teacherName].current = Math.max(0, teacherHours[teacherName].current - 1);
    }
  });
  
  // 새 교사로 교체
  currentSlot.teachers = [newTeacher.name];
  
  // 새 교사 시수 증가
  if (teacherHours[newTeacher.name]) {
    teacherHours[newTeacher.name].current++;
  }
  
  return true;
};

// 교사 배정 최적화 가능 여부 확인 (시수 제한 엄격 적용)
const canOptimizeTeacherAssignment = (
  schedule: Schedule,
  className: string,
  day: string,
  period: number,
  subjectName: string,
  newTeacher: any,
  data: TimetableData,
  teacherHours: TeacherHoursTracker
): boolean => {
  // 교사 시수 제한 엄격 확인
  const currentHours = teacherHours[newTeacher.name]?.current || 0;
  const maxHours = newTeacher.max_hours_per_week || teacherHours[newTeacher.name]?.max || newTeacher.maxHours || 22;
  
  if (currentHours >= maxHours) {
    return false; // 시수 초과 교사는 교체 불가
  }
  
  // 제약조건 검증
  const unavailableCheck = checkTeacherUnavailable(newTeacher, day, period);
  if (!unavailableCheck.allowed) {
    return false;
  }
  
  // 교사 중복 배정 확인
  const teacherConflict = checkTeacherTimeConflict(schedule, newTeacher.name, day, period, className);
  if (teacherConflict) {
    return false;
  }
  
  // 교사가 해당 과목을 가르칠 수 있는지 확인
  if (!newTeacher.subjects?.includes(subjectName)) {
    return false;
  }
  
  // 해당 학급 시수 제한 확인
  const classKey = convertClassNameToKey(className);
  const classHoursLimit = newTeacher.weeklyHoursByGrade?.[classKey] || 0;
  const currentClassHours = getCurrentTeacherHours(schedule, newTeacher.name, className);
  
  if (classHoursLimit > 0 && currentClassHours >= classHoursLimit) {
    return false; // 학급 시수 제한 초과 시 교체 불가
  }
  
  return true;
}; 

// 교사 시수 일치 검증 함수 (공동수업 고려)
const validateTeacherHoursAlignment = (
  schedule: Schedule,
  data: TimetableData,
  teacherHours: TeacherHoursTracker,
  addLog: (message: string, type?: string) => void
): { isValid: boolean; issues: string[]; teacherDetails: Record<string, any> } => {
  const issues: string[] = [];
  const teachers = data.teachers || [];
  const classNames = Object.keys(schedule);
  const teacherDetails: Record<string, any> = {};
  
  addLog('🔍 교사별 시수 일치 검증을 시작합니다.', 'info');
  
  teachers.forEach(teacher => {
    const teacherName = teacher.name;
    const currentTotalHours = teacherHours[teacherName]?.current || 0;
    
    // 1. 교사별 총 주간시수 계산 (실제 배치된 시수)
    let actualTotalHours = 0;
    let classHoursBreakdown: Record<string, number> = {};
    
    classNames.forEach(className => {
      let classHours = 0;
      DAYS.forEach(day => {
        if (schedule[className] && schedule[className][day]) {
          Object.values(schedule[className][day]).forEach(slot => {
            if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.includes(teacherName)) {
              classHours++;
              actualTotalHours++;
            }
          });
        }
      });
      if (classHours > 0) {
        classHoursBreakdown[className] = classHours;
      }
    });
    
    // 2. 교사별 학급별 요구시수 계산
    let requiredTotalHours = 0;
    let requiredClassHours: Record<string, number> = {};
    
    // 교사가 담당하는 과목들
    const teacherSubjects = teacher.subjects || [];
    
    teacherSubjects.forEach(subjectName => {
      const subject = data.subjects?.find(s => s.name === subjectName);
      if (!subject) return;
      
      classNames.forEach(className => {
        // 교사별 학급 시수 설정 확인
        const classKey = convertClassNameToKey(className);
        let teacherClassHours = 0;
        
        // 1순위: weeklyHoursByGrade 설정
        if (teacher.weeklyHoursByGrade && teacher.weeklyHoursByGrade[classKey] !== undefined) {
          teacherClassHours = teacher.weeklyHoursByGrade[classKey];
        }
        // 2순위: classWeeklyHours 설정
        else if (teacher.classWeeklyHours && teacher.classWeeklyHours[className] !== undefined) {
          teacherClassHours = teacher.classWeeklyHours[className];
        }
        // 3순위: 과목 기본 시수
        else {
          teacherClassHours = subject.weekly_hours || 1;
        }
        
        if (teacherClassHours > 0) {
          requiredClassHours[className] = (requiredClassHours[className] || 0) + teacherClassHours;
          requiredTotalHours += teacherClassHours;
        }
      });
    });
    
    // 3. 공동수업 고려한 시수 조정
    const coTeachingAdjustments = calculateCoTeachingAdjustments(schedule, teacherName, data);
    
    // 공동수업으로 인한 시수 조정 적용
    Object.keys(coTeachingAdjustments).forEach(className => {
      const adjustment = coTeachingAdjustments[className];
      if (adjustment > 0) {
        requiredClassHours[className] = (requiredClassHours[className] || 0) + adjustment;
        requiredTotalHours += adjustment;
        addLog(`📊 ${teacherName} ${className}: 공동수업으로 인한 시수 조정 +${adjustment}시간`, 'info');
      }
    });
    
    // 4. 시수 일치 검증
    const totalHoursDiff = Math.abs(actualTotalHours - requiredTotalHours);
    const isTotalHoursMatch = totalHoursDiff <= 1; // 1시간 차이는 허용
    
    if (!isTotalHoursMatch) {
      issues.push(`${teacherName}: 총 시수 불일치 (실제: ${actualTotalHours}시간, 요구: ${requiredTotalHours}시간, 차이: ${totalHoursDiff}시간)`);
      addLog(`⚠️ ${teacherName} 총 시수 불일치: 실제 ${actualTotalHours}시간 vs 요구 ${requiredTotalHours}시간`, 'warning');
    }
    
    // 5. 학급별 시수 일치 검증
    const classBreakdown: Record<string, any> = {};
    Object.keys(requiredClassHours).forEach(className => {
      const requiredHours = requiredClassHours[className];
      const actualHours = classHoursBreakdown[className] || 0;
      const classHoursDiff = Math.abs(actualHours - requiredHours);
      
      classBreakdown[className] = {
        actual: actualHours,
        required: requiredHours,
        difference: actualHours - requiredHours
      };
      
      if (classHoursDiff > 1) { // 1시간 차이는 허용
        issues.push(`${teacherName} ${className}: 학급별 시수 불일치 (실제: ${actualHours}시간, 요구: ${requiredHours}시간, 차이: ${classHoursDiff}시간)`);
        addLog(`⚠️ ${teacherName} ${className} 시수 불일치: 실제 ${actualHours}시간 vs 요구 ${requiredHours}시간`, 'warning');
      } else {
        addLog(`✅ ${teacherName} ${className}: 시수 일치 (${actualHours}시간)`, 'success');
      }
    });
    
    // 6. 교사별 상세 정보 저장
    teacherDetails[teacherName] = {
      actualTotalHours,
      requiredTotalHours,
      totalDifference: actualTotalHours - requiredTotalHours,
      classBreakdown,
      coTeachingAdjustments
    };
    
    // 7. 상세 정보 로깅
    addLog(`📊 ${teacherName} 시수 분석:`, 'info');
    addLog(`   - 총 실제 시수: ${actualTotalHours}시간`, 'info');
    addLog(`   - 총 요구 시수: ${requiredTotalHours}시간`, 'info');
    addLog(`   - 학급별 배치: ${JSON.stringify(classHoursBreakdown)}`, 'info');
    addLog(`   - 학급별 요구: ${JSON.stringify(requiredClassHours)}`, 'info');
  });
  
  const isValid = issues.length === 0;
  
  if (isValid) {
    addLog('🎉 모든 교사의 시수가 학급별 요구사항과 일치합니다!', 'success');
  } else {
    addLog(`❌ ${issues.length}건의 시수 불일치 문제가 발견되었습니다.`, 'error');
  }
  
  return { isValid, issues, teacherDetails };
};

// 공동수업으로 인한 시수 조정 계산
const calculateCoTeachingAdjustments = (
  schedule: Schedule,
  teacherName: string,
  data: TimetableData
): Record<string, number> => {
  const adjustments: Record<string, number> = {};
  const classNames = Object.keys(schedule);
  
  // 공동수업 제약조건 확인
  const coTeachingConstraints = (data.constraints?.must || []).filter(c =>
    c.type === 'specific_teacher_co_teaching' && 
    (c.mainTeacher === teacherName || (c.coTeachers && c.coTeachers.includes(teacherName)))
  );
  
  coTeachingConstraints.forEach(constraint => {
    const { mainTeacher, coTeachers, subject } = constraint;
    
    if (!subject) return;
    
    // 해당 과목의 공동수업 배치 현황 확인
    classNames.forEach(className => {
      let coTeachingHours = 0;
      
      DAYS.forEach(day => {
        if (schedule[className] && schedule[className][day]) {
          Object.values(schedule[className][day]).forEach(slot => {
            if (slot && typeof slot === 'object' && 
                slot.subject === subject && 
                slot.isCoTeaching && 
                slot.teachers && 
                slot.teachers.includes(teacherName)) {
              coTeachingHours++;
            }
          });
        }
      });
      
      if (coTeachingHours > 0) {
        // 공동수업으로 인한 추가 시수 계산
        // 주교사인 경우 전체 시수, 부교사인 경우 참여도에 따른 시수
        if (mainTeacher === teacherName) {
          adjustments[className] = (adjustments[className] || 0) + coTeachingHours;
        } else if (coTeachers && coTeachers.includes(teacherName)) {
          // 부교사의 경우 참여도 계산 (기본 50%로 가정)
          const participationRate = 0.5;
          adjustments[className] = (adjustments[className] || 0) + Math.round(coTeachingHours * participationRate);
        }
      }
    });
  });
  
  return adjustments;
}; 