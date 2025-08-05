import React, { useState } from 'react';
import { generateTimetable } from '../core/schedulerMain';
import { 
  getCurrentSubjectHours,
  getCurrentTeacherHours,
  getClassSubjectHours,
  convertClassNameToKey,
  checkTeacherClassHoursLimit,
  checkTeacherUnavailable,
  isClassDisabled,
  canPlaceClassInSchedule,
  validateSlotPlacement
} from './TimetableGenerationHelpers';
import {
  validateTeacherConstraints,
  validateClassHoursConstraints,
  validateTeacherTimeConflicts,
  validateTeacherUnavailableTimes
} from './TimetableGenerationValidation';
import {
  findAvailableSlots,
  applyFixedClasses,
  processCoTeachingConstraints,
  validateCoTeachingConstraints,
  validateDailySubjectOnceConstraints,
  getScheduleStats
} from './TimetableGenerationCore';

function TimetableGeneration({ data, updateData, nextStep, prevStep }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationLog, setGenerationLog] = useState([]);
  const [generationResults, setGenerationResults] = useState(null);
  const [autoGenerationCount, setAutoGenerationCount] = useState(0);
  const [bestFillRate, setBestFillRate] = useState(0);
  const [bestSchedule, setBestSchedule] = useState(null);

  const days = ['월', '화', '수', '목', '금'];

  // 분리된 헬퍼 함수들 사용

  // 헬퍼 함수: 교사의 학급별 시수 제한 확인
  const checkTeacherClassHoursLimit = (teacher, className, schedule) => {
    // classWeeklyHours와 weeklyHoursByGrade 두 형태 모두 지원
    let maxHours = null;
    
    if (teacher.classWeeklyHours && teacher.classWeeklyHours[className]) {
      maxHours = teacher.classWeeklyHours[className];
    } else if (teacher.weeklyHoursByGrade) {
      const classKey = convertClassNameToKey(className);
      maxHours = teacher.weeklyHoursByGrade[classKey];
    }
    
    if (maxHours === null || maxHours === undefined) {
      return { allowed: true, reason: 'no_limit' };
    }
    
    // 0시간 설정된 경우 완전히 차단
    if (maxHours === 0) {
      return { 
        allowed: false, 
        reason: 'class_hours_zero',
        current: 0,
        max: 0
      };
    }
    
    const currentHours = getCurrentTeacherHours(schedule, teacher.name, className);
    
    if (currentHours >= maxHours) {
      return { 
        allowed: false, 
        reason: 'class_hours_exceeded',
        current: currentHours,
        max: maxHours
      };
    }
    
    return { allowed: true, current: currentHours, max: maxHours };
  };

  // 헬퍼 함수: 교사의 수업 불가 시간 확인
  const checkTeacherUnavailable = (teacher, day, period) => {
    if (!teacher.unavailable || !Array.isArray(teacher.unavailable)) {
      return { allowed: true, reason: 'no_unavailable_times' };
    }
    
    const isUnavailable = teacher.unavailable.some(slot => {
      if (Array.isArray(slot) && slot.length >= 2) {
        return slot[0] === day && slot[1] === period;
      } else if (typeof slot === 'object' && slot.day && slot.period) {
        return slot.day === day && slot.period === period;
      }
      return false;
    });
    
    if (isUnavailable) {
      return { 
        allowed: false, 
        reason: 'teacher_unavailable',
        day: day,
        period: period
      };
    }
    
    return { allowed: true };
  };

  // 헬퍼 함수: 0시간 설정 학급 강제 확인 (추가 안전장치)
  const isClassDisabled = (className) => {
    if (data.classWeeklyHours && data.classWeeklyHours[className] === 0) {
      return true;
    }
    return false;
  };

  // 헬퍼 함수: 수업 배치 전 최종 안전 확인
  const canPlaceClassInSchedule = (className, addLog = () => {}) => {
    if (isClassDisabled(className)) {
      addLog(`🚫 배치 차단: ${className}은 0시간 설정 학급입니다.`, 'error');
      return false;
    }
    return true;
  };

  // 헬퍼 함수: 슬롯 배치 전 최종 중복 검증 (같은 교시 중복 방지)
  const validateSlotPlacement = (schedule, className, day, period, teacher, subject, addLog = () => {}) => {
    const slotIndex = period - 1;
    
    // 1. 기본 슬롯 점유 확인
    if (!schedule[className] || !schedule[className][day]) {
      addLog(`❌ 슬롯 검증 실패: ${className} ${day}요일 스케줄이 존재하지 않습니다.`, 'error');
      return false;
    }
    
    const currentSlot = schedule[className][day][slotIndex];
    if (currentSlot !== '' && currentSlot !== undefined && currentSlot !== null) {
      addLog(`❌ 슬롯 검증 실패: ${className} ${day}요일 ${period}교시가 이미 점유되어 있습니다.`, 'error');
      return false;
    }
    
    // 2. 교사 중복 배치 확인 (같은 교시에 다른 학급에서 수업하는지)
    for (const otherClassName of Object.keys(schedule)) {
      if (otherClassName !== className && schedule[otherClassName] && schedule[otherClassName][day]) {
        const otherSlot = schedule[otherClassName][day][slotIndex];
        if (otherSlot && typeof otherSlot === 'object' && otherSlot.teachers && otherSlot.teachers.includes(teacher.name)) {
          addLog(`❌ 슬롯 검증 실패: ${teacher.name} 교사가 ${day}요일 ${period}교시에 ${otherClassName}에서 이미 수업 중입니다.`, 'error');
          return false;
        }
      }
    }
    
    // 3. 학급 같은 날짜 같은 과목 중복 확인 (일일 과목 1회 제한)
    const dailySubjectOnceConstraints = [
      ...(data.constraints?.must || []).filter(c => c.type === 'class_daily_subject_once'),
      ...(data.constraints?.optional || []).filter(c => c.type === 'class_daily_subject_once')
    ];
    
    if (dailySubjectOnceConstraints.length > 0) {
      let subjectAlreadyScheduled = false;
      if (schedule[className][day]) {
        schedule[className][day].forEach(slot => {
          if (slot && typeof slot === 'object' && slot.subject === subject) {
            subjectAlreadyScheduled = true;
          }
        });
      }
      
      if (subjectAlreadyScheduled) {
        const hasAllSubjectsConstraint = dailySubjectOnceConstraints.some(c => c.subject === 'all');
        if (hasAllSubjectsConstraint) {
          addLog(`❌ 슬롯 검증 실패: ${className} ${day}요일에 ${subject} 과목이 이미 배치되어 있습니다 (일일 과목 1회 제한).`, 'error');
          return false;
        }
      }
    }
    
    return true;
  };

  // 교사별 제약조건 검증 함수
  const validateTeacherConstraints = (schedule, addLog) => {
    addLog('🔍 교사별 제약조건 검증을 시작합니다.', 'info');
    
    const teachers = data.teachers || [];
    let totalViolations = 0;
    
    teachers.forEach(teacher => {
      // 1. 수업 불가 시간 위반 검증
      let unavailableViolations = 0;
      if (teacher.unavailable && Array.isArray(teacher.unavailable)) {
        teacher.unavailable.forEach(unavailableSlot => {
          let day, period;
          if (Array.isArray(unavailableSlot) && unavailableSlot.length >= 2) {
            day = unavailableSlot[0];
            period = unavailableSlot[1];
          } else if (typeof unavailableSlot === 'object' && unavailableSlot.day && unavailableSlot.period) {
            day = unavailableSlot.day;
            period = unavailableSlot.period;
          } else {
            return;
          }
          
          Object.keys(schedule).forEach(className => {
            if (schedule[className] && schedule[className][day]) {
              const slotIndex = period - 1;
              const slot = schedule[className][day][slotIndex];
              if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.includes(teacher.name)) {
                unavailableViolations++;
                totalViolations++;
                addLog(`❌ ${teacher.name} 교사: ${className} ${day}요일 ${period}교시 수업 불가 시간 위반`, 'error');
              }
            }
          });
        });
      }
      
      // 2. 학급별 시수 제한 위반 검증
      let classHoursViolations = 0;
      if (teacher.classWeeklyHours) {
        Object.keys(teacher.classWeeklyHours).forEach(className => {
          const maxHours = teacher.classWeeklyHours[className];
          const currentHours = getCurrentTeacherHours(schedule, teacher.name, className);
          
          if (currentHours > maxHours) {
            classHoursViolations++;
            totalViolations++;
            addLog(`❌ ${teacher.name} 교사: ${className} 학급별 시수 초과 (${currentHours}/${maxHours}시간)`, 'error');
          }
        });
      }
      
      // 교사별 결과 요약
      if (unavailableViolations === 0 && classHoursViolations === 0) {
        addLog(`✅ ${teacher.name} 교사: 모든 제약조건 준수`, 'success');
      } else {
        addLog(`⚠️ ${teacher.name} 교사: 위반 ${unavailableViolations + classHoursViolations}건 (수업불가시간: ${unavailableViolations}, 학급시수: ${classHoursViolations})`, 'warning');
      }
    });
    
    if (totalViolations === 0) {
      addLog('🎉 모든 교사의 제약조건이 준수되었습니다!', 'success');
    } else {
      addLog(`⚠️ 총 ${totalViolations}건의 교사 제약조건 위반이 발견되었습니다.`, 'warning');
    }
    
    return totalViolations;
  };

  // 학급별 시수 제한 검증 함수
  const validateClassHoursConstraints = (schedule, addLog) => {
    addLog('🔍 학급별 시수 제한 검증을 시작합니다.', 'info');
    
    const periodsPerDay = data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };
    const classNames = Object.keys(schedule);
    let totalViolations = 0;
    
    classNames.forEach(className => {
      // 0시간 설정 학급 확인
      if (data.classWeeklyHours && data.classWeeklyHours[className] === 0) {
        // 0시간 설정 학급에 수업이 배치되었는지 확인
        let hasClasses = false;
        days.forEach(day => {
          if (schedule[className] && schedule[className][day]) {
            schedule[className][day].forEach(slot => {
              if (slot && slot !== '' && slot !== undefined) {
                hasClasses = true;
              }
            });
          }
        });
        
        if (hasClasses) {
          totalViolations++;
          addLog(`❌ ${className}: 0시간 설정 학급에 수업이 배치됨 (설정 위반)`, 'error');
        } else {
          addLog(`✅ ${className}: 0시간 설정 준수 (수업 미배치)`, 'success');
        }
        return; // 0시간 설정 학급은 다른 검증 생략
      }
      
      // 1. 주간 시수 제한 확인
      const weeklyCheck = checkClassWeeklyHoursLimit(className, schedule);
      if (!weeklyCheck.allowed) {
        totalViolations++;
        if (weeklyCheck.reason === 'class_disabled') {
          addLog(`❌ ${className}: 비활성화된 학급에 수업 배치됨`, 'error');
        } else {
          addLog(`❌ ${className}: 주간 시수 초과 (${weeklyCheck.current}/${weeklyCheck.max}시간)`, 'error');
        }
      }
      
      // 2. 일일 시수 제한 확인
      days.forEach(day => {
        const dailyCheck = checkClassDailyHoursLimit(className, day, schedule);
        if (!dailyCheck.allowed) {
          totalViolations++;
          addLog(`❌ ${className} ${day}요일: 일일 시수 초과 (${dailyCheck.current}/${dailyCheck.max}시간)`, 'error');
        }
      });
      
      // 3. 빈 슬롯 확인 (설정된 교시 수 대비)
      let actualSlots = 0;
      let emptySlots = 0;
      days.forEach(day => {
        const maxPeriods = periodsPerDay[day] || 7;
        if (schedule[className] && schedule[className][day]) {
          for (let i = 0; i < maxPeriods; i++) {
            actualSlots++;
            const slot = schedule[className][day][i];
            if (!slot || slot === '' || slot === undefined) {
              emptySlots++;
            }
          }
        }
      });
      
      const fillRate = actualSlots > 0 ? ((actualSlots - emptySlots) / actualSlots * 100).toFixed(1) : 0;
      addLog(`📊 ${className}: 배정률 ${fillRate}% (${actualSlots - emptySlots}/${actualSlots}시간)`, 'info');
    });
    
    if (totalViolations === 0) {
      addLog('🎉 모든 학급의 시수 제한이 준수되었습니다!', 'success');
    } else {
      addLog(`⚠️ 총 ${totalViolations}건의 학급 시수 제한 위반이 발견되었습니다.`, 'warning');
    }
    
    return totalViolations;
  };

  // 헬퍼 함수: 학급별 주간 수업시수 제한 확인
  const checkClassWeeklyHoursLimit = (className, schedule) => {
    const periodsPerDay = data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };
    
    // 학급별 설정된 주간 시수 확인 (data.classWeeklyHours에서)
    let maxWeeklyHours = 0;
    if (data.classWeeklyHours && data.classWeeklyHours[className] !== undefined) {
      maxWeeklyHours = data.classWeeklyHours[className];
    } else {
      // 설정이 없으면 기본값 (요일별 교시 수 합계)
      maxWeeklyHours = Object.values(periodsPerDay).reduce((sum, periods) => sum + periods, 0);
    }
    
    // 0시간으로 설정된 학급은 아예 수업 배치 불가
    if (maxWeeklyHours === 0) {
      return { 
        allowed: false, 
        reason: 'class_disabled',
        current: 0,
        max: 0
      };
    }
    
    // 현재 학급의 배정된 시수 계산
    let currentHours = 0;
    days.forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        const maxPeriods = periodsPerDay[day] || 7;
        for (let i = 0; i < maxPeriods; i++) {
          const slot = schedule[className][day][i];
          if (slot && slot !== '' && slot !== undefined) {
            currentHours++;
          }
        }
      }
    });
    
    if (currentHours >= maxWeeklyHours) {
      return { 
        allowed: false, 
        reason: 'class_weekly_hours_exceeded',
        current: currentHours,
        max: maxWeeklyHours
      };
    }
    
    return { allowed: true, current: currentHours, max: maxWeeklyHours };
  };

  // 헬퍼 함수: 학급별 일일 교시 수 제한 확인
  const checkClassDailyHoursLimit = (className, day, schedule) => {
    // 먼저 해당 학급이 0시간으로 설정되었는지 확인
    if (data.classWeeklyHours && data.classWeeklyHours[className] === 0) {
      return { 
        allowed: false, 
        reason: 'class_disabled',
        current: 0,
        max: 0
      };
    }
    
    const periodsPerDay = data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };
    const maxDailyHours = periodsPerDay[day] || 7;
    
    // 현재 학급의 해당 요일 배정된 시수 계산
    let currentDailyHours = 0;
    if (schedule[className] && schedule[className][day]) {
      schedule[className][day].forEach(slot => {
        if (slot && slot !== '' && slot !== undefined) {
          currentDailyHours++;
        }
      });
    }
    
    if (currentDailyHours >= maxDailyHours) {
      return { 
        allowed: false, 
        reason: 'class_daily_hours_exceeded',
        current: currentDailyHours,
        max: maxDailyHours
      };
    }
    
    return { allowed: true, current: currentDailyHours, max: maxDailyHours };
  };

  // 사용 가능한 슬롯 찾기 함수 (공동수업 제약조건 고려)
  const findAvailableSlots = (schedule, className, teacher, subjectName, isCoTeaching = false) => {
    const availableSlots = [];
    const periodsPerDay = data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };
    
    days.forEach(day => {
      const maxPeriods = periodsPerDay[day] || 7;
      
      for (let period = 1; period <= maxPeriods; period++) {
        const slotIndex = period - 1;
        
        // 슬롯이 이미 점유되어 있는지 확인 (같은 교시 중복 방지)
        if (!schedule[className] || !schedule[className][day]) {
          continue;
        }
        
        // 해당 슬롯이 이미 사용 중인지 확인
        const currentSlot = schedule[className][day][slotIndex];
        if (currentSlot !== '' && currentSlot !== undefined && currentSlot !== null) {
          continue; // 이미 점유된 슬롯은 사용 불가
        }
        
        // 교사별 수업 불가 시간 확인 (강화된 버전)
        const unavailableCheck = checkTeacherUnavailable(teacher, day, period);
        if (!unavailableCheck.allowed) {
          continue;
        }
        
        // 교사별 학급 주간 수업시수 제한 확인 (0시간 포함)
        const classHoursCheck = checkTeacherClassHoursLimit(teacher, className, schedule);
        if (!classHoursCheck.allowed) {
          // 교사가 해당 학급을 담당하지 않거나 0시간 설정된 경우
          continue;
        }
        
        // 교사가 해당 학급을 담당하는지 추가 확인
        const classKey = convertClassNameToKey(className);
        const hasClassAssignment = (teacher.classWeeklyHours && teacher.classWeeklyHours[className] > 0) ||
                                  (teacher.weeklyHoursByGrade && teacher.weeklyHoursByGrade[classKey] > 0);
        if (!hasClassAssignment) {
          continue; // 교사가 해당 학급을 담당하지 않음
        }
        
        // 학급별 주간 수업시수 제한 확인 (강제)
        const classWeeklyCheck = checkClassWeeklyHoursLimit(className, schedule);
        if (!classWeeklyCheck.allowed) {
          continue;
        }
        
        // 학급별 일일 교시 수 제한 확인 (강제)
        const classDailyCheck = checkClassDailyHoursLimit(className, day, schedule);
        if (!classDailyCheck.allowed) {
          continue;
        }
        
        // 교사 일일 학급 중복 금지 제약조건 확인
        const hasTeacherSameClassDailyLimit = (data.constraints?.must || []).some(c =>
          c.type === 'teacher_same_class_daily_limit'
        );
        
        if (hasTeacherSameClassDailyLimit) {
          let teacherAlreadyTeaching = false;
          schedule[className][day].forEach(slot => {
            if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.includes(teacher.name)) {
              teacherAlreadyTeaching = true;
            }
          });
          
          if (teacherAlreadyTeaching) {
            continue;
          }
        }
        
        // 교사 중복 금지 제약조건 확인
        const hasNoDuplicateTeachers = (data.constraints?.must || []).some(c =>
          c.type === 'no_duplicate_teachers'
        );
        
        if (hasNoDuplicateTeachers) {
          let teacherConflict = false;
          Object.keys(schedule).forEach(otherClassName => {
            if (otherClassName !== className && schedule[otherClassName] && schedule[otherClassName][day]) {
              const otherSlot = schedule[otherClassName][day][slotIndex];
              if (otherSlot && typeof otherSlot === 'object' && otherSlot.teachers && otherSlot.teachers.includes(teacher.name)) {
                teacherConflict = true;
              }
            }
          });
          
          if (teacherConflict) {
            continue;
          }
        }
        
        // 학급 일일 과목 1회 제한 제약조건 확인 (필수 + 선택 조건)
        const dailySubjectOnceConstraints = [
          ...(data.constraints?.must || []).filter(c => c.type === 'class_daily_subject_once'),
          ...(data.constraints?.optional || []).filter(c => c.type === 'class_daily_subject_once')
        ];
        
        if (dailySubjectOnceConstraints.length > 0) {
          let subjectAlreadyScheduled = false;
          
          // 해당 날짜에 이미 같은 과목이 배정되어 있는지 확인
          schedule[className][day].forEach(slot => {
            if (slot && typeof slot === 'object' && slot.subject === subjectName) {
              subjectAlreadyScheduled = true;
            }
          });
          
          // "모든 수업에 해당" 제약조건이 있는 경우, 해당 과목에 대해서도 확인
          const allSubjectsConstraint = dailySubjectOnceConstraints.find(c => c.subject === 'all');
          if (allSubjectsConstraint) {
            // "모든 수업에 해당"은 모든 과목에 대해 일일 1회 제한을 적용하는 것
            // 현재 배정하려는 과목이 해당 날짜에 이미 배정되어 있는지 확인
            schedule[className][day].forEach(slot => {
              if (slot && typeof slot === 'object' && slot.subject === subjectName) {
                subjectAlreadyScheduled = true;
              }
            });
          }
          
          if (subjectAlreadyScheduled) {
            continue;
          }
        }
        
        // 공동수업 제약조건 확인 (완전 제외하지 않고 우선순위만 낮춤)
        const coTeachingConstraints = (data.constraints?.must || []).filter(c =>
          c.type === 'specific_teacher_co_teaching' && c.mainTeacher === teacher.name
        );
        
        if (coTeachingConstraints.length > 0 && !isCoTeaching) {
          // 이 교사는 공동수업 제약조건이 있으므로 우선순위를 낮춤
          // 하지만 완전히 제외하지는 않음 (배치 가능한 교사가 부족할 수 있으므로)
          // continue; // 이 부분을 주석 처리하여 공동수업 제약조건이 있는 교사도 사용 가능하게 함
        }
        
        availableSlots.push({ day, period, slotIndex });
      }
    });
    
    return availableSlots;
  };

  // 고정 수업 적용 함수 (개선된 버전)
  const applyFixedClasses = (schedule, addLog) => {
    const fixedClasses = data.fixedClasses || [];
    let appliedCount = 0;
    
    fixedClasses.forEach((fixedClass, index) => {
      // className이 없으면 grade와 class로부터 생성
      let className = fixedClass.className;
      if (!className && fixedClass.grade && fixedClass.class) {
        className = `${fixedClass.grade}학년 ${fixedClass.class}반`;
      }
      
      const { day, period, subject, teacher, teachers } = fixedClass;
      
      // 데이터 유효성 검사
      if (!className || !day || !period || !subject) {
        addLog(`경고: 고정 수업 ${index + 1}번째 데이터가 불완전합니다. (className: ${className}, day: ${day}, period: ${period}, subject: ${subject})`, 'warning');
        return;
      }
      
      // 0시간 설정 학급은 고정 수업도 적용하지 않음
      if (data.classWeeklyHours && data.classWeeklyHours[className] === 0) {
        addLog(`🚫 ${className}: 0시간 설정으로 고정 수업도 적용하지 않음 - ${subject}`, 'error');
        return;
      }
      
      if (schedule[className] && schedule[className][day]) {
        const slotIndex = period - 1;
        if (slotIndex >= 0 && slotIndex < schedule[className][day].length && 
            (schedule[className][day][slotIndex] === '' || schedule[className][day][slotIndex] === undefined)) {
          
          schedule[className][day][slotIndex] = {
            subject: subject,
            teachers: teachers || [teacher],
            isFixed: true,
            isCoTeaching: teachers && teachers.length > 1
          };
          
          appliedCount++;
          addLog(`고정 수업 적용: ${className} ${day}요일 ${period}교시 - ${subject}`, 'success');
        } else {
          addLog(`경고: ${className} ${day}요일 ${period}교시에 고정 수업을 배치할 수 없습니다. (슬롯이 이미 사용 중이거나 범위를 벗어남)`, 'warning');
        }
      } else {
        addLog(`경고: ${className} 학급이 존재하지 않습니다. (존재하는 학급: ${Object.keys(schedule).join(', ')})`, 'warning');
      }
    });
    
    addLog(`고정 수업 ${appliedCount}개를 적용했습니다.`, 'success');
    return appliedCount;
  };

  // 공동수업 제약조건 처리 함수 (개선된 버전)
  const processCoTeachingConstraints = (schedule, addLog) => {
    const coTeachingConstraints = (data.constraints?.must || []).filter(c =>
      c.type === 'co_teaching_requirement' || c.type === 'specific_teacher_co_teaching'
    );

    addLog(`공동수업 제약조건 ${coTeachingConstraints.length}개를 처리합니다.`, 'info');

    coTeachingConstraints.forEach((constraint, index) => {
      if (constraint.mainTeacher && constraint.coTeachers && constraint.coTeachers.length > 0) {
        const mainTeacher = data.teachers.find(t => t.name === constraint.mainTeacher);
        if (!mainTeacher) {
          addLog(`경고: 주교사 ${constraint.mainTeacher}을 찾을 수 없습니다.`, 'warning');
          return;
        }

        // 주교사의 주간시수 제한 (제약조건에서 지정된 시수 또는 교사 설정값 사용)
        const mainTeacherWeeklyHours = constraint.weeklyHours || mainTeacher.weeklyHours || mainTeacher.maxHours || 25;
        const subject = constraint.subject || '공동수업';
        const maxTeachersPerClass = constraint.maxTeachersPerClass || 2;
        
        addLog(`특정 교사 공동수업 제약조건 처리: ${constraint.mainTeacher}(주간시수: ${mainTeacherWeeklyHours}시간) + ${constraint.coTeachers.join(', ')} (최대교사수: ${maxTeachersPerClass}명)`, 'info');
        
        // 교사별 수업 불가 시간 정보 표시
        addLog(`📋 교사별 수업 불가 시간 정보:`, 'info');
        addLog(`  • 주교사 ${constraint.mainTeacher}:`, 'info');
        if (mainTeacher.unavailable && mainTeacher.unavailable.length > 0) {
          mainTeacher.unavailable.forEach(slot => {
            addLog(`    - ${slot[0]}요일 ${slot[1]}교시`, 'info');
          });
        } else {
          addLog(`    - 수업 불가 시간 없음`, 'info');
        }
        
        constraint.coTeachers.forEach(coTeacherName => {
          const coTeacher = data.teachers.find(t => t.name === coTeacherName);
          addLog(`  • 부교사 ${coTeacherName}:`, 'info');
          if (coTeacher && coTeacher.unavailable && coTeacher.unavailable.length > 0) {
            coTeacher.unavailable.forEach(slot => {
              addLog(`    - ${slot[0]}요일 ${slot[1]}교시`, 'info');
            });
          } else {
            addLog(`    - 수업 불가 시간 없음`, 'info');
          }
        });

        // 부교사 그룹의 참여 균형을 추적
        const coTeacherParticipation = {};
        constraint.coTeachers.forEach(teacher => {
          coTeacherParticipation[teacher] = 0;
        });

        let placedHours = 0;
        const maxAttempts = mainTeacherWeeklyHours * 50; // 더 많은 시도 횟수
        let attempts = 0;
        let balanceMode = true; // 부교사 균형 모드

        while (placedHours < mainTeacherWeeklyHours && attempts < maxAttempts) {
          attempts++;
          
          // 50회가 넘어가면 부교사 균형을 깨뜨림
          if (attempts > 50 && balanceMode) {
            balanceMode = false;
            addLog(`⚠️ ${constraint.mainTeacher} 교사 공동수업: 50회 시도 후 부교사 균형을 완화합니다.`, 'warning');
          }
          
          // 모든 학급에서 가능한 슬롯 찾기 (특정 학급에 국한하지 않음)
          const allAvailableSlots = [];
          Object.keys(schedule).forEach(className => {
            const slots = findAvailableSlots(schedule, className, mainTeacher, subject, true);
            slots.forEach(slot => {
              allAvailableSlots.push({ ...slot, className: className });
            });
          });
          
          if (allAvailableSlots.length === 0) {
            addLog(`경고: ${constraint.mainTeacher} 교사의 공동수업을 배치할 수 있는 슬롯이 없습니다.`, 'warning');
            break;
          }
          
          // 랜덤하게 슬롯 선택
          const selectedSlot = allAvailableSlots[Math.floor(Math.random() * allAvailableSlots.length)];
          
          // 부교사 선택 (수업 불가 시간 고려)
          const selectedCoTeachers = [];
          const maxCoTeachers = Math.min(maxTeachersPerClass - 1, constraint.coTeachers.length);
          
          // 해당 시간에 수업 가능한 부교사들 필터링 (강화된 버전)
          const availableCoTeachers = constraint.coTeachers.filter(coTeacherName => {
            const coTeacher = data.teachers.find(t => t.name === coTeacherName);
            if (!coTeacher) return false;
            
            // 강화된 수업 불가 시간 확인
            const unavailableCheck = checkTeacherUnavailable(coTeacher, selectedSlot.day, selectedSlot.period);
            if (!unavailableCheck.allowed) {
              return false;
            }
            
            // 강화된 교사별 학급별 시수 제한 확인
            const classHoursCheck = checkTeacherClassHoursLimit(coTeacher, selectedSlot.className, schedule);
            if (!classHoursCheck.allowed) {
              return false;
            }
            
            // 학급별 전체 시수 제한 확인
            const classWeeklyCheck = checkClassWeeklyHoursLimit(selectedSlot.className, schedule);
            if (!classWeeklyCheck.allowed) {
              return false;
            }
            
            // 학급별 일일 시수 제한 확인
            const classDailyCheck = checkClassDailyHoursLimit(selectedSlot.className, selectedSlot.day, schedule);
            if (!classDailyCheck.allowed) {
              return false;
            }
            
            // 다른 학급에서 같은 시간에 수업 중인지 확인
            let hasConflict = false;
            Object.keys(schedule).forEach(otherClassName => {
              if (otherClassName !== selectedSlot.className && schedule[otherClassName] && schedule[otherClassName][selectedSlot.day]) {
                const otherSlot = schedule[otherClassName][selectedSlot.day][selectedSlot.slotIndex];
                if (otherSlot && typeof otherSlot === 'object' && otherSlot.teachers && otherSlot.teachers.includes(coTeacherName)) {
                  hasConflict = true;
                }
              }
            });
            
            return !hasConflict;
          });
          
          if (availableCoTeachers.length === 0) {
            addLog(`경고: ${selectedSlot.className} ${selectedSlot.day}요일 ${selectedSlot.period}교시에 수업 가능한 부교사가 없습니다.`, 'warning');
            continue;
          }
          
          if (balanceMode) {
            // 균형 모드: 가장 적게 참여한 부교사부터 선택
            const sortedCoTeachers = [...availableCoTeachers].sort((a, b) => 
              (coTeacherParticipation[a] || 0) - (coTeacherParticipation[b] || 0)
            );
            
            for (let i = 0; i < Math.min(maxCoTeachers, sortedCoTeachers.length); i++) {
              const selectedTeacher = sortedCoTeachers[i];
              selectedCoTeachers.push(selectedTeacher);
              coTeacherParticipation[selectedTeacher] = (coTeacherParticipation[selectedTeacher] || 0) + 1;
            }
          } else {
            // 완화 모드: 랜덤하게 부교사 선택 (균형 무시)
            const shuffledCoTeachers = [...availableCoTeachers].sort(() => Math.random() - 0.5);
            
            for (let i = 0; i < Math.min(maxCoTeachers, shuffledCoTeachers.length); i++) {
              const selectedTeacher = shuffledCoTeachers[i];
              selectedCoTeachers.push(selectedTeacher);
              coTeacherParticipation[selectedTeacher] = (coTeacherParticipation[selectedTeacher] || 0) + 1;
            }
          }

          // 최종 안전 확인: 0시간 설정 학급 체크
          if (!canPlaceClassInSchedule(selectedSlot.className, addLog)) {
            continue;
          }
          
          // 🔒 공동수업 슬롯 배치 전 최종 중복 검증 (같은 교시 중복 방지)
          if (!validateSlotPlacement(schedule, selectedSlot.className, selectedSlot.day, selectedSlot.period, { name: constraint.mainTeacher }, subject, addLog)) {
            addLog(`⚠️ 공동수업 중복 검증 실패: ${selectedSlot.className} ${selectedSlot.day} ${selectedSlot.period}교시 ${subject} 배치 건너뜀`, 'warning');
            continue;
          }
          
          schedule[selectedSlot.className][selectedSlot.day][selectedSlot.slotIndex] = {
            subject: subject,
            teachers: [constraint.mainTeacher, ...selectedCoTeachers],
            isCoTeaching: true,
            isFixed: false,
            source: 'constraint',
            constraintType: 'specific_teacher_co_teaching',
            mainTeacher: constraint.mainTeacher,
            coTeachers: selectedCoTeachers
          };
          
          placedHours++;
          addLog(`공동수업 배치 ${placedHours}/${mainTeacherWeeklyHours}: ${selectedSlot.className} ${selectedSlot.day}요일 ${selectedSlot.period}교시 - ${constraint.mainTeacher} + ${selectedCoTeachers.join(', ')}`, 'success');
        }

        if (placedHours < mainTeacherWeeklyHours) {
          addLog(`경고: ${constraint.mainTeacher} 교사의 공동수업이 목표 시수(${mainTeacherWeeklyHours}시간)에 도달하지 못했습니다. (배치된 시수: ${placedHours}시간)`, 'warning');
        } else {
          addLog(`성공: ${constraint.mainTeacher} 교사의 공동수업 ${placedHours}시간 배치 완료`, 'success');
        }

        // 부교사 참여 균형 결과 표시
        addLog(`📊 부교사 참여 균형 결과:`, 'info');
        Object.keys(coTeacherParticipation).forEach(teacher => {
          const participation = coTeacherParticipation[teacher];
          addLog(`  • ${teacher}: ${participation}회 참여`, 'info');
        });
      }
    });
  };

  // 교사 일일 학급 중복 금지 제약조건 처리 함수
  const processTeacherSameClassDailyLimit = (schedule, addLog) => {
    const constraints = (data.constraints?.must || []).filter(c => c.type === 'teacher_same_class_daily_limit');
    
    if (constraints.length > 0) {
      addLog('교사 일일 학급 중복 금지 제약조건을 처리합니다.', 'info');
      
      // 이미 고정 수업과 공동수업에서 처리되었으므로 검증만 수행
      let violations = 0;
      
      Object.keys(schedule).forEach(className => {
        days.forEach(day => {
          const teacherCount = {};
          
          schedule[className][day].forEach(slot => {
            if (slot && typeof slot === 'object' && slot.teachers) {
              slot.teachers.forEach(teacher => {
                teacherCount[teacher] = (teacherCount[teacher] || 0) + 1;
                if (teacherCount[teacher] > 1) {
                  violations++;
                  addLog(`경고: ${className} ${day}요일에 ${teacher} 교사가 중복 배정되었습니다.`, 'warning');
                }
              });
            }
          });
        });
      });
      
      if (violations === 0) {
        addLog('✅ 교사 일일 학급 중복 금지 제약조건을 모두 준수합니다.', 'success');
      } else {
        addLog(`⚠️ 교사 일일 학급 중복 금지 제약조건 위반 ${violations}건이 발견되었습니다.`, 'warning');
      }
    }
  };

  // 공동수업 제약조건 검증 함수
  const validateCoTeachingConstraints = (schedule, addLog) => {
    const coTeachingConstraints = (data.constraints?.must || []).filter(c =>
      c.type === 'specific_teacher_co_teaching'
    );

    if (coTeachingConstraints.length > 0) {
      addLog('공동수업 제약조건 검증을 시작합니다.', 'info');
      
      coTeachingConstraints.forEach((constraint, index) => {
        const mainTeacher = constraint.mainTeacher;
        const coTeachers = constraint.coTeachers || [];
        const mainTeacherWeeklyHours = constraint.weeklyHours || 25;
        
        // 주교사의 실제 수업 시간 수 계산
        let mainTeacherActualHours = 0;
        let coTeachingHours = 0;
        let soloTeachingHours = 0;
        
        Object.keys(schedule).forEach(className => {
          days.forEach(day => {
            if (schedule[className] && schedule[className][day]) {
              schedule[className][day].forEach(slot => {
                if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.includes(mainTeacher)) {
                  mainTeacherActualHours++;
                  
                  // 공동수업인지 확인
                  const hasCoTeacher = slot.teachers.some(teacher => 
                    teacher !== mainTeacher && coTeachers.includes(teacher)
                  );
                  
                  if (hasCoTeacher) {
                    coTeachingHours++;
                  } else {
                    soloTeachingHours++;
                  }
                }
              });
            }
          });
        });
        
        addLog(`📊 ${mainTeacher} 교사 공동수업 제약조건 검증:`, 'info');
        addLog(`  • 총 수업 시간: ${mainTeacherActualHours}시간`, 'info');
        addLog(`  • 공동수업 시간: ${coTeachingHours}시간`, 'info');
        addLog(`  • 단독 수업 시간: ${soloTeachingHours}시간`, 'info');
        addLog(`  • 목표 주간시수: ${mainTeacherWeeklyHours}시간`, 'info');
        
        // 부교사별 참여 현황 표시
        const coTeacherParticipation = {};
        coTeachers.forEach(teacher => {
          coTeacherParticipation[teacher] = 0;
        });
        
        Object.keys(schedule).forEach(className => {
          days.forEach(day => {
            if (schedule[className] && schedule[className][day]) {
              schedule[className][day].forEach(slot => {
                if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.includes(mainTeacher)) {
                  const hasCoTeacher = slot.teachers.some(teacher => 
                    teacher !== mainTeacher && coTeachers.includes(teacher)
                  );
                  if (hasCoTeacher) {
                    slot.teachers.forEach(teacher => {
                      if (teacher !== mainTeacher && coTeachers.includes(teacher)) {
                        coTeacherParticipation[teacher] = (coTeacherParticipation[teacher] || 0) + 1;
                      }
                    });
                  }
                }
              });
            }
          });
        });
        
        addLog(`  • 부교사별 참여 현황:`, 'info');
        Object.keys(coTeacherParticipation).forEach(teacher => {
          const participation = coTeacherParticipation[teacher];
          addLog(`    - ${teacher}: ${participation}시간`, 'info');
        });
        
        // 검증 결과
        if (soloTeachingHours === 0) {
          addLog(`  ✅ ${mainTeacher} 교사는 모든 수업에서 공동수업 형태로 진행됩니다.`, 'success');
        } else {
          addLog(`  ⚠️ ${mainTeacher} 교사가 ${soloTeachingHours}시간 단독 수업을 하고 있습니다. (부교사 균형 완화로 인한 정상 현상)`, 'warning');
        }
        
        if (mainTeacherActualHours <= mainTeacherWeeklyHours) {
          addLog(`  ✅ ${mainTeacher} 교사의 주간시수가 목표치(${mainTeacherWeeklyHours}시간) 이내입니다.`, 'success');
        } else {
          addLog(`  ⚠️ ${mainTeacher} 교사의 주간시수가 목표치를 초과했습니다. (${mainTeacherActualHours}/${mainTeacherWeeklyHours}시간)`, 'warning');
        }
      });
    }
  };

  // 학급 일일 과목 1회 제한 제약조건 검증 함수
  const validateDailySubjectOnceConstraints = (schedule, addLog) => {
    const dailySubjectOnceConstraints = [
      ...(data.constraints?.must || []).filter(c => c.type === 'class_daily_subject_once'),
      ...(data.constraints?.optional || []).filter(c => c.type === 'class_daily_subject_once')
    ];

    if (dailySubjectOnceConstraints.length > 0) {
      addLog('학급 일일 과목 1회 제한 제약조건 검증을 시작합니다.', 'info');
      
      const violations = [];
      
      Object.keys(schedule).forEach(className => {
        days.forEach(day => {
          const subjectCounts = {};
          
          // 해당 날짜의 각 과목별 배정 횟수 계산
          if (schedule[className] && schedule[className][day]) {
            schedule[className][day].forEach(slot => {
              if (slot && typeof slot === 'object' && slot.subject) {
                subjectCounts[slot.subject] = (subjectCounts[slot.subject] || 0) + 1;
              }
            });
          }
          
          // 제약조건 위반 확인
          dailySubjectOnceConstraints.forEach(constraint => {
            if (constraint.subject === 'all') {
              // "모든 수업에 해당" 제약조건
              Object.keys(subjectCounts).forEach(subject => {
                if (subjectCounts[subject] > 1) {
                  violations.push({
                    className,
                    day,
                    subject,
                    count: subjectCounts[subject],
                    constraint: '모든 수업에 해당'
                  });
                }
              });
            } else {
              // 특정 과목 제약조건
              if (subjectCounts[constraint.subject] > 1) {
                violations.push({
                  className,
                  day,
                  subject: constraint.subject,
                  count: subjectCounts[constraint.subject],
                  constraint: constraint.subject
                });
              }
            }
          });
        });
      });
      
      if (violations.length === 0) {
        addLog('✅ 모든 학급 일일 과목 1회 제한 제약조건이 지켜졌습니다.', 'success');
      } else {
        addLog(`⚠️ 학급 일일 과목 1회 제한 제약조건 위반 ${violations.length}건 발견:`, 'warning');
        violations.forEach((violation, index) => {
          addLog(`  ${index + 1}. ${violation.className} ${violation.day}요일: ${violation.subject} ${violation.count}회 배정 (제약조건: ${violation.constraint})`, 'warning');
        });
      }
    }
  };

  // 시간표 생성 메인 함수
  const generateTimetable = async () => {
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationLog([]);

    const addLog = (message, type = 'info') => {
      setGenerationLog(prev => [...prev, { message, type, timestamp: new Date().toISOString() }]);
    };

    try {
      addLog('🚀 시간표 생성을 시작합니다. (엄격한 제약조건 적용)', 'info');
      
      // 사전 검증: 제약조건 충돌 확인
      addLog('🔍 사전 제약조건 검증을 시작합니다.', 'info');
      
      // 1. 교사별 시수 제한 사전 검증
      const teacherValidation = validateTeacherConstraints({}, addLog);
      if (!teacherValidation.isValid) {
        addLog('🚨 교사별 시수 제한 검증에서 문제가 발견되었습니다.', 'error');
        addLog('교사 설정을 재검토해주세요.', 'error');
        setIsGenerating(false);
        return;
      }
      
      // 2. 학급별 시수 제한 사전 검증
      const classValidation = validateClassHoursConstraints({}, addLog);
      if (!classValidation.isValid) {
        addLog('🚨 학급별 시수 제한 검증에서 문제가 발견되었습니다.', 'error');
        addLog('학급 설정을 재검토해주세요.', 'error');
        setIsGenerating(false);
        return;
      }
      
      addLog('✅ 사전 제약조건 검증 완료', 'success');

      // TypeScript 스케줄러 사용
      const { generateTimetable: generateTimetableTS } = await import('../core/scheduler');
      
      const result = await generateTimetableTS(data, addLog, setGenerationProgress);
      
      if (result) {
        const { schedule, teacherHours, stats, hasErrors, errorMessage } = result;
        
        // 결과 저장 (오류가 있어도 부분적으로 생성된 시간표 저장)
        setGenerationResults({
          schedule,
          teacherHours,
          stats,
          hasErrors,
          errorMessage,
          timestamp: new Date().toISOString()
        });
        
        // 데이터 업데이트
        updateData('schedule', schedule);
        
        if (hasErrors) {
          addLog('⚠️ 시간표 생성 중 오류가 발생했지만 부분적으로 생성된 시간표를 확인할 수 있습니다.', 'warning');
          addLog(`❌ 오류 내용: ${errorMessage}`, 'error');
          addLog('📊 부분적으로 생성된 시간표를 확인하고 문제점을 파악해주세요.', 'info');
        } else {
          // 오류가 없는 경우에만 최종 검증 수행
          addLog('🔍 생성된 시간표의 최종 제약조건 검증을 시작합니다.', 'info');
          
          // 1. 교사 중복 배정 검증
          const teacherConflictValid = validateTeacherTimeConflicts(schedule, addLog);
          if (!teacherConflictValid) {
            addLog('🚨 교사 중복 배정이 발견되었습니다!', 'error');
            addLog('⚠️ 오류가 발생했지만 부분적으로 생성된 시간표를 확인할 수 있습니다.', 'warning');
            return;
          }
          
          // 2. 교사 불가능 시간 위반 검증
          const teacherUnavailableValid = validateTeacherUnavailableTimes(schedule, addLog);
          if (!teacherUnavailableValid) {
            addLog('🚨 교사 불가능 시간 위반이 발견되었습니다!', 'error');
            addLog('⚠️ 오류가 발생했지만 부분적으로 생성된 시간표를 확인할 수 있습니다.', 'warning');
            return;
          }
          
          // 3. 학급별 시수 제한 검증
          const classHoursValid = validateClassHoursConstraints(schedule, addLog);
          if (!classHoursValid.isValid) {
            addLog('🚨 학급별 시수 제한 위반이 발견되었습니다!', 'error');
            addLog('⚠️ 오류가 발생했지만 부분적으로 생성된 시간표를 확인할 수 있습니다.', 'warning');
            return;
          }
          
          // 4. 공동수업 제약조건 검증
          const coTeachingValid = validateCoTeachingConstraints(schedule, addLog);
          if (!coTeachingValid) {
            addLog('🚨 공동수업 제약조건 위반이 발견되었습니다!', 'error');
            addLog('⚠️ 오류가 발생했지만 부분적으로 생성된 시간표를 확인할 수 있습니다.', 'warning');
            return;
          }
          
          addLog('✅ 최종 제약조건 검증 완료 - 모든 제약조건이 준수되었습니다!', 'success');
          addLog('🎉 시간표 생성이 성공적으로 완료되었습니다!', 'success');
        }
        
        addLog(`📊 통계: ${stats.totalClasses}개 학급, ${stats.totalTeachers}명 교사, ${stats.totalSubjects}개 과목`, 'info');
        addLog(`📈 채움률: ${stats.fillRate.toFixed(1)}%`, 'info');
        
      } else {
        addLog('❌ 시간표 생성에 실패했습니다.', 'error');
      }
    } catch (error) {
      addLog(`❌ 시간표 생성 중 오류가 발생했습니다: ${error.message}`, 'error');
      addLog('제약조건이 너무 엄격하거나 설정에 문제가 있을 수 있습니다.', 'error');
      addLog('다음 사항을 확인해주세요:', 'error');
      addLog('- 교사별 시수 제한이 현실적인지 확인', 'error');
      addLog('- 교사 불가능 시간 설정이 적절한지 확인', 'error');
      addLog('- 학급별 주간 수업 시수 제한이 적절한지 확인', 'error');
      addLog('- 공동수업 제약조건이 충돌하지 않는지 확인', 'error');
    } finally {
      setIsGenerating(false);
      setGenerationProgress(100);
    }
  };

  // 교사 시간 충돌 검증 함수
  const validateTeacherTimeConflicts = (schedule, addLog) => {
    let hasConflicts = false;
    const conflicts = [];
    
    days.forEach(day => {
      for (let period = 1; period <= 7; period++) {
        const teachersAtThisTime = {};
        
        Object.keys(schedule).forEach(className => {
          const slotIndex = period - 1;
          if (schedule[className] && schedule[className][day] && schedule[className][day][slotIndex]) {
            const slot = schedule[className][day][slotIndex];
            
            if (slot && typeof slot === 'object' && slot.teachers && Array.isArray(slot.teachers)) {
              slot.teachers.forEach(teacherName => {
                if (!teachersAtThisTime[teacherName]) {
                  teachersAtThisTime[teacherName] = [];
                }
                teachersAtThisTime[teacherName].push(`${className}(${slot.subject})`);
              });
            }
          }
        });
        
        Object.entries(teachersAtThisTime).forEach(([teacherName, classes]) => {
          if (classes.length > 1) {
            hasConflicts = true;
            const conflictMessage = `🚨 ${teacherName} 교사가 ${day}요일 ${period}교시에 중복 배정됨: ${classes.join(', ')}`;
            conflicts.push(conflictMessage);
            addLog(conflictMessage, 'error');
          }
        });
      }
    });
    
    if (hasConflicts) {
      addLog(`❌ 총 ${conflicts.length}개의 교사 중복 배정이 발견되었습니다!`, 'error');
      return false;
    } else {
      addLog('✅ 교사 중복 배정 검증 통과', 'success');
      return true;
    }
  };

  // 교사 불가능 시간 위반 검증 함수
  const validateTeacherUnavailableTimes = (schedule, addLog) => {
    let hasViolations = false;
    const violations = [];
    
    data.teachers.forEach(teacher => {
      if (teacher.unavailable && Array.isArray(teacher.unavailable)) {
        teacher.unavailable.forEach(([unavailableDay, unavailablePeriod]) => {
          Object.keys(schedule).forEach(className => {
            const slotIndex = unavailablePeriod - 1;
            const slot = schedule[className]?.[unavailableDay]?.[slotIndex];
            
            if (slot && typeof slot === 'object' && 
                slot.teachers && slot.teachers.includes(teacher.name)) {
              hasViolations = true;
              const violationMessage = `🚨 ${teacher.name} 교사 불가능 시간 위반: ${unavailableDay}요일 ${unavailablePeriod}교시`;
              violations.push(violationMessage);
              addLog(violationMessage, 'error');
            }
          });
        });
      }
    });
    
    if (hasViolations) {
      addLog(`❌ 총 ${violations.length}개의 교사 불가능 시간 위반이 발견되었습니다!`, 'error');
      return false;
    } else {
      addLog('✅ 교사 불가능 시간 검증 통과', 'success');
      return true;
    }
  };

  // 시간표 존재 여부 확인
  const hasSchedule = () => {
    return data.schedule && Object.keys(data.schedule).length > 0;
  };

  // 시간표 통계 가져오기
  const getScheduleStats = () => {
    if (!hasSchedule()) return null;

    const schedule = data.schedule;
    const classNames = Object.keys(schedule);
    let totalSlots = 0;
    let filledSlots = 0;
    let emptySlots = 0;

    classNames.forEach(className => {
      days.forEach(day => {
        if (schedule[className] && schedule[className][day]) {
          schedule[className][day].forEach(slot => {
            totalSlots++;
            if (slot && typeof slot === 'object' && slot.subject) {
              filledSlots++;
            } else {
              emptySlots++;
            }
          });
        }
      });
    });

    return {
      totalSlots,
      filledSlots,
      emptySlots,
      fillRate: totalSlots > 0 ? ((filledSlots / totalSlots) * 100).toFixed(1) : '0.0'
    };
  };

  // 시간표 초기화
  const clearSchedule = () => {
    if (confirm('정말로 시간표를 초기화하시겠습니까?')) {
      updateData('schedule', null);
      setGenerationResults(null);
      setGenerationLog([]);
      setGenerationProgress(0);
      setAutoGenerationCount(0);
      setBestFillRate(0);
      setBestSchedule(null);
    }
  };

  // 자동 시간표 생성 함수
  const autoGenerateTimetable = async () => {
    setIsAutoGenerating(true);
    setAutoGenerationCount(0);
    setBestFillRate(0);
    setBestSchedule(null);
    setGenerationLog([]);
    window.stopAutoGeneration = false; // 중지 신호 초기화

    const addLog = (message, type = 'info') => {
      const timestamp = new Date().toLocaleTimeString();
      setGenerationLog(prev => [...prev, { message: `[${timestamp}] ${message}`, type }]);
    };

    addLog('🚀 자동 시간표 생성을 시작합니다. 채움률 100%까지 반복 생성합니다.', 'info');

    let attemptCount = 0;
    const maxAttempts = 200;
    let shouldContinue = true; // 자동 생성 계속 여부를 추적하는 변수

    while (attemptCount < maxAttempts && shouldContinue) {
      attemptCount++;
      setAutoGenerationCount(attemptCount);
      
      // 중지 신호 확인
      if (window.stopAutoGeneration) {
        shouldContinue = false;
        window.stopAutoGeneration = false; // 신호 초기화
        break;
      }
      
      addLog(`📊 ${attemptCount}번째 시도 중... (최대 ${maxAttempts}회)`, 'info');
      
      try {
        // 기존 generateTimetable 로직을 복사하여 실행
        const schedule = {};
        const classNames = [];
        const base = data.base || {};
        const grades = base.grades || 0;
        const classesPerGrade = base.classes_per_grade || [];
        const periodsPerDay = base.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };

        // 1단계: 기본 시간표 구조 생성
        for (let grade = 1; grade <= grades; grade++) {
          const classesInGrade = classesPerGrade[grade - 1] || 0;
          for (let classNum = 1; classNum <= classesInGrade; classNum++) {
            const className = `${grade}학년 ${classNum}반`;
            
            // 0시간 설정 학급은 아예 스케줄에서 제외
            if (data.classWeeklyHours && data.classWeeklyHours[className] === 0) {
              continue; // 자동 생성에서는 로그 생략
            }
            
            classNames.push(className);
            schedule[className] = {};
            days.forEach(day => {
              const maxPeriods = periodsPerDay[day] || 7;
              schedule[className][day] = new Array(maxPeriods).fill('');
            });
          }
        }

        // 2단계: 고정 수업 적용
        applyFixedClasses(schedule, addLog);

        // 3단계: 공동수업 제약조건 처리 (자동 생성에서는 더 적극적으로 완화)
        const coTeachingConstraints = (data.constraints?.must || []).filter(c =>
          c.type === 'co_teaching_requirement' || c.type === 'specific_teacher_co_teaching'
        );

        addLog(`공동수업 제약조건 ${coTeachingConstraints.length}개를 처리합니다. (자동 생성 모드)`, 'info');

        coTeachingConstraints.forEach((constraint, index) => {
          if (constraint.mainTeacher && constraint.coTeachers && constraint.coTeachers.length > 0) {
            const mainTeacher = data.teachers.find(t => t.name === constraint.mainTeacher);
            if (!mainTeacher) {
              addLog(`경고: 주교사 ${constraint.mainTeacher}을 찾을 수 없습니다.`, 'warning');
              return;
            }

            const mainTeacherWeeklyHours = constraint.weeklyHours || mainTeacher.weeklyHours || mainTeacher.maxHours || 25;
            const subject = constraint.subject || '공동수업';
            const maxTeachersPerClass = constraint.maxTeachersPerClass || 2;
            
            addLog(`자동 생성 모드: ${constraint.mainTeacher} 공동수업 처리 (주간시수: ${mainTeacherWeeklyHours}시간)`, 'info');
            
            // 교사별 수업 불가 시간 정보 표시 (간단 버전)
            addLog(`📋 교사별 수업 불가 시간:`, 'info');
            addLog(`  • 주교사 ${constraint.mainTeacher}: ${mainTeacher.unavailable ? mainTeacher.unavailable.length : 0}개 시간대`, 'info');
            constraint.coTeachers.forEach(coTeacherName => {
              const coTeacher = data.teachers.find(t => t.name === coTeacherName);
              const unavailableCount = coTeacher && coTeacher.unavailable ? coTeacher.unavailable.length : 0;
              addLog(`  • 부교사 ${coTeacherName}: ${unavailableCount}개 시간대`, 'info');
            });

            const coTeacherParticipation = {};
            constraint.coTeachers.forEach(teacher => {
              coTeacherParticipation[teacher] = 0;
            });

            let placedHours = 0;
            const maxAttempts = mainTeacherWeeklyHours * 30; // 자동 생성에서는 더 적은 시도 횟수
            let attempts = 0;
            let balanceMode = true;

            while (placedHours < mainTeacherWeeklyHours && attempts < maxAttempts) {
              attempts++;
              
              // 자동 생성에서는 20회만에 균형 완화
              if (attempts > 20 && balanceMode) {
                balanceMode = false;
                addLog(`⚠️ 자동 생성 모드: ${constraint.mainTeacher} 교사 공동수업 20회 시도 후 부교사 균형을 완화합니다.`, 'warning');
              }
              
              const allAvailableSlots = [];
              Object.keys(schedule).forEach(className => {
                const slots = findAvailableSlots(schedule, className, mainTeacher, subject, true);
                slots.forEach(slot => {
                  allAvailableSlots.push({ ...slot, className: className });
                });
              });
              
              if (allAvailableSlots.length === 0) {
                addLog(`경고: ${constraint.mainTeacher} 교사의 공동수업을 배치할 수 있는 슬롯이 없습니다.`, 'warning');
                break;
              }
              
              const selectedSlot = allAvailableSlots[Math.floor(Math.random() * allAvailableSlots.length)];
              const selectedCoTeachers = [];
              const maxCoTeachers = Math.min(maxTeachersPerClass - 1, constraint.coTeachers.length);
              
              // 해당 시간에 수업 가능한 부교사들 필터링 (강화된 버전)
              const availableCoTeachers = constraint.coTeachers.filter(coTeacherName => {
                const coTeacher = data.teachers.find(t => t.name === coTeacherName);
                if (!coTeacher) return false;
                
                // 강화된 수업 불가 시간 확인
                const unavailableCheck = checkTeacherUnavailable(coTeacher, selectedSlot.day, selectedSlot.period);
                if (!unavailableCheck.allowed) {
                  return false;
                }
                
                // 강화된 교사별 학급별 시수 제한 확인
                const classHoursCheck = checkTeacherClassHoursLimit(coTeacher, selectedSlot.className, schedule);
                if (!classHoursCheck.allowed) {
                  return false;
                }
                
                // 학급별 전체 시수 제한 확인
                const classWeeklyCheck = checkClassWeeklyHoursLimit(selectedSlot.className, schedule);
                if (!classWeeklyCheck.allowed) {
                  return false;
                }
                
                // 학급별 일일 시수 제한 확인
                const classDailyCheck = checkClassDailyHoursLimit(selectedSlot.className, selectedSlot.day, schedule);
                if (!classDailyCheck.allowed) {
                  return false;
                }
                
                // 다른 학급에서 같은 시간에 수업 중인지 확인
                let hasConflict = false;
                Object.keys(schedule).forEach(otherClassName => {
                  if (otherClassName !== selectedSlot.className && schedule[otherClassName] && schedule[otherClassName][selectedSlot.day]) {
                    const otherSlot = schedule[otherClassName][selectedSlot.day][selectedSlot.slotIndex];
                    if (otherSlot && typeof otherSlot === 'object' && otherSlot.teachers && otherSlot.teachers.includes(coTeacherName)) {
                      hasConflict = true;
                    }
                  }
                });
                
                return !hasConflict;
              });
              
              if (availableCoTeachers.length === 0) {
                addLog(`경고: ${selectedSlot.className} ${selectedSlot.day}요일 ${selectedSlot.period}교시에 수업 가능한 부교사가 없습니다.`, 'warning');
                continue;
              }
              
              if (balanceMode) {
                // 균형 모드
                const sortedCoTeachers = [...availableCoTeachers].sort((a, b) => 
                  (coTeacherParticipation[a] || 0) - (coTeacherParticipation[b] || 0)
                );
                
                for (let i = 0; i < Math.min(maxCoTeachers, sortedCoTeachers.length); i++) {
                  const selectedTeacher = sortedCoTeachers[i];
                  selectedCoTeachers.push(selectedTeacher);
                  coTeacherParticipation[selectedTeacher] = (coTeacherParticipation[selectedTeacher] || 0) + 1;
                }
              } else {
                // 완화 모드: 랜덤 선택
                const shuffledCoTeachers = [...availableCoTeachers].sort(() => Math.random() - 0.5);
                
                for (let i = 0; i < Math.min(maxCoTeachers, shuffledCoTeachers.length); i++) {
                  const selectedTeacher = shuffledCoTeachers[i];
                  selectedCoTeachers.push(selectedTeacher);
                  coTeacherParticipation[selectedTeacher] = (coTeacherParticipation[selectedTeacher] || 0) + 1;
                }
              }

              // 최종 안전 확인: 0시간 설정 학급 체크
              if (!canPlaceClassInSchedule(selectedSlot.className)) {
                continue;
              }
              
              // 🔒 자동생성 공동수업 슬롯 배치 전 최종 중복 검증 (같은 교시 중복 방지)
              if (!validateSlotPlacement(schedule, selectedSlot.className, selectedSlot.day, selectedSlot.period, { name: constraint.mainTeacher }, subject, addLog)) {
                addLog(`⚠️ 자동생성 공동수업 중복 검증 실패: ${selectedSlot.className} ${selectedSlot.day} ${selectedSlot.period}교시 ${subject} 배치 건너뜀`, 'warning');
                continue;
              }
              
              schedule[selectedSlot.className][selectedSlot.day][selectedSlot.slotIndex] = {
                subject: subject,
                teachers: [constraint.mainTeacher, ...selectedCoTeachers],
                isCoTeaching: true,
                isFixed: false,
                source: 'constraint',
                constraintType: 'specific_teacher_co_teaching',
                mainTeacher: constraint.mainTeacher,
                coTeachers: selectedCoTeachers
              };
              
              placedHours++;
              addLog(`자동 생성 공동수업 배치 ${placedHours}/${mainTeacherWeeklyHours}: ${selectedSlot.className} ${selectedSlot.day}요일 ${selectedSlot.period}교시`, 'success');
            }
            
            if (placedHours < mainTeacherWeeklyHours) {
              addLog(`⚠️ ${constraint.mainTeacher} 교사 공동수업: 목표 ${mainTeacherWeeklyHours}시간 중 ${placedHours}시간만 배치됨`, 'warning');
            } else {
              addLog(`✅ ${constraint.mainTeacher} 교사 공동수업: ${placedHours}시간 모두 배치 완료`, 'success');
            }
          }
        });

        // 4단계: 교사 일일 학급 중복 금지 제약조건 검증
        processTeacherSameClassDailyLimit(schedule, addLog);

        // 5단계: 교사별 시수 추적 초기화 (학급별 주간 수업시수 고려)
        addLog('5단계: 교사별 시수 추적을 초기화합니다.', 'info');
        const teacherHours = {};
        const teachers = data.teachers || [];
        teachers.forEach(teacher => {
          teacherHours[teacher.name] = {
            current: getCurrentTeacherHours(schedule, teacher.name),
            max: teacher.weeklyHours || teacher.maxHours || 25,
            subjects: {},
            classHours: {} // 학급별 시수 추적
          };
          
          // 학급별 주간 수업시수 초기화
          classNames.forEach(className => {
            teacherHours[teacher.name].classHours[className] = {
              current: getCurrentTeacherHours(schedule, teacher.name, className),
              max: teacher.classWeeklyHours?.[className] || 0
            };
          });
        });
        
        addLog(`📊 교사별 시수 정보:`, 'info');
        Object.keys(teacherHours).forEach(teacherName => {
          const info = teacherHours[teacherName];
          addLog(`  • ${teacherName}: ${info.current}/${info.max}시간`, 'info');
          
          // 학급별 시수 정보 표시
          if (info.classHours) {
            Object.keys(info.classHours).forEach(className => {
              const classInfo = info.classHours[className];
              if (classInfo.max > 0) {
                addLog(`    - ${className}: ${classInfo.current}/${classInfo.max}시간`, 'info');
              }
            });
          }
        });

        // 6단계: 과목별 배치 계획 수립
        addLog('📋 학급별 주간 시수 설정 확인:', 'info');
        classNames.forEach(className => {
          let weeklyHours = 'auto';
          if (data.classWeeklyHours && data.classWeeklyHours[className] !== undefined) {
            weeklyHours = `${data.classWeeklyHours[className]}시간`;
            if (data.classWeeklyHours[className] === 0) {
              addLog(`  • ${className}: ${weeklyHours} (🚫 수업 배치 완전 제외)`, 'error');
              return;
            }
          }
          addLog(`  • ${className}: ${weeklyHours}`, 'info');
        });
        
        const subjects = data.subjects || [];
        const subjectPlacementPlan = [];
        
        const defaultWeeklyHours = {
          '국어': 5, '수학': 5, '과학': 4, '영어': 4,
          '역사': 3, '사회': 3, '체육': 3,
          '도덕': 2, '기술가정': 2, '음악': 2, '미술': 2,
          '정보': 1, '원어민': 1, '보건': 1, '진로와직업': 1,
          '동아리': 1, '스포츠': 1
        };
        
        classNames.forEach(className => {
          // 0시간 설정 학급 완전 제외
          if (data.classWeeklyHours && data.classWeeklyHours[className] === 0) {
            addLog(`🚫 ${className}: 0시간 설정으로 과목 배치 제외`, 'warning');
            return;
          }
          
          // 학급별 시수 제한 확인
          const classWeeklyCheck = checkClassWeeklyHoursLimit(className, schedule);
          if (!classWeeklyCheck.allowed) {
            if (classWeeklyCheck.reason === 'class_disabled') {
              addLog(`🚫 ${className}: 수업 배치 비활성화`, 'warning');
            } else {
              addLog(`⚠️ ${className}: 주간 시수 한계 도달 (${classWeeklyCheck.current}/${classWeeklyCheck.max}시간)`, 'warning');
            }
            return; // 해당 학급은 더 이상 과목 배치 불가
          }
          
          subjects.forEach(subject => {
            const targetHours = subject.weekly_hours || defaultWeeklyHours[subject.name] || 1;
            const currentHours = getCurrentSubjectHours(schedule, className, subject.name);
            const remainingHours = targetHours - currentHours;
            
            if (remainingHours > 0) {
              // 단계별 교사 찾기 전략 (자동 생성 모드)
              let availableTeachers = [];
              
              // 1단계: 명시적으로 할당된 교사들
              const primaryTeachers = teachers.filter(teacher => {
                const teacherSubjects = teacher.subjects || [];
                const hasSubject = teacherSubjects.includes(subject.name);
                
                if (!hasSubject) return false;
                
                // 교사가 해당 학급을 담당하는지 확인
                const classKey = convertClassNameToKey(className);
                const hasClassAssignment = (teacher.classWeeklyHours && teacher.classWeeklyHours[className] > 0) ||
                                          (teacher.weeklyHoursByGrade && teacher.weeklyHoursByGrade[classKey] > 0);
                
                if (!hasClassAssignment) {
                  return false; // 해당 학급을 담당하지 않음
                }
                
                // 교사의 해당 학급 시수 제한 확인
                const classHoursCheck = checkTeacherClassHoursLimit(teacher, className, schedule);
                if (!classHoursCheck.allowed) {
                  return false; // 시수 제한 초과 또는 0시간 설정
                }
                
                return true;
              });
              
              availableTeachers = primaryTeachers;
              
              // 2단계: 명시적 담당이 없을 경우, 해당 과목을 가르칠 수 있는 모든 교사들 (제한 없는)
              if (availableTeachers.length === 0) {
                const secondaryTeachers = teachers.filter(teacher => {
                  const teacherSubjects = teacher.subjects || [];
                  if (!teacherSubjects.includes(subject.name)) {
                    return false; // 해당 과목을 가르치지 않음
                  }
                  
                  // 교사가 해당 학급에 0시간으로 명시적으로 금지되지 않았는지 확인
                  const classKey = convertClassNameToKey(className);
                  const isExplicitlyForbidden = (teacher.classWeeklyHours && teacher.classWeeklyHours[className] === 0) ||
                                               (teacher.weeklyHoursByGrade && teacher.weeklyHoursByGrade[classKey] === 0);
                  
                  if (isExplicitlyForbidden) {
                    return false; // 명시적으로 0시간 설정됨
                  }
                  
                  // 전체 시수 제한 확인
                  const currentTotalHours = getCurrentTeacherHours(schedule, teacher.name);
                  if (currentTotalHours >= (teacher.maxHours || 25)) {
                    return false; // 전체 시수 초과
                  }
                  
                  return true;
                });
                
                availableTeachers = secondaryTeachers;
                if (availableTeachers.length > 0) {
                  addLog(`  📝 ${className} ${subject.name}: 2단계 교사 배정 (${availableTeachers.length}명)`, 'info');
                }
              }
              
              if (availableTeachers.length > 0) {
                for (let i = 0; i < remainingHours; i++) {
                  subjectPlacementPlan.push({
                    className,
                    subject: subject.name,
                    availableTeachers,
                    priority: Math.random()
                  });
                }
              } else {
                addLog(`⚠️ 자동생성 ${className} ${subject.name}: 가르칠 수 있는 교사가 없습니다.`, 'warning');
              }
            }
          });
        });

        // 7단계: 과목 배치 실행
        let placedCount = 0;
        const maxAttemptsPerGeneration = subjectPlacementPlan.length * 100;
        let attempts = 0;
        
        subjectPlacementPlan.sort((a, b) => a.priority - b.priority);
        
        while (subjectPlacementPlan.length > 0 && attempts < maxAttemptsPerGeneration) {
          attempts++;
          const placement = subjectPlacementPlan.shift();
          
          const teachersWithPriority = placement.availableTeachers.map(teacher => {
            const currentHours = teacherHours[teacher.name]?.current || 0;
            const maxHours = teacherHours[teacher.name]?.max || 25;
            const remainingHours = maxHours - currentHours;
            
            let priority = 0;
            
            const coTeachingConstraints = (data.constraints?.must || []).filter(c =>
              c.type === 'specific_teacher_co_teaching' && c.mainTeacher === teacher.name
            );
            if (coTeachingConstraints.length > 0) {
              priority += 1000;
            }
            
            priority += Math.max(0, 25 - remainingHours) * 100;
            
            // 학급별 시수 우선순위 추가
            const classWeeklyHours = teacher.classWeeklyHours?.[placement.className] || 0;
            const currentClassHours = teacherHours[teacher.name]?.classHours?.[placement.className]?.current || 0;
            if (classWeeklyHours > 0) {
              priority += Math.max(0, classWeeklyHours - currentClassHours) * 50;
            }
            
            priority += Math.random() * 10;
            
            return { teacher, priority, remainingHours };
          });
          
          teachersWithPriority.sort((a, b) => a.priority - b.priority);
          
          let placed = false;
          for (const teacherInfo of teachersWithPriority) {
            const { teacher } = teacherInfo;
            
            if (teacherHours[teacher.name]?.current >= teacherHours[teacher.name]?.max) {
              continue;
            }
            
            // 강화된 학급별 주간 수업시수 제한 확인
            const classHoursCheck = checkTeacherClassHoursLimit(teacher, placement.className, schedule);
            if (!classHoursCheck.allowed) {
              continue; // 해당 학급에서 이미 최대 시수에 도달
            }
            
            const availableSlots = findAvailableSlots(schedule, placement.className, teacher, placement.subject);
            
            if (availableSlots.length > 0) {
              const selectedSlot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
              
              // 자동 생성 배치 직전 수업 불가 시간 최종 확인
              const unavailableCheck = checkTeacherUnavailable(teacher, selectedSlot.day, selectedSlot.period);
              if (!unavailableCheck.allowed) {
                continue; // 교사가 해당 시간에 수업 불가
              }
              
              // 최종 안전 확인: 0시간 설정 학급 체크
              if (!canPlaceClassInSchedule(placement.className)) {
                continue;
              }
              
              // 🔒 자동생성 슬롯 배치 전 최종 중복 검증 (같은 교시 중복 방지)
              if (!validateSlotPlacement(schedule, placement.className, selectedSlot.day, selectedSlot.period, teacher, placement.subject, addLog)) {
                addLog(`⚠️ 자동생성 중복 검증 실패: ${placement.className} ${selectedSlot.day} ${selectedSlot.period}교시 ${placement.subject} 배치 건너뜀`, 'warning');
                continue;
              }
              
              schedule[placement.className][selectedSlot.day][selectedSlot.slotIndex] = {
                subject: placement.subject,
                teachers: [teacher.name],
                isCoTeaching: false,
                isFixed: false
              };
              
              if (teacherHours[teacher.name]) {
                teacherHours[teacher.name].current++;
                teacherHours[teacher.name].subjects[placement.subject] = 
                  (teacherHours[teacher.name].subjects[placement.subject] || 0) + 1;
                
                // 학급별 시수 업데이트
                if (teacherHours[teacher.name].classHours[placement.className]) {
                  teacherHours[teacher.name].classHours[placement.className].current++;
                }
              }
              
              placed = true;
              placedCount++;
              break;
            }
          }
          
          if (!placed) {
            placement.priority += 0.1;
            if (placement.priority < 20) {
              subjectPlacementPlan.push(placement);
            }
          }
        }

        // 8단계: 빈 슬롯 채우기
        let filledSlots = 0;
        
        classNames.forEach(className => {
          // 0시간 설정 학급 완전 제외
          if (data.classWeeklyHours && data.classWeeklyHours[className] === 0) {
            return; // 0시간 설정 학급은 완전 제외
          }
          
          // 학급별 시수 제한 확인
          const classWeeklyCheck = checkClassWeeklyHoursLimit(className, schedule);
          if (!classWeeklyCheck.allowed) {
            return; // 해당 학급은 더 이상 배치 불가
          }
          
          days.forEach(day => {
            // 학급별 일일 교시 수 제한 확인
            const classDailyCheck = checkClassDailyHoursLimit(className, day, schedule);
            if (!classDailyCheck.allowed) {
              return; // 해당 요일은 더 이상 배치 불가
            }
            
            if (schedule[className] && schedule[className][day]) {
              schedule[className][day].forEach((slot, periodIndex) => {
                if (slot === '' || slot === undefined) {
                  const availableSubjects = subjects.filter(subject => {
                    const currentHours = getCurrentSubjectHours(schedule, className, subject.name);
                    const targetHours = subject.weekly_hours || defaultWeeklyHours[subject.name] || 1;
                    return currentHours < targetHours;
                  });
                  
                  if (availableSubjects.length > 0) {
                    const subjectTeacherPairs = [];
                    
                    availableSubjects.forEach(subject => {
                      // 2단계 전략으로 교사 필터링 (자동 생성 빈 슬롯 채우기)
                      let availableTeachers = [];
                      
                      // 1단계: 명시적으로 할당된 교사들
                      const primaryTeachers = teachers.filter(teacher => {
                        const hasSubject = (teacher.subjects || []).includes(subject.name);
                        const hasCapacity = teacherHours[teacher.name]?.current < teacherHours[teacher.name]?.max;
                        
                        if (!hasSubject || !hasCapacity) return false;
                        
                        // 명시적 학급 할당 확인
                        const classKey = convertClassNameToKey(className);
                        const hasClassAssignment = (teacher.classWeeklyHours && teacher.classWeeklyHours[className] > 0) ||
                                                  (teacher.weeklyHoursByGrade && teacher.weeklyHoursByGrade[classKey] > 0);
                        
                        if (!hasClassAssignment) return false;
                        
                        // 강화된 학급별 주간 수업시수 제한 확인
                        const classHoursCheck = checkTeacherClassHoursLimit(teacher, className, schedule);
                        if (!classHoursCheck.allowed) {
                          return false; // 해당 학급에서 이미 최대 시수에 도달
                        }
                        
                        return true;
                      });
                      
                      availableTeachers = primaryTeachers;
                      
                      // 2단계: 명시적 담당이 없을 경우, 해당 과목을 가르칠 수 있는 모든 교사들
                      if (availableTeachers.length === 0) {
                        const secondaryTeachers = teachers.filter(teacher => {
                          const hasSubject = (teacher.subjects || []).includes(subject.name);
                          const hasCapacity = teacherHours[teacher.name]?.current < teacherHours[teacher.name]?.max;
                          
                          if (!hasSubject || !hasCapacity) return false;
                          
                          // 명시적으로 금지되지 않았는지 확인
                          const classKey = convertClassNameToKey(className);
                          const isExplicitlyForbidden = (teacher.classWeeklyHours && teacher.classWeeklyHours[className] === 0) ||
                                                       (teacher.weeklyHoursByGrade && teacher.weeklyHoursByGrade[classKey] === 0);
                          
                          if (isExplicitlyForbidden) {
                            return false; // 명시적으로 금지됨
                          }
                          
                          return true;
                        });
                        
                        availableTeachers = secondaryTeachers;
                      }
                      
                      availableTeachers.forEach(teacher => {
                        const currentTeacherHours = teacherHours[teacher.name]?.current || 0;
                        const maxTeacherHours = teacherHours[teacher.name]?.max || 25;
                        const remainingTeacherHours = maxTeacherHours - currentTeacherHours;
                        
                        let priority = 0;
                        
                        const coTeachingConstraints = (data.constraints?.must || []).filter(c =>
                          c.type === 'specific_teacher_co_teaching' && c.mainTeacher === teacher.name
                        );
                        if (coTeachingConstraints.length > 0) {
                          priority += 1000;
                        }
                        
                        priority += Math.max(0, 25 - remainingTeacherHours) * 100;
                        priority += Math.random() * 10;
                        
                        subjectTeacherPairs.push({
                          subject,
                          teacher,
                          priority
                        });
                      });
                    });
                    
                    subjectTeacherPairs.sort((a, b) => a.priority - b.priority);
                    
                    if (subjectTeacherPairs.length > 0) {
                      const selectedPair = subjectTeacherPairs[0];
                      const availableSlots = findAvailableSlots(schedule, className, selectedPair.teacher, selectedPair.subject.name);
                      
                      if (availableSlots.length > 0) {
                        const selectedSlot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
                        
                        // 자동 생성 빈 슬롯 채우기 직전 수업 불가 시간 최종 확인
                        const unavailableCheck = checkTeacherUnavailable(selectedPair.teacher, selectedSlot.day, selectedSlot.period);
                        if (!unavailableCheck.allowed) {
                          return; // 교사가 해당 시간에 수업 불가
                        }
                        
                        // 최종 안전 확인: 0시간 설정 학급 체크
                        if (!canPlaceClassInSchedule(className)) {
                          return;
                        }
                        
                        // 🔒 빈 슬롯 채우기 전 최종 중복 검증 (같은 교시 중복 방지)
                        if (!validateSlotPlacement(schedule, className, selectedSlot.day, selectedSlot.period, selectedPair.teacher, selectedPair.subject.name, addLog)) {
                          addLog(`⚠️ 빈슬롯 중복 검증 실패: ${className} ${selectedSlot.day} ${selectedSlot.period}교시 ${selectedPair.subject.name} 배치 건너뜀`, 'warning');
                          return;
                        }
                        
                        schedule[className][selectedSlot.day][selectedSlot.slotIndex] = {
                          subject: selectedPair.subject.name,
                          teachers: [selectedPair.teacher.name],
                          isCoTeaching: false,
                          isFixed: false
                        };
                        
                        if (teacherHours[selectedPair.teacher.name]) {
                          teacherHours[selectedPair.teacher.name].current++;
                          teacherHours[selectedPair.teacher.name].subjects[selectedPair.subject.name] = 
                            (teacherHours[selectedPair.teacher.name].subjects[selectedPair.subject.name] || 0) + 1;
                          
                          // 학급별 시수 업데이트
                          if (teacherHours[selectedPair.teacher.name].classHours[className]) {
                            teacherHours[selectedPair.teacher.name].classHours[className].current++;
                          }
                        }
                        
                        filledSlots++;
                      }
                    }
                  }
                }
              });
            }
          });
        });

        // 채움률 계산
        let totalSlots = 0;
        let emptySlots = 0;
        
        classNames.forEach(className => {
          days.forEach(day => {
            if (schedule[className] && schedule[className][day]) {
              schedule[className][day].forEach(slot => {
                totalSlots++;
                if (slot === '' || slot === undefined) {
                  emptySlots++;
                }
              });
            }
          });
        });
        
        let fillRate = totalSlots > 0 ? parseFloat(((totalSlots - emptySlots) / totalSlots) * 100).toFixed(1) : 0;
        
        // 교사 제약조건 검증 (자동 생성용 - 로그 없음)
        const teacherViolations = validateTeacherConstraints(schedule, () => {});
        
        // 학급별 시수 제한 검증 (자동 생성용 - 로그 없음)
        const classViolations = validateClassHoursConstraints(schedule, () => {});
        
        // 0시간 설정 학급 위반 확인 (매우 심각한 위반)
        let zeroHoursViolations = 0;
        classNames.forEach(className => {
          if (data.classWeeklyHours && data.classWeeklyHours[className] === 0) {
            let hasClasses = false;
            days.forEach(day => {
              if (schedule[className] && schedule[className][day]) {
                schedule[className][day].forEach(slot => {
                  if (slot && slot !== '' && slot !== undefined) {
                    hasClasses = true;
                  }
                });
              }
            });
            if (hasClasses) {
              zeroHoursViolations++;
            }
          }
        });
        
        // 제약조건 위반이 있으면 품질 점수 감점
        const totalViolations = teacherViolations + classViolations + zeroHoursViolations;
        if (totalViolations > 0) {
          let penalty = (teacherViolations + classViolations) * 5; // 일반 위반당 5% 감점
          penalty += zeroHoursViolations * 50; // 0시간 설정 위반당 50% 감점 (매우 심각)
          fillRate = Math.max(0, parseFloat(fillRate) - penalty).toFixed(1);
          addLog(`⚠️ 제약조건 위반 ${totalViolations}건 (교사: ${teacherViolations}, 학급: ${classViolations}, 0시간설정: ${zeroHoursViolations})으로 인해 품질 점수 ${penalty}% 감점 (조정된 점수: ${fillRate}%)`, 'warning');
        }
        
        // 최고 채움률 업데이트
        if (parseFloat(fillRate) > bestFillRate) {
          setBestFillRate(parseFloat(fillRate));
          setBestSchedule(JSON.parse(JSON.stringify(schedule)));
          addLog(`🎉 새로운 최고 채움률 달성: ${fillRate}% (${attemptCount}번째 시도)`, 'success');
        }
        
        addLog(`📈 ${attemptCount}번째 시도 결과: 채움률 ${fillRate}% (최고: ${bestFillRate.toFixed(1)}%)`, 'info');
        
        // 수업 시수 통계 (간단 버전)
        addLog(`📊 수업 시수: 총 ${placedCount + filledSlots}시간 (1차: ${placedCount}시간, 채움: ${filledSlots}시간)`, 'info');
        
        // 100% 달성 시 종료
        if (fillRate === 100) {
          addLog(`🎊 축하합니다! ${attemptCount}번째 시도에서 채움률 100%를 달성했습니다!`, 'success');
          updateData('schedule', schedule);
          setGenerationResults({
            schedule,
            teacherHours,
            fillRate,
            totalSlots,
            emptySlots,
            placedCount,
            filledSlots
          });
          setIsAutoGenerating(false);
          return;
        }
        
        // 잠시 대기 (UI 업데이트를 위해)
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        addLog(`❌ ${attemptCount}번째 시도 중 오류 발생: ${error.message}`, 'error');
      }
    }
    
    // 자동 생성이 중단되었는지 확인
    if (!shouldContinue) {
      addLog('⏹️ 자동 생성이 중단되었습니다.', 'warning');
      if (bestSchedule) {
        addLog('💾 현재까지의 최고 채움률 시간표를 저장합니다.', 'info');
        updateData('schedule', bestSchedule);
        
        // 최고 채움률 시간표의 통계 계산
        let totalSlots = 0;
        let emptySlots = 0;
        
        Object.keys(bestSchedule).forEach(className => {
          days.forEach(day => {
            if (bestSchedule[className] && bestSchedule[className][day]) {
              bestSchedule[className][day].forEach(slot => {
                totalSlots++;
                if (slot === '' || slot === undefined) {
                  emptySlots++;
                }
              });
            }
          });
        });
        
        setGenerationResults({
          schedule: bestSchedule,
          fillRate: bestFillRate,
          totalSlots,
          emptySlots,
          placedCount: totalSlots - emptySlots,
          filledSlots: totalSlots - emptySlots
        });
      }
      return;
    }
    
    // 최대 시도 횟수 도달
    addLog(`⚠️ ${maxAttempts}회 시도 후에도 채움률 100%를 달성하지 못했습니다.`, 'warning');
    addLog(`📊 최고 채움률: ${bestFillRate.toFixed(1)}%`, 'info');
    
    if (bestSchedule) {
      addLog('💾 최고 채움률의 시간표를 저장합니다.', 'info');
      updateData('schedule', bestSchedule);
      
      // 최고 채움률 시간표의 통계 계산
      let totalSlots = 0;
      let emptySlots = 0;
      
      Object.keys(bestSchedule).forEach(className => {
        days.forEach(day => {
          if (bestSchedule[className] && bestSchedule[className][day]) {
            bestSchedule[className][day].forEach(slot => {
              totalSlots++;
              if (slot === '' || slot === undefined) {
                emptySlots++;
              }
            });
          }
        });
      });
      
      setGenerationResults({
        schedule: bestSchedule,
        fillRate: bestFillRate,
        totalSlots,
        emptySlots,
        placedCount: totalSlots - emptySlots,
        filledSlots: totalSlots - emptySlots
      });
    }
    
    setIsAutoGenerating(false);
    window.stopAutoGeneration = false; // 중지 신호 초기화
  };

  const stats = getScheduleStats();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">시간표 생성</h2>
        
        {/* 진행 상황 표시 */}
        {(isGenerating || isAutoGenerating) && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {isAutoGenerating ? '자동 생성 진행률' : '생성 진행률'}
              </span>
              <span className="text-sm font-medium text-gray-700">
                {isAutoGenerating ? `${autoGenerationCount}/200` : `${generationProgress}%`}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  isAutoGenerating ? 'bg-green-600' : 'bg-blue-600'
                }`}
                style={{ 
                  width: isAutoGenerating 
                    ? `${(autoGenerationCount / 200) * 100}%` 
                    : `${generationProgress}%` 
                }}
              ></div>
            </div>
            {isAutoGenerating && (
              <div className="mt-2 text-sm text-gray-600">
                <div>최고 채움률: {bestFillRate.toFixed(1)}%</div>
                <div>목표: 채움률 100% 달성</div>
              </div>
            )}
          </div>
        )}

        {/* 생성 로그 */}
        {generationLog.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">생성 로그</h3>
            <div className="bg-gray-100 rounded-lg p-4 max-h-96 overflow-y-auto">
              {generationLog.map((log, index) => (
                <div 
                  key={index} 
                  className={`text-sm font-mono mb-1 ${
                    log.type === 'error' ? 'text-red-600' :
                    log.type === 'warning' ? 'text-yellow-600' :
                    log.type === 'success' ? 'text-green-600' :
                    'text-gray-700'
                  }`}
                >
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 시간표 통계 */}
        {stats && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">시간표 통계</h3>
            
            {/* 오류 상태 표시 */}
            {generationResults?.hasErrors && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">시간표 생성 중 오류 발생</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>⚠️ 오류가 발생했지만 부분적으로 생성된 시간표를 확인할 수 있습니다.</p>
                      <p className="mt-1 font-mono text-xs">{generationResults.errorMessage}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.totalSlots}</div>
                <div className="text-sm text-gray-600">전체 슬롯</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.filledSlots}</div>
                <div className="text-sm text-gray-600">배치된 슬롯</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{stats.emptySlots}</div>
                <div className="text-sm text-gray-600">빈 슬롯</div>
              </div>
              <div className={`p-4 rounded-lg ${generationResults?.hasErrors ? 'bg-red-50' : 'bg-purple-50'}`}>
                <div className={`text-2xl font-bold ${generationResults?.hasErrors ? 'text-red-600' : 'text-purple-600'}`}>
                  {stats.fillRate}%
                </div>
                <div className="text-sm text-gray-600">
                  {generationResults?.hasErrors ? '채움률 (오류 있음)' : '채움률'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 버튼 그룹 */}
        <div className="flex flex-wrap gap-4">
          <button
            onClick={generateTimetable}
            disabled={isGenerating || isAutoGenerating}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              isGenerating || isAutoGenerating
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isGenerating ? '생성 중...' : '시간표 생성'}
          </button>

          <button
            onClick={autoGenerateTimetable}
            disabled={isGenerating || isAutoGenerating}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              isGenerating || isAutoGenerating
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isAutoGenerating ? '자동 생성 중...' : '자동 생성 (100%까지)'}
          </button>

          {isAutoGenerating && (
            <button
              onClick={() => {
                setIsAutoGenerating(false);
                // 전역 변수로 중지 신호를 보내기 위해 window 객체 사용
                window.stopAutoGeneration = true;
                setGenerationLog(prev => [...prev, { 
                  message: `[${new Date().toLocaleTimeString()}] 사용자가 자동 생성을 중지했습니다.`, 
                  type: 'warning' 
                }]);
              }}
              className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              자동 생성 중지
            </button>
          )}

          {hasSchedule() && (
            <>
              <button
                onClick={clearSchedule}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                시간표 초기화
              </button>
              
              <button
                onClick={nextStep}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                다음 단계
              </button>
            </>
          )}

          <button
            onClick={prevStep}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            이전 단계
          </button>
        </div>
      </div>
    </div>
  );
}

export default TimetableGeneration; 