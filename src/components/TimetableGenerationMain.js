import React, { useState } from 'react';
import { 
  getCurrentSubjectHours,
  getCurrentTeacherHours,
  getClassSubjectHours,
  convertClassNameToKey,
  checkTeacherClassHoursLimit,
  checkTeacherUnavailable,
  isClassDisabled,
  canPlaceClassInSchedule,
  validateSlotPlacement,
  getClassList
} from './TimetableGenerationHelpers';
import {
  validateTeacherConstraints,
  validateClassHoursConstraints,
  validateTeacherTimeConflicts,
  validateTeacherUnavailableTimes,
  validateCoTeachingConstraints,
  validateDailySubjectOnceConstraints
} from './TimetableGenerationValidation';
import {
  findAvailableSlots,
  applyFixedClasses,
  processCoTeachingConstraints,
  processTeacherSameClassDailyLimit,
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

  const generateTimetable = async () => {
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationLog([]);
    setGenerationResults(null);

    const addLog = (message, type = 'info') => {
      setGenerationLog(prev => [...prev, { 
        message: `[${new Date().toLocaleTimeString()}] ${message}`, 
        type 
      }]);
    };

    try {
      addLog('시간표 생성을 시작합니다...', 'info');

      // 데이터 검증
      if (!data || !data.base) {
        throw new Error('기본 설정 데이터가 없습니다.');
      }

      if (!data.teachers || data.teachers.length === 0) {
        throw new Error('교사 정보가 없습니다.');
      }

      if (!data.subjects || data.subjects.length === 0) {
        throw new Error('과목 정보가 없습니다.');
      }

      // 1단계: 기본 시간표 구조 생성
      setGenerationProgress(10);
      const schedule = {};
      const classNames = [];
      const base = data.base || {};
      const grades = base.grades || 0;
      const classesPerGrade = base.classes_per_grade || [];
      const periodsPerDay = base.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };

      if (grades === 0) {
        throw new Error('학년 수가 설정되지 않았습니다.');
      }

      for (let grade = 1; grade <= grades; grade++) {
        const classesInGrade = classesPerGrade[grade - 1] || 0;
        for (let classNum = 1; classNum <= classesInGrade; classNum++) {
          const className = `${grade}학년 ${classNum}반`;
          
          // 0시간 설정 학급은 아예 스케줄에서 제외
          if (data.classWeeklyHours && data.classWeeklyHours[className] === 0) {
            addLog(`🚫 ${className}은 0시간 설정 학급으로 스케줄에서 제외됩니다.`, 'warning');
            continue;
          }
          
          classNames.push(className);
          schedule[className] = {};
          days.forEach(day => {
            const maxPeriods = periodsPerDay[day] || 7;
            schedule[className][day] = new Array(maxPeriods).fill('');
          });
        }
      }

      if (classNames.length === 0) {
        throw new Error('생성할 학급이 없습니다. 모든 학급이 0시간으로 설정되어 있을 수 있습니다.');
      }

      addLog(`📋 시간표 구조 생성 완료: ${classNames.length}개 학급`, 'success');

      // 2단계: 고정 수업 적용
      setGenerationProgress(20);
      applyFixedClasses(schedule, data, addLog);

      // 3단계: 공동수업 제약조건 처리
      setGenerationProgress(30);
      processCoTeachingConstraints(schedule, data, addLog);

      // 4단계: 교사별 같은 학급 일일 제한 처리
      setGenerationProgress(40);
      processTeacherSameClassDailyLimit(schedule, data, addLog);

      // 5단계: 나머지 수업 배치
      setGenerationProgress(50);
      addLog('나머지 수업을 배치합니다...', 'info');

      // 교사별로 수업 배치
      data.teachers.forEach(teacher => {
        const teacherSubjects = teacher.subjects || [];
        
        // subjects가 배열인 경우
        if (Array.isArray(teacherSubjects)) {
          teacherSubjects.forEach(subjectName => {
            // 과목 정보 찾기
            const subjectInfo = data.subjects?.find(s => s.name === subjectName);
            if (!subjectInfo) {
              addLog(`경고: ${subjectName} 과목 정보를 찾을 수 없습니다.`, 'warning');
              return;
            }
            
            const weeklyHours = subjectInfo.weekly_hours || 1;
            const targetClasses = getClassList(data);
            
            targetClasses.forEach(className => {
              if (!canPlaceClassInSchedule(className, data, addLog)) {
                return;
              }

              for (let hour = 0; hour < weeklyHours; hour++) {
                const availableSlots = findAvailableSlots(schedule, className, teacher, subjectName);
                
                if (availableSlots.length === 0) {
                  addLog(`경고: ${teacher.name} 교사의 ${subjectName} 수업을 배치할 수 있는 슬롯이 없습니다.`, 'warning');
                  break;
                }

                const selectedSlot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
                
                // 최종 안전 확인
                if (!validateSlotPlacement(schedule, selectedSlot.className, selectedSlot.day, selectedSlot.period, teacher, subjectName, data, addLog)) {
                  continue;
                }

                schedule[selectedSlot.className][selectedSlot.day][selectedSlot.slotIndex] = {
                  subject: subjectName,
                  teachers: [teacher.name],
                  isFixed: false,
                  isCoTeaching: false,
                  source: 'teacher_assignment'
                };

                addLog(`✅ ${teacher.name} 교사 ${subjectName} 배치: ${selectedSlot.className} ${selectedSlot.day}요일 ${selectedSlot.period}교시`, 'success');
              }
            });
          });
        }
      });

      // 6단계: 검증
      setGenerationProgress(80);
      addLog('시간표 검증을 시작합니다...', 'info');

      const teacherViolations = validateTeacherConstraints(schedule, data, addLog);
      const classViolations = validateClassHoursConstraints(schedule, data, addLog);
      const timeConflictViolations = validateTeacherTimeConflicts(schedule, data, addLog);
      const unavailableViolations = validateTeacherUnavailableTimes(schedule, data, addLog);
      const coTeachingViolations = validateCoTeachingConstraints(schedule, data, addLog);
      const dailySubjectViolations = validateDailySubjectOnceConstraints(schedule, data, addLog);

      const totalViolations = teacherViolations.length + classViolations.length + 
                             timeConflictViolations.length + unavailableViolations.length +
                             coTeachingViolations.length + dailySubjectViolations.length;

      if (totalViolations > 0) {
        addLog(`⚠️ 검증 결과: ${totalViolations}건의 제약조건 위반 발견`, 'warning');
      } else {
        addLog('✅ 모든 제약조건을 만족하는 시간표가 생성되었습니다!', 'success');
      }

      // 7단계: 결과 저장
      setGenerationProgress(100);
      updateData('schedule', schedule);

      const stats = getScheduleStats(schedule);
      setGenerationResults({
        schedule,
        fillRate: stats.fillRate,
        totalSlots: stats.totalSlots,
        emptySlots: stats.emptySlots,
        filledSlots: stats.filledSlots,
        hasErrors: totalViolations > 0,
        errorMessage: totalViolations > 0 ? `${totalViolations}건의 제약조건 위반` : null
      });

      addLog(`🎉 시간표 생성 완료! 채움률: ${stats.fillRate}%`, 'success');

    } catch (error) {
      addLog(`❌ 시간표 생성 중 오류 발생: ${error.message}`, 'error');
      setGenerationResults({
        hasErrors: true,
        errorMessage: error.message
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const autoGenerateTimetable = async () => {
    setIsAutoGenerating(true);
    setGenerationLog([]);
    setBestFillRate(0);
    setBestSchedule(null);

    const maxAttempts = 200;
    let attemptCount = 0;
    let shouldContinue = true;

    const addLog = (message, type = 'info') => {
      setGenerationLog(prev => [...prev, { 
        message: `[${new Date().toLocaleTimeString()}] ${message}`, 
        type 
      }]);
    };

    while (attemptCount < maxAttempts && shouldContinue) {
      attemptCount++;
      setAutoGenerationCount(attemptCount);
      
      if (window.stopAutoGeneration) {
        shouldContinue = false;
        window.stopAutoGeneration = false;
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
            
            if (data.classWeeklyHours && data.classWeeklyHours[className] === 0) {
              continue;
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
        applyFixedClasses(schedule, data, addLog);

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
            
            const coTeacherParticipation = {};
            constraint.coTeachers.forEach(teacher => {
              coTeacherParticipation[teacher] = 0;
            });

            let placedHours = 0;
            const maxAttempts = mainTeacherWeeklyHours * 30;
            let attempts = 0;
            let balanceMode = true;

            while (placedHours < mainTeacherWeeklyHours && attempts < maxAttempts) {
              attempts++;
              
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
              
              const availableCoTeachers = constraint.coTeachers.filter(coTeacherName => {
                const coTeacher = data.teachers.find(t => t.name === coTeacherName);
                if (!coTeacher) return false;
                
                const unavailableCheck = checkTeacherUnavailable(coTeacher, selectedSlot.day, selectedSlot.period);
                if (!unavailableCheck.allowed) {
                  return false;
                }
                
                const classHoursCheck = checkTeacherClassHoursLimit(coTeacher, selectedSlot.className, schedule, days);
                if (!classHoursCheck.allowed) {
                  return false;
                }
                
                const classWeeklyCheck = checkClassWeeklyHoursLimit(selectedSlot.className, schedule, data);
                if (!classWeeklyCheck.allowed) {
                  return false;
                }
                
                const classDailyCheck = checkClassDailyHoursLimit(selectedSlot.className, selectedSlot.day, schedule, data);
                if (!classDailyCheck.allowed) {
                  return false;
                }
                
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
                const sortedCoTeachers = [...availableCoTeachers].sort((a, b) => 
                  (coTeacherParticipation[a] || 0) - (coTeacherParticipation[b] || 0)
                );
                
                for (let i = 0; i < Math.min(maxCoTeachers, sortedCoTeachers.length); i++) {
                  const selectedTeacher = sortedCoTeachers[i];
                  selectedCoTeachers.push(selectedTeacher);
                  coTeacherParticipation[selectedTeacher] = (coTeacherParticipation[selectedTeacher] || 0) + 1;
                }
              } else {
                const shuffledCoTeachers = [...availableCoTeachers].sort(() => Math.random() - 0.5);
                
                for (let i = 0; i < Math.min(maxCoTeachers, shuffledCoTeachers.length); i++) {
                  const selectedTeacher = shuffledCoTeachers[i];
                  selectedCoTeachers.push(selectedTeacher);
                  coTeacherParticipation[selectedTeacher] = (coTeacherParticipation[selectedTeacher] || 0) + 1;
                }
              }

              if (!canPlaceClassInSchedule(selectedSlot.className, data)) {
                continue;
              }
              
              if (!validateSlotPlacement(schedule, selectedSlot.className, selectedSlot.day, selectedSlot.period, { name: constraint.mainTeacher }, subject, data, addLog)) {
                addLog(`⚠️ 자동생성 공동수업 중복 검증 실패: ${selectedSlot.className} ${selectedSlot.day} ${selectedSlot.period}교시 ${subject} 배치 건너뜀`, 'warning');
                continue;
              }
              
              schedule[selectedSlot.className][selectedSlot.day][selectedSlot.slotIndex] = {
                subject: subject,
                teachers: [constraint.mainTeacher, ...selectedCoTeachers],
                isCoTeaching: true,
                isFixed: false,
                source: 'constraint',
                constraintType: 'specific_teacher_co_teaching'
              };
              
              placedHours++;
            }
            
            addLog(`📊 ${constraint.mainTeacher} 공동수업 완료: ${placedHours}시간/${mainTeacherWeeklyHours}시간`, 'info');
          }
        });

        // 4단계: 나머지 수업 배치
        data.teachers.forEach(teacher => {
          const teacherSubjects = teacher.subjects || [];
          
          // subjects가 배열인 경우
          if (Array.isArray(teacherSubjects)) {
            teacherSubjects.forEach(subjectName => {
              // 과목 정보 찾기
              const subjectInfo = data.subjects?.find(s => s.name === subjectName);
              if (!subjectInfo) {
                addLog(`경고: ${subjectName} 과목 정보를 찾을 수 없습니다.`, 'warning');
                return;
              }
              
              const weeklyHours = subjectInfo.weekly_hours || 1;
              const targetClasses = getClassList(data);
              
              targetClasses.forEach(className => {
                if (!canPlaceClassInSchedule(className, data)) {
                  return;
                }

                for (let hour = 0; hour < weeklyHours; hour++) {
                  const availableSlots = findAvailableSlots(schedule, className, teacher, subjectName);
                  
                  if (availableSlots.length === 0) {
                    break;
                  }

                  const selectedSlot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
                  
                  if (!validateSlotPlacement(schedule, selectedSlot.className, selectedSlot.day, selectedSlot.period, teacher, subjectName, data)) {
                    continue;
                  }

                  schedule[selectedSlot.className][selectedSlot.day][selectedSlot.slotIndex] = {
                    subject: subjectName,
                    teachers: [teacher.name],
                    isFixed: false,
                    isCoTeaching: false,
                    source: 'teacher_assignment'
                  };
                }
              });
            });
          }
        });

        // 5단계: 결과 평가
        const stats = getScheduleStats(schedule);
        let fillRate = parseFloat(stats.fillRate);
        let totalSlots = stats.totalSlots;
        let emptySlots = stats.emptySlots;
        let placedCount = stats.filledSlots;
        let filledSlots = stats.filledSlots;

        // 제약조건 위반 확인
        const teacherViolations = validateTeacherConstraints(schedule, data, addLog);
        const classViolations = validateClassHoursConstraints(schedule, data, addLog);
        const zeroHoursViolations = 0; // 0시간 설정 위반은 이미 처리됨

        const totalViolations = teacherViolations.length + classViolations.length + zeroHoursViolations;
        if (totalViolations > 0) {
          let penalty = (teacherViolations.length + classViolations.length) * 5;
          penalty += zeroHoursViolations * 50;
          fillRate = Math.max(0, parseFloat(fillRate) - penalty).toFixed(1);
          addLog(`⚠️ 제약조건 위반 ${totalViolations}건으로 인해 품질 점수 ${penalty}% 감점 (조정된 점수: ${fillRate}%)`, 'warning');
        }
        
        if (parseFloat(fillRate) > bestFillRate) {
          setBestFillRate(parseFloat(fillRate));
          setBestSchedule(JSON.parse(JSON.stringify(schedule)));
          addLog(`🎉 새로운 최고 채움률 달성: ${fillRate}% (${attemptCount}번째 시도)`, 'success');
        }
        
        addLog(`📈 ${attemptCount}번째 시도 결과: 채움률 ${fillRate}% (최고: ${bestFillRate.toFixed(1)}%)`, 'info');
        
        if (fillRate === 100) {
          addLog(`🎊 축하합니다! ${attemptCount}번째 시도에서 채움률 100%를 달성했습니다!`, 'success');
          updateData('schedule', schedule);
          setGenerationResults({
            schedule,
            fillRate,
            totalSlots,
            emptySlots,
            placedCount,
            filledSlots
          });
          setIsAutoGenerating(false);
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        addLog(`❌ ${attemptCount}번째 시도 중 오류 발생: ${error.message}`, 'error');
      }
    }
    
    if (!shouldContinue) {
      addLog('⏹️ 자동 생성이 중단되었습니다.', 'warning');
      if (bestSchedule) {
        addLog('💾 현재까지의 최고 채움률 시간표를 저장합니다.', 'info');
        updateData('schedule', bestSchedule);
        
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
    
    addLog(`⚠️ ${maxAttempts}회 시도 후에도 채움률 100%를 달성하지 못했습니다.`, 'warning');
    addLog(`📊 최고 채움률: ${bestFillRate.toFixed(1)}%`, 'info');
    
    if (bestSchedule) {
      addLog('💾 최고 채움률의 시간표를 저장합니다.', 'info');
      updateData('schedule', bestSchedule);
      
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
    window.stopAutoGeneration = false;
  };

  const hasSchedule = () => {
    return data.schedule && Object.keys(data.schedule).length > 0;
  };

  const clearSchedule = () => {
    updateData('schedule', {});
    setGenerationResults(null);
    setGenerationLog([]);
    setBestFillRate(0);
    setBestSchedule(null);
  };

  const stats = getScheduleStats(data.schedule);

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