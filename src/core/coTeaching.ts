import { Schedule, Teacher, TimetableData } from '../types';
import { DAYS, getCurrentTeacherHours, convertClassNameToKey } from '../utils/helpers';
import { findAvailableSlots } from './slotFinder';
import { validateSlotPlacement } from './constraints';

// 공동수업 제약조건 처리 (주교사의 모든 수업에 부교사 자동 페어링)
export const processCoTeachingConstraints = (
  schedule: Schedule,
  data: TimetableData,
  teacherHours: any,
  addLog: (message: string, type?: string) => void
): number => {
  const coTeachingConstraints = (data.constraints?.must || []).filter(c =>
    c.type === 'specific_teacher_co_teaching'
  );

  addLog(`공동수업 제약조건 ${coTeachingConstraints.length}개를 처리합니다.`, 'info');
  let appliedCount = 0;

  coTeachingConstraints.forEach(constraint => {
    const { mainTeacher, coTeachers, subject } = constraint;
    
    if (!mainTeacher || !coTeachers || coTeachers.length === 0) {
      addLog(`경고: 공동수업 제약조건에 주교사 또는 부교사 정보가 없습니다.`, 'warning');
      return;
    }

    // 주교사와 부교사들이 모두 존재하는지 확인
    const mainTeacherObj = data.teachers.find(t => t.name === mainTeacher);
    const coTeacherObjs = coTeachers.map(name => data.teachers.find(t => t.name === name)).filter((t): t is Teacher => t !== undefined);

    if (!mainTeacherObj) {
      addLog(`경고: 주교사 ${mainTeacher}가 존재하지 않습니다.`, 'warning');
      return;
    }

    if (coTeacherObjs.length === 0) {
      addLog(`경고: 부교사들이 존재하지 않습니다.`, 'warning');
      return;
    }

    // 부교사들의 참여 균형을 추적하기 위한 카운터
    const coTeacherParticipation: Record<string, number> = {};
    coTeachers.forEach(name => {
      coTeacherParticipation[name] = 0;
    });

    // 대상 과목 결정 (제약조건에 명시된 과목 또는 주교사가 가르칠 수 있는 모든 과목)
    // 주교사 A가 수업하는 **모든** 시간에 공동수업 적용
    let targetSubjects = subject ? [subject] : (mainTeacherObj.subjects || []);
    
    // 음포 교사의 경우 원어민 과목만 처리하도록 제한
    if (mainTeacher === '음포') {
      targetSubjects = ['원어민'];
    }
    
    addLog(`주교사 ${mainTeacher}의 공동수업 대상 과목: ${targetSubjects.join(', ')}`, 'info');
    
    // 대상 학급들 결정 (주교사가 담당하는 모든 학급)
    const allClassNames = Object.keys(schedule);
    const targetClassList = allClassNames.filter((className: string) => {
      if (data.classWeeklyHours && data.classWeeklyHours[className] === 0) {
        return false;
      }
      const classKey = className.replace(/(\d+)학년\s+(\d+)반/, '$1학년-$2');
      const hasClassAssignment = (mainTeacherObj.classWeeklyHours && mainTeacherObj.classWeeklyHours[className] > 0) ||
                                (mainTeacherObj.weeklyHoursByGrade && mainTeacherObj.weeklyHoursByGrade[classKey] > 0);
      return hasClassAssignment;
    });

    // 각 대상 학급에서 주교사의 수업을 찾아 부교사 페어링
    targetClassList.forEach((className: string) => {
      if (data.classWeeklyHours && data.classWeeklyHours[className] === 0) {
        return;
      }

      const classKey = className.replace(/(\d+)학년\s+(\d+)반/, '$1학년-$2');
      const hasClassAssignment = (mainTeacherObj.classWeeklyHours && mainTeacherObj.classWeeklyHours[className] > 0) ||
                                (mainTeacherObj.weeklyHoursByGrade && mainTeacherObj.weeklyHoursByGrade[classKey] > 0);
      
      if (!hasClassAssignment) {
        return;
      }

      targetSubjects.forEach(targetSubject => {
        if (!mainTeacherObj.subjects.includes(targetSubject)) {
          return;
        }

        // 주교사가 해당 과목을 가르칠 수 있는 부교사들 찾기
        // 원어민-영어 간 공동수업 허용
        const availableCoTeachers = coTeacherObjs.filter((coTeacher: Teacher) => {
          // 정확히 같은 과목을 가르칠 수 있는 경우
          if (coTeacher.subjects.includes(targetSubject)) {
            return true;
          }
          
          // 원어민-영어 간 공동수업 허용
          if (targetSubject === '원어민' && coTeacher.subjects.includes('영어')) {
            return true;
          }
          if (targetSubject === '영어' && coTeacher.subjects.includes('원어민')) {
            return true;
          }
          
          return false;
        });

        if (availableCoTeachers.length === 0) {
          addLog(`경고: ${targetSubject} 과목을 가르칠 수 있는 부교사가 없습니다. (부교사 과목: ${coTeacherObjs.map(t => t.subjects.join(',')).join(' | ')})`, 'warning');
          return;
        }
        
        addLog(`${targetSubject} 과목에 사용 가능한 부교사: ${availableCoTeachers.map(t => t.name).join(', ')}`, 'info');

        // 주교사의 해당 과목 수업 시수 확인 (지정된 시간 수로 제한)
        const mainTeacherTargetHours = mainTeacherObj.classWeeklyHours?.[className] || 
                                     mainTeacherObj.weeklyHoursByGrade?.[classKey] || 0;

        if (mainTeacherTargetHours === 0) {
          addLog(`주교사 ${mainTeacher}는 ${className}에서 ${targetSubject} 수업 시수가 0시간입니다.`, 'info');
          return;
        }
        
        addLog(`주교사 ${mainTeacher}의 ${className} ${targetSubject} 수업: ${mainTeacherTargetHours}시간`, 'info');

                // 주교사의 수업을 배치할 슬롯들 찾기 (더 적극적으로)
        let slots = findAvailableSlots(schedule, className, mainTeacherObj, targetSubject, data, false);
        
        // 슬롯이 없으면 응급 모드로 재시도 (원어민 과목의 경우 특히 중요)
        if (slots.length === 0 && targetSubject === '원어민') {
          slots = findAvailableSlots(schedule, className, mainTeacherObj, targetSubject, data, false, true);
          addLog(`⚠️ ${className} ${targetSubject} 공동수업을 위해 응급 모드 슬롯 사용`, 'warning');
        }
        
        // 주교사의 수업을 배치하고 부교사 페어링
        let placedCount = 0;
        const maxPlacements = Math.min(mainTeacherTargetHours, slots.length);

        // 슬롯을 랜덤하게 섞어서 더 균형있게 배치
        const shuffledSlots = [...slots].sort(() => Math.random() - 0.5);

        for (let i = 0; i < maxPlacements; i++) {
          const slot = shuffledSlots[i];
          
          // 부교사 선택 (균형 있게, 랜덤 또는 균형 기준)
          const selectedCoTeacher = selectBalancedCoTeacher(availableCoTeachers, coTeacherParticipation, slot, data);
          
          if (!selectedCoTeacher) {
            addLog(`경고: ${slot.day} ${slot.period}교시에 사용 가능한 부교사가 없습니다.`, 'warning');
            continue;
          }
          
          addLog(`부교사 선택: ${selectedCoTeacher.name} (참여 횟수: ${coTeacherParticipation[selectedCoTeacher.name]})`, 'info');

          // 공동수업 배치 전 최종 검증
          if (!validateSlotPlacement(schedule, className, slot.day, slot.period, mainTeacherObj, targetSubject, data, addLog)) {
            addLog(`경고: ${className} ${slot.day} ${slot.period}교시 공동수업 배치 검증 실패`, 'warning');
            continue;
          }
          
          // 공동수업 배치
          schedule[className][slot.day][slot.slotIndex] = {
            subject: targetSubject,
            teachers: [mainTeacher, selectedCoTeacher.name],
            isCoTeaching: true,
            isFixed: false,
            source: 'constraint',
            constraintType: 'specific_teacher_co_teaching',
            mainTeacher: mainTeacher,
            coTeachers: [selectedCoTeacher.name]
          };

          // 시수 업데이트
          if (teacherHours[mainTeacher]) {
            teacherHours[mainTeacher].current++;
            teacherHours[mainTeacher].subjects[targetSubject] = 
              (teacherHours[mainTeacher].subjects[targetSubject] || 0) + 1;
          }

          if (teacherHours[selectedCoTeacher.name]) {
            teacherHours[selectedCoTeacher.name].current++;
            teacherHours[selectedCoTeacher.name].subjects[targetSubject] = 
              (teacherHours[selectedCoTeacher.name].subjects[targetSubject] || 0) + 1;
          }

          // 부교사 참여 카운터 업데이트
          coTeacherParticipation[selectedCoTeacher.name]++;

          placedCount++;
          appliedCount++;
          
          addLog(`공동수업 배치: ${className} ${slot.day}요일 ${slot.period}교시 - ${targetSubject} (${mainTeacher} + ${selectedCoTeacher.name})`, 'success');
        }

        if (placedCount > 0) {
          addLog(`✅ ${className} ${targetSubject}: ${placedCount}개 공동수업 배치 완료`, 'success');
        }
      });
    });

    // 부교사 참여 균형 보고
    const participationReport = Object.entries(coTeacherParticipation)
      .map(([name, count]) => `${name}: ${count}회`)
      .join(', ');
    addLog(`📊 부교사 참여 현황: ${participationReport}`, 'info');
  });

  addLog(`공동수업 제약조건 처리 완료: 총 ${appliedCount}개 공동수업 배치`, 'success');
  return appliedCount;
};

