import { Schedule, TimetableData, Teacher, PlacementPlan, TeacherHoursTracker, GenerationLog, ScheduleSlot } from '../types';
import { DAYS, generateClassNames, getDefaultWeeklyHours, getCurrentSubjectHours, initializeTeacherHours, convertClassNameToKey, getCurrentTeacherHours } from '../utils/helpers';
import { findAvailableSlots } from './slotFinder';
import { validateSlotPlacement, checkTeacherUnavailable, validateCoTeachingConstraints, checkSubjectFixedOnly, checkTeacherTimeConflict, validateScheduleTeacherConflicts } from './constraints';
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
  
  // 4. 주간 시수가 많은 과목 우선순위 증가
  const weeklyHours = subject?.weekly_hours || 1;
  priority += weeklyHours * 2;
  
  return priority;
};

// 과목별 배치 계획 수립
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
          for (let i = 0; i < remainingHours; i++) {
            // 더 지능적인 우선순위 계산
            const basePriority = calculatePlacementPriority(className, subject.name, availableTeachers, data);
            const randomFactor = Math.random() * 0.1; // 작은 랜덤 요소 추가
            
            subjectPlacementPlan.push({
              className,
              subject: subject.name,
              availableTeachers,
              priority: basePriority + randomFactor
            });
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

  // 우선순위에 따라 정렬 (높은 우선순위부터)
  placementPlan.sort((a, b) => b.priority - a.priority);

  while (placementPlan.length > 0 && attempts < maxAttempts) {
    attempts++;
    const placement = placementPlan.shift()!;

    // 교사별 시수 균형을 고려하여 교사 선택
    const teachersWithPriority = placement.availableTeachers.map(teacher => {
      const currentHours = teacherHours[teacher.name]?.current || 0;
      const maxHours = teacherHours[teacher.name]?.max || 25;
      const remainingHours = maxHours - currentHours;

      let priority = 0;

      // 공동수업 제약조건이 있는 교사는 우선순위를 낮춤
      const coTeachingConstraints = (data.constraints?.must || []).filter(c =>
        c.type === 'specific_teacher_co_teaching' && c.mainTeacher === teacher.name
      );
      if (coTeachingConstraints.length > 0) {
        priority += 1000;
      }

      // 교사 시수 부족도 (부족할수록 우선)
      priority += Math.max(0, 25 - remainingHours) * 100;

      // 랜덤 요소
      priority += Math.random() * 10;

      return { teacher, priority, remainingHours };
    });

    teachersWithPriority.sort((a, b) => a.priority - b.priority);

    // 적합한 교사와 슬롯 찾기
    let placed = false;
    for (const teacherInfo of teachersWithPriority) {
      const { teacher } = teacherInfo;

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

        // 수업 배치
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
export const generateTimetable = async (
  data: TimetableData,
  addLog: (message: string, type?: string) => void,
  setProgress?: (progress: number) => void
): Promise<{ schedule: Schedule; teacherHours: TeacherHoursTracker; stats: any }> => {
  addLog('🚀 시간표 생성을 시작합니다.', 'info');
  setProgress?.(10);

  // 1단계: 스케줄 초기화
  addLog('1단계: 스케줄을 초기화합니다.', 'info');
  const schedule = initializeSchedule(data);
  setProgress?.(20);

  // 2단계: 교사 시수 추적기 초기화
  addLog('2단계: 교사 시수를 추적합니다.', 'info');
  const teacherHours = initializeTeacherHours(data.teachers || []);
  setProgress?.(30);

  // 3단계: 고정 수업 적용 (최우선)
  addLog('3단계: 고정 수업을 먼저 적용합니다.', 'info');
  const fixedCount = applyFixedClasses(schedule, data, addLog);
  addLog(`✅ 고정 수업 ${fixedCount}개 적용 완료`, 'success');
  setProgress?.(40);

  // 4단계: 공동수업 제약조건 처리 (두 번째 우선순위)
  addLog('4단계: 공동수업을 랜덤하게 배치합니다.', 'info');
  const coTeachingCount = processCoTeachingConstraints(schedule, data, teacherHours, addLog);
  addLog(`✅ 공동수업 ${coTeachingCount}개 배치 완료`, 'success');
  setProgress?.(50);

  // 5단계: 나머지 수업 배치 계획 수립 (제약조건 준수)
  addLog('5단계: 나머지 수업 배치 계획을 수립합니다.', 'info');
  const placementPlan = createPlacementPlan(schedule, data, addLog);
  addLog(`총 ${placementPlan.length}개의 수업을 제약조건을 지켜서 배치합니다.`, 'info');
  setProgress?.(60);

  // 6a단계: 나머지 수업 랜덤 배치 (제약조건 준수)
  addLog('6a단계: 나머지 수업을 제약조건을 지켜서 랜덤하게 배치합니다.', 'info');
  const placedCount = executePlacementPlan(schedule, placementPlan, data, teacherHours, addLog);
  addLog(`✅ 나머지 수업 ${placedCount}개 배치 완료`, 'success');
  setProgress?.(65);

  // 6b단계: 교사 시수 일치 검증 (공동수업 고려)
  addLog('6b단계: 교사의 총 주간시수와 학급별 필요한 주간시수를 비교 검증합니다.', 'info');
  const teacherHoursValidation = validateTeacherHoursAlignment(schedule, data, teacherHours, addLog);
  if (teacherHoursValidation.isValid) {
    addLog('✅ 교사 시수 일치 검증 완료: 모든 교사의 시수가 학급별 요구사항과 일치합니다.', 'success');
  } else {
    addLog(`⚠️ 교사 시수 불일치 발견: ${teacherHoursValidation.issues.length}건의 문제가 있습니다.`, 'warning');
  }
  setProgress?.(70);

  // 7단계: 빈 슬롯 채우기
  addLog('7단계: 빈 슬롯을 채웁니다.', 'info');
  const filledSlots = fillEmptySlots(schedule, data, teacherHours, addLog);
  setProgress?.(75);

  // 8단계: 교사별 수업 재조정 (채움률 향상)
  addLog('8단계: 교사별 수업을 재조정하여 채움률을 향상시킵니다.', 'info');
  const optimizedCount = optimizeTeacherAssignments(schedule, data, teacherHours, addLog);
  addLog(`✅ 교사별 수업 재조정 완료: ${optimizedCount}개 최적화`, 'success');
  setProgress?.(80);

  // 9단계: 교사 시수 균형 재조정
  addLog('9단계: 교사 시수 균형을 재조정합니다.', 'info');
  const rebalancedCount = rebalanceTeacherHours(schedule, data, teacherHours, addLog);
  addLog(`✅ 교사 시수 재조정 완료: ${rebalancedCount}개 수정`, 'success');
  setProgress?.(85);

  // 10단계: 교사 중복 배정 최종 검증 (절대 필수!)
  addLog('10단계: 교사 중복 배정을 최종 검증합니다.', 'info');
  const teacherConflictValid = validateScheduleTeacherConflicts(schedule, addLog);
  if (!teacherConflictValid) {
    addLog('🚨 교사 중복 배정이 발견되었습니다! 시간표를 재생성해주세요.', 'error');
  }
  setProgress?.(87);

  // 11단계: 공동수업 제약조건 검증
  addLog('11단계: 공동수업 제약조건을 검증합니다.', 'info');
  const coTeachingValid = validateCoTeachingConstraints(schedule, data, addLog);
  if (!coTeachingValid) {
    addLog('⚠️ 공동수업 제약조건 검증에서 문제가 발견되었습니다.', 'warning');
  }
  setProgress?.(90);

  // 12단계: 통계 계산
  addLog('12단계: 통계를 계산합니다.', 'info');
  const stats = calculateScheduleStats(schedule, teacherHours);
  setProgress?.(100);

  addLog(`시간표 생성 완료: ${placedCount + filledSlots}개 수업 배치`, 'success');
  setProgress?.(100);

  return { schedule, teacherHours, stats };
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
    
    // 시수가 크게 부족한 교사 처리
    if (currentHours < targetHours * 0.7) {
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
  
  // 1단계: 교사별 시수 부족도 분석
  const teacherDeficits = teachers.map(teacher => {
    const currentHours = teacherHours[teacher.name]?.current || 0;
    const targetHours = teacher.maxHours || 18;
    const deficit = Math.max(0, targetHours - currentHours);
    
    return {
      teacher,
      currentHours,
      targetHours,
      deficit,
      priority: deficit * 10 + Math.random() * 5 // 부족도 + 랜덤 요소
    };
  }).sort((a, b) => b.priority - a.priority); // 부족도가 높은 교사 우선
  
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

// 가장 적합한 교사 찾기
const findBestTeacherForSubject = (
  availableTeachers: any[],
  subjectName: string,
  className: string,
  schedule: Schedule,
  data: TimetableData,
  teacherHours: TeacherHoursTracker
): any => {
  if (availableTeachers.length === 0) return null;
  
  // 교사별 우선순위 계산
  const teacherPriorities = availableTeachers.map(teacher => {
    let priority = 0;
    
    // 1. 시수 부족도 (부족할수록 높은 우선순위)
    const currentHours = teacherHours[teacher.name]?.current || 0;
    const targetHours = teacher.maxHours || 18;
    const deficit = Math.max(0, targetHours - currentHours);
    priority += deficit * 10;
    
    // 2. 해당 학급 담당 경험 (담당 시수 제한 확인)
    const classKey = convertClassNameToKey(className);
    const classHoursLimit = teacher.weeklyHoursByGrade?.[classKey] || 0;
    const currentClassHours = getCurrentTeacherHours(schedule, teacher.name, className);
    
    if (classHoursLimit > 0 && currentClassHours >= classHoursLimit) {
      priority -= 1000; // 학급 시수 제한 초과 시 배제
    }
    
    // 3. 랜덤 요소
    priority += Math.random() * 5;
    
    return { teacher, priority };
  });
  
  teacherPriorities.sort((a, b) => b.priority - a.priority);
  return teacherPriorities[0]?.teacher || null;
};

// 슬롯에 과목 배치 시도
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
  // 제약조건 검증
  const unavailableCheck = checkTeacherUnavailable(teacher, day, period);
  if (!unavailableCheck.allowed) {
    return false;
  }
  
  // 교사 중복 배정 확인
  const teacherConflict = checkTeacherTimeConflict(schedule, teacher.name, day, period, className);
  if (teacherConflict) {
    return false;
  }
  
  // 슬롯 배치 검증
  const slotValid = validateSlotPlacement(schedule, className, day, period, teacher, subject.name, data, addLog);
  if (!slotValid) {
    return false;
  }
  
  // 배치 실행
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

// 교사 배정 최적화 가능 여부 확인
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