// 공동수업 제약조건 검증 (주교사와 부교사 페어링 확인)
export const validateCoTeachingConstraints = (
  schedule: Schedule,
  data: TimetableData,
  addLog: (message: string, type?: string) => void
): boolean => {
  const coTeachingConstraints = (data.constraints?.must || []).filter(c =>
    c.type === 'specific_teacher_co_teaching'
  );

  if (coTeachingConstraints.length === 0) {
    return true; // 공동수업 제약조건이 없음
  }

  addLog(`🔍 공동수업 제약조건 ${coTeachingConstraints.length}개 검증`, 'info');
  let allValid = true;

  coTeachingConstraints.forEach(constraint => {
    const { mainTeacher, coTeachers, subject } = constraint;
    
    if (!mainTeacher || !coTeachers || coTeachers.length === 0) {
      addLog(`⚠️ 공동수업 제약조건에 주교사 또는 부교사 정보가 없습니다.`, 'warning');
      return;
    }

    let mainTeacherClasses = 0;
    let coTeachingClasses = 0;
    let violations = 0;

    // 주교사의 모든 수업을 찾아서 부교사 페어링 확인
    Object.keys(schedule).forEach(className => {
      DAYS.forEach(day => {
        const maxPeriods = data.base?.periods_per_day?.[day] || 7;
        
        for (let period = 1; period <= maxPeriods; period++) {
          const slotIndex = period - 1;
          const slot = schedule[className]?.[day]?.[slotIndex];
          
          if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.includes(mainTeacher)) {
            mainTeacherClasses++;
            
            // 공동수업으로 표시되어 있는지 확인
            if (slot.isCoTeaching) {
              coTeachingClasses++;
              
              // 부교사가 페어링되어 있는지 확인
              const hasCoTeacher = coTeachers.some(coTeacher => 
                slot.teachers.includes(coTeacher)
              );
              
              if (!hasCoTeacher) {
                violations++;
                addLog(`❌ 공동수업 위반: ${className} ${day} ${period}교시 ${mainTeacher} 교사 수업에 부교사가 페어링되지 않았습니다.`, 'error');
                allValid = false;
              }
            } else {
              // 주교사 수업인데 공동수업으로 표시되지 않음
              violations++;
              addLog(`❌ 공동수업 위반: ${className} ${day} ${period}교시 ${mainTeacher} 교사 수업이 공동수업으로 표시되지 않았습니다.`, 'error');
              allValid = false;
            }
          }
        }
      });
    });

    if (mainTeacherClasses === 0) {
      addLog(`⚠️ 주교사 ${mainTeacher}의 수업이 스케줄에 배치되지 않았습니다.`, 'warning');
    } else if (violations === 0) {
      addLog(`✅ 공동수업 제약조건 검증 통과: ${mainTeacher} 교사 ${mainTeacherClasses}개 수업 중 ${coTeachingClasses}개 공동수업`, 'success');
    }
  });

  return allValid;
};

// 균형 있는 부교사 선택 함수 (랜덤 + 균형 기준)
const selectBalancedCoTeacher = (
  availableCoTeachers: Teacher[],
  coTeacherParticipation: Record<string, number>,
  slot: any,
  data: TimetableData
): Teacher | null => {
  // 해당 슬롯에서 사용 가능한 부교사들 필터링
  const slotAvailableCoTeachers = availableCoTeachers.filter(coTeacher => {
    // 부교사가 해당 시간에 수업 가능한지 확인 (수업 불가 시간 체크)
    const isAvailable = !coTeacher.unavailable?.some(([day, period]) => 
      day === slot.day && period === slot.period
    );
    
    // 부교사 시수 제한 확인 (엄격한 균등 분배는 요구되지 않음)
    const hasCapacity = true; // 기본적으로 허용, 균형 우선 선택으로 분배 조절
    
    return isAvailable && hasCapacity;
  });

  if (slotAvailableCoTeachers.length === 0) {
    return null;
  }

  // 균형 있는 선택: 가장 적게 참여한 부교사 우선 선택
  const minParticipation = Math.min(...slotAvailableCoTeachers.map(t => coTeacherParticipation[t.name]));
  const leastParticipated = slotAvailableCoTeachers.filter(t => coTeacherParticipation[t.name] === minParticipation);

  // 동일한 참여 횟수의 부교사들 중에서 랜덤 선택 (균형 + 랜덤)
  return leastParticipated[Math.floor(Math.random() * leastParticipated.length)];
};

// 수업 배치 전 최종 안전 확인 (0시간 설정 학급 체크)
const canPlaceClassInSchedule = (className: string, data: TimetableData): boolean => {
  return !(data.classWeeklyHours && data.classWeeklyHours[className] === 0);
}; 