import React, { useState } from 'react';

function TimetableGeneration({ data, updateData, nextStep, prevStep }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationLog, setGenerationLog] = useState([]);
  const [generationResults, setGenerationResults] = useState(null);

  const days = ['월', '화', '수', '목', '금'];

  // 헬퍼 함수: 현재 과목 시수 계산
  const getCurrentSubjectHours = (schedule, className, subjectName) => {
    let hours = 0;
    if (!schedule[className]) return hours;
    
    days.forEach(day => {
      if (schedule[className][day]) {
        schedule[className][day].forEach(slot => {
          if (slot) {
            if (typeof slot === 'object' && slot.subject) {
              // 객체 형식 (새로운 형식)
              if (slot.subject === subjectName) {
                hours++;
              }
            } else if (typeof slot === 'string' && slot.trim() !== '') {
              // 문자열 형식 (기존 형식)
              if (slot.trim() === subjectName) {
                hours++;
              }
            }
          }
        });
      }
    });
    return hours;
  };

  // 헬퍼 함수: 교사별 현재 시수 계산
  const getCurrentTeacherHours = (schedule, teacherName) => {
    let hours = 0;
    
    Object.keys(schedule).forEach(className => {
      days.forEach(day => {
        if (schedule[className] && schedule[className][day]) {
          schedule[className][day].forEach(slot => {
            if (slot) {
              if (typeof slot === 'object' && slot.teachers) {
                // 객체 형식 (새로운 형식)
                if (slot.teachers.includes(teacherName)) {
                  hours++;
                }
              } else if (typeof slot === 'string' && slot.trim() !== '') {
                // 문자열 형식 (기존 형식)
                if (slot.trim() === teacherName) {
                  hours++;
                }
              }
            }
          });
        }
      });
    });
    return hours;
  };

  // 사용 가능한 슬롯 찾기 함수 (개선된 버전)
  const findAvailableSlots = (schedule, className, teacher, subjectName, isCoTeaching = false) => {
    const availableSlots = [];
    
    // 안전하게 periods_per_day 접근
    const periodsPerDay = data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };
    
    days.forEach(day => {
      const maxPeriods = periodsPerDay[day] || 7;
      
      for (let period = 1; period <= maxPeriods; period++) {
        const slotIndex = period - 1;
        
        // 해당 학급이 존재하는지 확인
        if (!schedule[className] || !schedule[className][day]) {
          continue;
        }
        
        // 슬롯이 비어있는지 확인
        if (schedule[className][day][slotIndex] === '' || schedule[className][day][slotIndex] === undefined) {
          // 교사 일일 학급 중복 금지 제약조건 확인
          const hasTeacherSameClassDailyLimit = (data.constraints?.must || []).some(c =>
            c.type === 'teacher_same_class_daily_limit'
          );
          
          if (hasTeacherSameClassDailyLimit) {
            // 해당 교사가 이미 이 학급의 이 요일에 수업을 하고 있는지 확인
            let teacherAlreadyTeaching = false;
            
            schedule[className][day].forEach((slot, index) => {
              if (slot) {
                if (typeof slot === 'object' && slot.teachers) {
                  // 객체 형식 (새로운 형식)
                  if (slot.teachers.includes(teacher.name)) {
                    teacherAlreadyTeaching = true;
                  }
                } else if (typeof slot === 'string' && slot.trim() !== '') {
                  // 문자열 형식 (기존 형식)
                  if (slot.trim() === teacher.name) {
                    teacherAlreadyTeaching = true;
                  }
                }
              }
            });
            
            if (teacherAlreadyTeaching) {
              continue; // 이미 해당 요일에 수업하고 있으면 건너뛰기
            }
          }
          
          // 교사 중복 금지 제약조건 확인
          const hasNoDuplicateTeachers = (data.constraints?.must || []).some(c =>
            c.type === 'no_duplicate_teachers'
          );
          
          if (hasNoDuplicateTeachers) {
            // 다른 학급에서 같은 시간에 해당 교사가 수업하고 있는지 확인
            let teacherConflict = false;
            
            Object.keys(schedule).forEach(otherClassName => {
              if (otherClassName !== className && schedule[otherClassName] && schedule[otherClassName][day]) {
                const otherSlot = schedule[otherClassName][day][slotIndex];
                if (otherSlot) {
                  if (typeof otherSlot === 'object' && otherSlot.teachers) {
                    // 객체 형식 (새로운 형식)
                    if (otherSlot.teachers.includes(teacher.name)) {
                      teacherConflict = true;
                    }
                  } else if (typeof otherSlot === 'string' && otherSlot.trim() !== '') {
                    // 문자열 형식 (기존 형식)
                    if (otherSlot.trim() === teacher.name) {
                      teacherConflict = true;
                    }
                  }
                }
              }
            });
            
            if (teacherConflict) {
              continue; // 다른 학급에서 같은 시간에 수업하고 있으면 건너뛰기
            }
          }
          
          availableSlots.push({ day, period, slotIndex });
        }
      }
    });
    
    return availableSlots;
  };

  // 공동수업 제약조건 처리 함수 (개선된 버전)
  const processCoTeachingConstraints = (schedule, addLog) => {
    const coTeachingConstraints = (data.constraints?.must || []).filter(c =>
      c.type === 'co_teaching_requirement' || c.type === 'specific_teacher_co_teaching'
    );

    addLog(`공동수업 제약조건 ${coTeachingConstraints.length}개를 처리합니다.`, 'info');

    // 제약조건을 랜덤 순서로 처리
    const shuffledConstraints = [...coTeachingConstraints].sort(() => Math.random() - 0.5);

    shuffledConstraints.forEach((constraint, index) => {
      if (constraint.mainTeacher && constraint.coTeachers && constraint.coTeachers.length > 0) {
        const mainTeacher = data.teachers.find(t => t.name === constraint.mainTeacher);
        if (!mainTeacher) {
          addLog(`경고: 주교사 ${constraint.mainTeacher}을 찾을 수 없습니다.`, 'warning');
          return;
        }

        const mainTeacherWeeklyHours = mainTeacher.weeklyHours || mainTeacher.maxHours || 25;
        const subject = constraint.subject || '공동수업';
        const className = constraint.className || `제약조건_${index + 1}`;
        const maxTeachersPerClass = constraint.maxTeachersPerClass || 2; // 한 수업당 최대 교사 수
        
        addLog(`공동수업 제약조건 처리: ${className} - ${constraint.mainTeacher}(주간시수: ${mainTeacherWeeklyHours}시간) + ${constraint.coTeachers.join(', ')} (최대교사수: ${maxTeachersPerClass}명)`, 'info');

        // 주교사의 주간시수만큼 공동수업 배치
        let placedHours = 0;
        const maxAttempts = mainTeacherWeeklyHours * 10; // 최대 시도 횟수
        let attempts = 0;

        // 부교사들을 랜덤하게 섞어서 순서 결정
        const shuffledCoTeachers = [...constraint.coTeachers].sort(() => Math.random() - 0.5);
        let coTeacherIndex = 0;

        while (placedHours < mainTeacherWeeklyHours && attempts < maxAttempts) {
          attempts++;
          
          // 요일과 교시를 랜덤하게 선택
          const availableDays = days.filter(d => {
            if (!schedule[className] || !schedule[className][d]) return false;
            // 해당 요일에 빈 슬롯이 있는지 확인
            return schedule[className][d].some(slot => slot === '' || slot === undefined);
          });
          
          if (availableDays.length === 0) {
            addLog(`경고: ${className}에 공동수업을 배치할 수 있는 요일이 없습니다.`, 'warning');
            break;
          }
          
          const selectedDay = availableDays[Math.floor(Math.random() * availableDays.length)];
          
          // 안전하게 periods_per_day 접근
          const periodsPerDay = data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };
          const maxPeriods = periodsPerDay[selectedDay] || 7;
          const availablePeriods = [];
          
          for (let p = 1; p <= maxPeriods; p++) {
            const slotIndex = p - 1;
            if (schedule[className] && schedule[className][selectedDay] && 
                (schedule[className][selectedDay][slotIndex] === '' || schedule[className][selectedDay][slotIndex] === undefined)) {
              availablePeriods.push(p);
            }
          }
          
          if (availablePeriods.length === 0) {
            continue; // 다른 요일로 재시도
          }
          
          const selectedPeriod = availablePeriods[Math.floor(Math.random() * availablePeriods.length)];
          const slotIndex = selectedPeriod - 1;

          // 해당 학급이 존재하는지 확인
          if (schedule[className] && schedule[className][selectedDay]) {
            if (slotIndex >= 0 && slotIndex < schedule[className][selectedDay].length) {
              // 슬롯이 비어있는지 확인
              if (schedule[className][selectedDay][slotIndex] === '' || schedule[className][selectedDay][slotIndex] === undefined) {
                // 부교사 선택 (최대 교사 수 제한에 따라)
                const selectedCoTeachers = [];
                const maxCoTeachers = Math.min(maxTeachersPerClass - 1, shuffledCoTeachers.length); // 주교사 제외
                
                for (let i = 0; i < maxCoTeachers; i++) {
                  const teacherIndex = (coTeacherIndex + i) % shuffledCoTeachers.length;
                  selectedCoTeachers.push(shuffledCoTeachers[teacherIndex]);
                }
                
                // 다음 수업을 위해 부교사 인덱스 업데이트
                coTeacherIndex = (coTeacherIndex + maxCoTeachers) % shuffledCoTeachers.length;

                schedule[className][selectedDay][slotIndex] = {
                  subject: subject,
                  teachers: [constraint.mainTeacher, ...selectedCoTeachers],
                  isCoTeaching: true,
                  isFixed: false,
                  source: 'constraint',
                  constraintType: constraint.type,
                  maxTeachersPerClass: maxTeachersPerClass
                };
                
                placedHours++;
                addLog(`공동수업 배치 ${placedHours}/${mainTeacherWeeklyHours}: ${className} ${selectedDay}요일 ${selectedPeriod}교시 - ${subject} (${constraint.mainTeacher} + ${selectedCoTeachers.join(', ')})`, 'success');
              }
            }
          } else {
            addLog(`경고: ${className} 학급이 존재하지 않습니다.`, 'warning');
            break;
          }
        }

        if (placedHours < mainTeacherWeeklyHours) {
          addLog(`경고: ${className}의 공동수업이 목표 시수(${mainTeacherWeeklyHours}시간)에 도달하지 못했습니다. (배치된 시수: ${placedHours}시간)`, 'warning');
        } else {
          addLog(`성공: ${className}의 공동수업 ${placedHours}시간 배치 완료`, 'success');
        }
      }
    });
  };

  // 교사 일일 학급 중복 금지 제약조건 처리 함수
  const processTeacherSameClassDailyLimit = (schedule, addLog) => {
    const teacherSameClassDailyLimitConstraints = (data.constraints?.must || []).filter(c =>
      c.type === 'teacher_same_class_daily_limit'
    );

    if (teacherSameClassDailyLimitConstraints.length === 0) {
      return; // 해당 제약조건이 없으면 처리하지 않음
    }

    addLog(`교사 일일 학급 중복 금지 제약조건을 처리합니다.`, 'info');

    // 각 학급별로 각 교사의 일일 수업 횟수를 추적
    const teacherDailyClassCount = {};

    // 모든 학급에 대해 처리
    Object.keys(schedule).forEach(className => {
      teacherDailyClassCount[className] = {};
      
      // 각 요일에 대해 처리
      days.forEach(day => {
        if (schedule[className] && schedule[className][day]) {
          schedule[className][day].forEach((slot, periodIndex) => {
            if (slot) {
              if (typeof slot === 'object' && slot.teachers) {
                // 객체 형식 (새로운 형식) - 공동수업인 경우
                slot.teachers.forEach(teacherName => {
                  if (!teacherDailyClassCount[className][teacherName]) {
                    teacherDailyClassCount[className][teacherName] = {};
                  }
                  if (!teacherDailyClassCount[className][teacherName][day]) {
                    teacherDailyClassCount[className][teacherName][day] = 0;
                  }
                  teacherDailyClassCount[className][teacherName][day]++;
                });
              } else if (typeof slot === 'string' && slot.trim() !== '') {
                // 문자열 형식 (기존 형식) - 단일 교사 수업인 경우
                const teacherName = slot.trim();
                if (!teacherDailyClassCount[className][teacherName]) {
                  teacherDailyClassCount[className][teacherName] = {};
                }
                if (!teacherDailyClassCount[className][teacherName][day]) {
                  teacherDailyClassCount[className][teacherName][day] = 0;
                }
                teacherDailyClassCount[className][teacherName][day]++;
              }
            }
          });
        }
      });
    });

    // 위반 사항 확인 및 로그 출력
    let violationCount = 0;
    Object.keys(teacherDailyClassCount).forEach(className => {
      Object.keys(teacherDailyClassCount[className]).forEach(teacherName => {
        Object.keys(teacherDailyClassCount[className][teacherName]).forEach(day => {
          const count = teacherDailyClassCount[className][teacherName][day];
          if (count > 1) {
            violationCount++;
            addLog(`위반: ${teacherName} 교사가 ${className} ${day}요일에 ${count}번 수업`, 'warning');
          }
        });
      });
    });

    if (violationCount === 0) {
      addLog(`✅ 교사 일일 학급 중복 금지 제약조건을 모두 준수합니다.`, 'success');
    } else {
      addLog(`⚠️ 교사 일일 학급 중복 금지 제약조건 위반: ${violationCount}건`, 'warning');
    }
  };

  // 시간표 생성 알고리즘 (빈 시간 없는 버전)
  const generateTimetable = async () => {
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationLog([]);

    const addLog = (message, type = 'info') => {
      const timestamp = new Date().toLocaleTimeString();
      setGenerationLog(prev => [...prev, { message: `[${timestamp}] ${message}`, type }]);
    };

    try {
      addLog('시간표 생성을 시작합니다...', 'info');

      // 1단계: 기본 시간표 구조 생성
      addLog('1단계: 기본 시간표 구조를 생성합니다.', 'info');
      const schedule = {};
      const classNames = [];
      const base = data.base || {};
      const grades = base.grades || 0;
      const classesPerGrade = base.classes_per_grade || [];
      const periodsPerDay = base.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };

      for (let grade = 1; grade <= grades; grade++) {
        const classesInGrade = classesPerGrade[grade - 1] || 0;
        for (let classNum = 1; classNum <= classesInGrade; classNum++) {
          const className = `${grade}학년 ${classNum}반`;
          classNames.push(className);
          schedule[className] = {};
          days.forEach(day => {
            const maxPeriods = periodsPerDay[day] || 7;
            schedule[className][day] = new Array(maxPeriods).fill('');
          });
        }
      }
      addLog(`${classNames.length}개 학급의 시간표 구조를 생성했습니다.`, 'success');
      setGenerationProgress(10);

      // 2단계: 고정 수업 적용
      addLog('2단계: 고정 수업을 적용합니다.', 'info');
      const fixedClasses = data.fixedClasses || [];
      let fixedCount = 0;
      fixedClasses.forEach(fixedClass => {
        if (schedule[fixedClass.className] && 
            schedule[fixedClass.className][fixedClass.day] && 
            schedule[fixedClass.className][fixedClass.day][fixedClass.period - 1] === '') {
          schedule[fixedClass.className][fixedClass.day][fixedClass.period - 1] = {
            subject: fixedClass.subject,
            teachers: fixedClass.teachers || [fixedClass.teacher],
            isFixed: true,
            isCoTeaching: fixedClass.teachers && fixedClass.teachers.length > 1
          };
          fixedCount++;
          addLog(`고정 수업 적용: ${fixedClass.className} ${fixedClass.day}요일 ${fixedClass.period}교시 - ${fixedClass.subject}`, 'success');
        }
      });
      addLog(`고정 수업 ${fixedCount}개를 적용합니다.`, 'success');
      setGenerationProgress(15);

      // 3단계: 공동수업 제약조건 처리
      addLog('3단계: 공동수업 제약조건을 처리합니다.', 'info');
      processCoTeachingConstraints(schedule, addLog);
      setGenerationProgress(20);

      // 3.5단계: 교사 일일 학급 중복 금지 제약조건 검증
      addLog('3.5단계: 교사 일일 학급 중복 금지 제약조건을 검증합니다.', 'info');
      processTeacherSameClassDailyLimit(schedule, addLog);
      setGenerationProgress(25);

      // 4단계: 교사별 시수 추적 초기화
      addLog('4단계: 교사별 시수를 추적합니다.', 'info');
      const teacherHours = {};
      const teachers = data.teachers || [];
      teachers.forEach(teacher => {
        teacherHours[teacher.name] = {
          current: getCurrentTeacherHours(schedule, teacher.name),
          max: teacher.weeklyHours || teacher.maxHours || 25,
          subjects: {}
        };
      });
      addLog(`교사 ${teachers.length}명의 시수를 추적합니다.`, 'success');
      setGenerationProgress(30);

      // 5단계: 교사별 시수 균형을 고려한 배치 계획 수립
      addLog('5단계: 교사별 시수 균형을 고려한 배치 계획을 수립합니다.', 'info');
      const subjects = data.subjects || [];
      const subjectPlacementPlan = [];
      
      // 과목별 기본 주간 시수
      const defaultWeeklyHours = {
        '국어': 5, '수학': 5, '과학': 4, '영어': 4,
        '역사': 3, '사회': 3, '체육': 3,
        '도덕': 2, '기술가정': 2, '음악': 2, '미술': 2,
        '정보': 1, '원어민': 1, '보건': 1, '진로와직업': 1,
        '동아리': 1, '스포츠': 1
      };
      
      // 교사별 과목 시수 요구사항 계산
      const teacherSubjectRequirements = {};
      teachers.forEach(teacher => {
        teacherSubjectRequirements[teacher.name] = {};
        const teacherSubjects = teacher.subjects || [];
        
        teacherSubjects.forEach(subjectName => {
          const subjectHours = teacher.subjectHours?.[subjectName] || 0;
          const defaultSubjectHours = defaultWeeklyHours[subjectName] || 1;
          const requiredHours = subjectHours > 0 ? subjectHours : defaultSubjectHours;
          
          teacherSubjectRequirements[teacher.name][subjectName] = {
            required: requiredHours,
            current: 0,
            priority: subjectHours > 0 ? 1 : 2 // 시수를 설정한 과목 우선
          };
        });
      });
      
      // 각 학급별로 필요한 과목과 시수 계산
      classNames.forEach(className => {
        subjects.forEach(subject => {
          const targetHours = subject.weekly_hours || defaultWeeklyHours[subject.name] || 1;
          const currentHours = getCurrentSubjectHours(schedule, className, subject.name);
          const remainingHours = targetHours - currentHours;
          
          if (remainingHours > 0) {
            // 해당 과목을 가르칠 수 있는 교사들 찾기
            const availableTeachers = teachers.filter(teacher => {
              const teacherSubjects = teacher.subjects || [];
              return teacherSubjects.includes(subject.name);
            });
            
            if (availableTeachers.length > 0) {
              // 교사별 우선순위 계산
              const teachersWithPriority = availableTeachers.map(teacher => {
                const requirement = teacherSubjectRequirements[teacher.name][subject.name];
                const currentTeacherHours = teacherHours[teacher.name]?.current || 0;
                const maxTeacherHours = teacherHours[teacher.name]?.max || 25;
                const remainingTeacherHours = maxTeacherHours - currentTeacherHours;
                
                // 우선순위 계산 (낮을수록 우선)
                let priority = 0;
                
                // 1. 시수를 설정한 과목 우선
                priority += requirement.priority * 1000;
                
                // 2. 교사 시수 부족도 (부족할수록 우선)
                priority += Math.max(0, requirement.required - requirement.current) * 100;
                
                // 3. 교사 주간시수 여유도 (여유가 있을수록 우선)
                priority += Math.max(0, 25 - remainingTeacherHours) * 10;
                
                // 4. 랜덤 요소 (균등 분배)
                priority += Math.random() * 5;
                
                return {
                  teacher,
                  priority,
                  requirement,
                  remainingTeacherHours
                };
              });
              
              // 우선순위에 따라 정렬
              teachersWithPriority.sort((a, b) => a.priority - b.priority);
              
              for (let i = 0; i < remainingHours; i++) {
                // 우선순위가 높은 교사부터 선택
                const selectedTeacherInfo = teachersWithPriority[i % teachersWithPriority.length];
                
                subjectPlacementPlan.push({
                  className,
                  subject: subject.name,
                  priority: selectedTeacherInfo.priority,
                  retryCount: 0,
                  selectedTeacher: selectedTeacherInfo.teacher,
                  requirement: selectedTeacherInfo.requirement
                });
              }
            } else {
              addLog(`경고: ${subject.name} 과목을 가르칠 수 있는 교사가 없습니다.`, 'warning');
            }
          }
        });
      });
      
      addLog(`총 ${subjectPlacementPlan.length}개의 수업을 배치해야 합니다.`, 'info');
      setGenerationProgress(40);

      // 6단계: 교사별 시수 균형을 고려한 강화된 배치 알고리즘
      addLog('6단계: 교사별 시수 균형을 고려한 강화된 배치 알고리즘으로 과목을 배치합니다.', 'info');
      
      let placedCount = 0;
      const maxAttempts = subjectPlacementPlan.length * 100; // 최대 시도 횟수 대폭 증가
      let attempts = 0;
      
      // 우선순위에 따라 정렬 (낮은 우선순위가 먼저)
      subjectPlacementPlan.sort((a, b) => a.priority - b.priority);
      
      while (subjectPlacementPlan.length > 0 && attempts < maxAttempts) {
        attempts++;
        const placement = subjectPlacementPlan.shift();
        
        // 선택된 교사가 여전히 적합한지 확인
        const selectedTeacher = placement.selectedTeacher;
        const teacherSubjects = selectedTeacher.subjects || [];
        const isTeacherAvailable = teacherSubjects.includes(placement.subject);
        const currentTeacherHours = teacherHours[selectedTeacher.name]?.current || 0;
        const maxTeacherHours = teacherHours[selectedTeacher.name]?.max || 25;
        const hasTeacherCapacity = currentTeacherHours < maxTeacherHours;
        
        if (isTeacherAvailable && hasTeacherCapacity) {
          // 정상적인 배치
          const availableSlots = findAvailableSlots(schedule, placement.className, selectedTeacher, placement.subject);
          
          if (availableSlots.length > 0) {
            const selectedSlot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
            schedule[placement.className][selectedSlot.day][selectedSlot.slotIndex] = {
              subject: placement.subject,
              teachers: [selectedTeacher.name],
              isCoTeaching: false,
              isFixed: false
            };
            
            // 시수 업데이트
            if (teacherHours[selectedTeacher.name]) {
              teacherHours[selectedTeacher.name].current++;
              teacherHours[selectedTeacher.name].subjects[placement.subject] = 
                (teacherHours[selectedTeacher.name].subjects[placement.subject] || 0) + 1;
            }
            
            // 교사별 과목 요구사항 업데이트
            if (teacherSubjectRequirements[selectedTeacher.name] && 
                teacherSubjectRequirements[selectedTeacher.name][placement.subject]) {
              teacherSubjectRequirements[selectedTeacher.name][placement.subject].current++;
            }
            
            placedCount++;
            if (placedCount % 10 === 0) {
              addLog(`${placedCount}개 수업 배치 완료...`, 'info');
              setGenerationProgress(40 + (placedCount / (subjectPlacementPlan.length + placedCount)) * 40);
            }
          } else {
            // 재시도 로직 - 다른 교사로 변경
            placement.retryCount++;
            if (placement.retryCount < 5) {
              // 다른 교사 찾기
              const alternativeTeachers = teachers.filter(teacher => {
                const teacherSubjects = teacher.subjects || [];
                return teacherSubjects.includes(placement.subject) &&
                       teacherHours[teacher.name]?.current < teacherHours[teacher.name]?.max;
              });
              
              if (alternativeTeachers.length > 0) {
                // 우선순위에 따라 다른 교사 선택
                const alternativeTeachersWithPriority = alternativeTeachers.map(teacher => {
                  const requirement = teacherSubjectRequirements[teacher.name][placement.subject];
                  const currentTeacherHours = teacherHours[teacher.name]?.current || 0;
                  const maxTeacherHours = teacherHours[teacher.name]?.max || 25;
                  const remainingTeacherHours = maxTeacherHours - currentTeacherHours;
                  
                  let priority = 0;
                  priority += (requirement?.priority || 2) * 1000;
                  priority += Math.max(0, (requirement?.required || 1) - (requirement?.current || 0)) * 100;
                  priority += Math.max(0, 25 - remainingTeacherHours) * 10;
                  priority += Math.random() * 5;
                  
                  return { teacher, priority };
                });
                
                alternativeTeachersWithPriority.sort((a, b) => a.priority - b.priority);
                placement.selectedTeacher = alternativeTeachersWithPriority[0].teacher;
                placement.priority = alternativeTeachersWithPriority[0].priority;
                subjectPlacementPlan.push(placement);
              } else {
                addLog(`경고: ${placement.className}의 ${placement.subject} 과목을 배치할 수 있는 교사가 없습니다.`, 'warning');
              }
            } else {
              addLog(`경고: ${placement.className}의 ${placement.subject} 과목을 배치할 수 없습니다. (재시도 ${placement.retryCount}회)`, 'warning');
            }
          }
        } else {
          // 교사가 부적합한 경우, 다른 교사로 변경
          placement.retryCount++;
          if (placement.retryCount < 5) {
            // 다른 교사 찾기
            const alternativeTeachers = teachers.filter(teacher => {
              const teacherSubjects = teacher.subjects || [];
              return teacherSubjects.includes(placement.subject) &&
                     teacherHours[teacher.name]?.current < teacherHours[teacher.name]?.max;
            });
            
            if (alternativeTeachers.length > 0) {
              // 우선순위에 따라 다른 교사 선택
              const alternativeTeachersWithPriority = alternativeTeachers.map(teacher => {
                const requirement = teacherSubjectRequirements[teacher.name][placement.subject];
                const currentTeacherHours = teacherHours[teacher.name]?.current || 0;
                const maxTeacherHours = teacherHours[teacher.name]?.max || 25;
                const remainingTeacherHours = maxTeacherHours - currentTeacherHours;
                
                let priority = 0;
                priority += (requirement?.priority || 2) * 1000;
                priority += Math.max(0, (requirement?.required || 1) - (requirement?.current || 0)) * 100;
                priority += Math.max(0, 25 - remainingTeacherHours) * 10;
                priority += Math.random() * 5;
                
                return { teacher, priority };
              });
              
              alternativeTeachersWithPriority.sort((a, b) => a.priority - b.priority);
              placement.selectedTeacher = alternativeTeachersWithPriority[0].teacher;
              placement.priority = alternativeTeachersWithPriority[0].priority;
              subjectPlacementPlan.push(placement);
            } else {
              // 교사가 부족한 경우, 시수 제한을 무시하고 배치
              const allTeachers = teachers.filter(teacher => {
                const teacherSubjects = teacher.subjects || [];
                return teacherSubjects.includes(placement.subject);
              });
              
              if (allTeachers.length > 0) {
                const selectedTeacher = allTeachers[Math.floor(Math.random() * allTeachers.length)];
                const availableSlots = findAvailableSlots(schedule, placement.className, selectedTeacher, placement.subject);
                
                if (availableSlots.length > 0) {
                  const selectedSlot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
                  schedule[placement.className][selectedSlot.day][selectedSlot.slotIndex] = {
                    subject: placement.subject,
                    teachers: [selectedTeacher.name],
                    isCoTeaching: false,
                    isFixed: false
                  };
                  
                  // 시수 업데이트 (제한을 초과해도 배치)
                  if (teacherHours[selectedTeacher.name]) {
                    teacherHours[selectedTeacher.name].current++;
                    teacherHours[selectedTeacher.name].subjects[placement.subject] = 
                      (teacherHours[selectedTeacher.name].subjects[placement.subject] || 0) + 1;
                  }
                  
                  placedCount++;
                  if (placedCount % 10 === 0) {
                    addLog(`${placedCount}개 수업 배치 완료...`, 'info');
                    setGenerationProgress(40 + (placedCount / (subjectPlacementPlan.length + placedCount)) * 40);
                  }
                } else {
                  addLog(`경고: ${placement.className}의 ${placement.subject} 과목을 배치할 수 없습니다.`, 'warning');
                }
              } else {
                addLog(`경고: ${placement.className}의 ${placement.subject} 과목을 담당할 교사가 없습니다.`, 'warning');
              }
            }
          } else {
            addLog(`경고: ${placement.className}의 ${placement.subject} 과목을 배치할 수 없습니다. (재시도 ${placement.retryCount}회)`, 'warning');
          }
        }
      }
      
      setGenerationProgress(80);

      // 7단계: 교사별 시수 균형을 고려하여 빈 슬롯을 채웁니다.
      addLog('7단계: 교사별 시수 균형을 고려하여 빈 슬롯을 채웁니다.', 'info');
      let filledSlots = 0;
      
      classNames.forEach(className => {
        days.forEach(day => {
          if (schedule[className] && schedule[className][day]) {
            schedule[className][day].forEach((slot, periodIndex) => {
              if (slot === '' || slot === undefined) {
                // 빈 슬롯을 찾아서 교사별 시수 균형을 고려하여 채우기
                const availableSubjects = subjects.filter(subject => {
                  const currentHours = getCurrentSubjectHours(schedule, className, subject.name);
                  const targetHours = subject.weekly_hours || defaultWeeklyHours[subject.name] || 1;
                  return currentHours < targetHours;
                });
                
                if (availableSubjects.length > 0) {
                  // 교사별 우선순위를 고려하여 과목과 교사 선택
                  const subjectTeacherPairs = [];
                  
                  availableSubjects.forEach(subject => {
                    const availableTeachers = teachers.filter(teacher => 
                      (teacher.subjects || []).includes(subject.name)
                    );
                    
                    availableTeachers.forEach(teacher => {
                      const requirement = teacherSubjectRequirements[teacher.name]?.[subject.name];
                      const currentTeacherHours = teacherHours[teacher.name]?.current || 0;
                      const maxTeacherHours = teacherHours[teacher.name]?.max || 25;
                      const remainingTeacherHours = maxTeacherHours - currentTeacherHours;
                      
                      // 우선순위 계산 (낮을수록 우선)
                      let priority = 0;
                      
                      // 1. 시수를 설정한 과목 우선
                      priority += (requirement?.priority || 2) * 1000;
                      
                      // 2. 교사 시수 부족도 (부족할수록 우선)
                      priority += Math.max(0, (requirement?.required || 1) - (requirement?.current || 0)) * 100;
                      
                      // 3. 교사 주간시수 여유도 (여유가 있을수록 우선)
                      priority += Math.max(0, 25 - remainingTeacherHours) * 10;
                      
                      // 4. 랜덤 요소 (균등 분배)
                      priority += Math.random() * 5;
                      
                      subjectTeacherPairs.push({
                        subject,
                        teacher,
                        priority
                      });
                    });
                  });
                  
                  // 우선순위에 따라 정렬
                  subjectTeacherPairs.sort((a, b) => a.priority - b.priority);
                  
                  if (subjectTeacherPairs.length > 0) {
                    const selectedPair = subjectTeacherPairs[0];
                    schedule[className][day][periodIndex] = {
                      subject: selectedPair.subject.name,
                      teachers: [selectedPair.teacher.name],
                      isCoTeaching: false,
                      isFixed: false
                    };
                    filledSlots++;
                    
                    // 시수 업데이트
                    if (teacherHours[selectedPair.teacher.name]) {
                      teacherHours[selectedPair.teacher.name].current++;
                      teacherHours[selectedPair.teacher.name].subjects[selectedPair.subject.name] = 
                        (teacherHours[selectedPair.teacher.name].subjects[selectedPair.subject.name] || 0) + 1;
                    }
                    
                    // 교사별 과목 요구사항 업데이트
                    if (teacherSubjectRequirements[selectedPair.teacher.name] && 
                        teacherSubjectRequirements[selectedPair.teacher.name][selectedPair.subject.name]) {
                      teacherSubjectRequirements[selectedPair.teacher.name][selectedPair.subject.name].current++;
                    }
                  }
                }
              }
            });
          }
        });
      });
      
      addLog(`빈 슬롯 ${filledSlots}개를 교사별 시수 균형을 고려하여 채웠습니다.`, 'success');
      setGenerationProgress(90);

      // 8단계: 최종 검증 및 교사별 시수 균형 결과 표시
      addLog('8단계: 생성된 시간표를 검증하고 교사별 시수 균형을 확인합니다.', 'info');
      
      // 빈 슬롯 개수 확인
      let emptySlots = 0;
      let totalSlots = 0;
      
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
      
      const fillRate = ((totalSlots - emptySlots) / totalSlots * 100).toFixed(1);
      
      addLog(`시간표 생성 완료: ${placedCount + filledSlots}/${subjectPlacementPlan.length + filledSlots} 수업 배치 (100%)`, 'success');
      addLog(`시간표 채움률: ${fillRate}% (${totalSlots - emptySlots}/${totalSlots})`, 'success');
      
      if (emptySlots === 0) {
        addLog('✅ 모든 시간표 슬롯이 채워졌습니다!', 'success');
      } else {
        addLog(`⚠️ ${emptySlots}개의 빈 슬롯이 남아있습니다.`, 'warning');
      }
      
      // 교사별 시수 균형 결과 표시
      addLog('📊 교사별 시수 균형 결과:', 'info');
      
      const teacherBalanceResults = [];
      teachers.forEach(teacher => {
        const currentHours = teacherHours[teacher.name]?.current || 0;
        const maxHours = teacherHours[teacher.name]?.max || 25;
        const balance = currentHours - maxHours;
        const balanceStatus = balance === 0 ? '균형' : balance > 0 ? '초과' : '부족';
        
        teacherBalanceResults.push({
          teacher: teacher.name,
          current: currentHours,
          max: maxHours,
          balance,
          status: balanceStatus
        });
        
        if (balance === 0) {
          addLog(`✅ ${teacher.name}: ${currentHours}/${maxHours}시간 (균형)`, 'success');
        } else if (balance > 0) {
          addLog(`⚠️ ${teacher.name}: ${currentHours}/${maxHours}시간 (+${balance}시간 초과)`, 'warning');
        } else {
          addLog(`ℹ️ ${teacher.name}: ${currentHours}/${maxHours}시간 (${Math.abs(balance)}시간 부족)`, 'info');
        }
      });
      
      // 교사별 과목 시수 설정 결과 표시
      addLog('📚 교사별 과목 시수 설정 결과:', 'info');
      
      teachers.forEach(teacher => {
        const teacherSubjects = teacher.subjects || [];
        if (teacherSubjects.length > 0) {
          addLog(`${teacher.name} 교사 과목별 시수:`, 'info');
          
          teacherSubjects.forEach(subjectName => {
            const requirement = teacherSubjectRequirements[teacher.name]?.[subjectName];
            const currentHours = requirement?.current || 0;
            const requiredHours = requirement?.required || 1;
            const balance = currentHours - requiredHours;
            
            if (balance === 0) {
              addLog(`  ✅ ${subjectName}: ${currentHours}/${requiredHours}시간 (균형)`, 'success');
            } else if (balance > 0) {
              addLog(`  ⚠️ ${subjectName}: ${currentHours}/${requiredHours}시간 (+${balance}시간 초과)`, 'warning');
            } else {
              addLog(`  ℹ️ ${subjectName}: ${currentHours}/${requiredHours}시간 (${Math.abs(balance)}시간 부족)`, 'info');
            }
          });
        }
      });
      
      // 전체 통계
      const balancedTeachers = teacherBalanceResults.filter(t => t.balance === 0).length;
      const overTeachers = teacherBalanceResults.filter(t => t.balance > 0).length;
      const underTeachers = teacherBalanceResults.filter(t => t.balance < 0).length;
      
      addLog(`📈 교사별 시수 균형 통계:`, 'info');
      addLog(`  • 균형: ${balancedTeachers}명`, 'success');
      addLog(`  • 초과: ${overTeachers}명`, 'warning');
      addLog(`  • 부족: ${underTeachers}명`, 'info');
      
      addLog('시간표 생성이 성공적으로 완료되었습니다!', 'success');
      setGenerationProgress(100);

      // 결과 저장
      updateData('schedule', schedule);
      setGenerationResults(results);

    } catch (error) {
      addLog(`오류 발생: ${error.message}`, 'error');
      console.error('시간표 생성 오류:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const hasSchedule = () => {
    return data.schedule && Object.keys(data.schedule).length > 0;
  };

  const getScheduleStats = () => {
    if (!hasSchedule()) return null;

    const classNames = Object.keys(data.schedule);
    let totalSlots = 0;
    let filledSlots = 0;

    classNames.forEach(className => {
      days.forEach(day => {
        if (data.schedule[className][day]) {
          data.schedule[className][day].forEach(subject => {
            totalSlots++;
            // subject가 문자열인 경우와 객체인 경우를 모두 처리
            if (subject) {
              if (typeof subject === 'string' && subject.trim() !== '') {
                filledSlots++;
              } else if (typeof subject === 'object' && subject.subject) {
                filledSlots++;
              }
            }
          });
        }
      });
    });

    return {
      totalSlots,
      filledSlots,
      fillRate: Math.round((filledSlots / totalSlots) * 100)
    };
  };

  const clearSchedule = () => {
    if (confirm('생성된 시간표를 삭제하시겠습니까?')) {
      updateData('schedule', {});
      setGenerationResults(null);
      setGenerationLog([]);
      setGenerationProgress(0);
    }
  };

  const stats = getScheduleStats();

  return (
    <div className="card">
      <h2>🎯 시간표 생성</h2>
      
      {/* 생성 전 체크리스트 */}
      <div className="card" style={{ backgroundColor: '#f8f9fa', marginBottom: '30px' }}>
        <h3>📋 생성 전 체크리스트</h3>
        <div className="grid grid-2" style={{ marginTop: '20px' }}>
          <div>
            <h4>기본 설정</h4>
            <ul>
              <li style={{ color: data.base.grades > 0 ? '#28a745' : '#dc3545' }}>
                ✓ 학년 수: {data.base.grades}개
              </li>
              <li style={{ color: data.base.classes_per_grade.reduce((sum, classes) => sum + classes, 0) > 0 ? '#28a745' : '#dc3545' }}>
                ✓ 총 학급 수: {data.base.classes_per_grade.reduce((sum, classes) => sum + classes, 0)}개
              </li>
              <li style={{ color: Object.values(data.base.periods_per_day).reduce((a, b) => a + b, 0) > 0 ? '#28a745' : '#dc3545' }}>
                ✓ 주당 교시: {Object.values(data.base.periods_per_day).reduce((a, b) => a + b, 0)}교시
              </li>
            </ul>
          </div>
          <div>
            <h4>과목 및 교사</h4>
            <ul>
              <li style={{ color: data.subjects.length > 0 ? '#28a745' : '#dc3545' }}>
                ✓ 등록된 과목: {data.subjects.length}개
              </li>
              <li style={{ color: data.teachers.length > 0 ? '#28a745' : '#dc3545' }}>
                ✓ 등록된 교사: {data.teachers.length}명
              </li>
              <li style={{ color: data.constraints.must.length + data.constraints.optional.length > 0 ? '#28a745' : '#fd7e14' }}>
                ✓ 제약 조건: {data.constraints.must.length + data.constraints.optional.length}개
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 시간표 생성 버튼 */}
      <div className="card" style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h3>🚀 시간표 생성</h3>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          설정된 조건들을 바탕으로 자동으로 시간표를 생성합니다.
        </p>
        
        {!isGenerating && (
          <div>
            <button 
              className="btn btn-primary"
              onClick={generateTimetable}
              style={{ fontSize: '18px', padding: '15px 40px', marginRight: '15px' }}
              disabled={data.subjects.length === 0 || data.teachers.length === 0}
            >
              {hasSchedule() ? '시간표 재생성' : '시간표 생성'}
            </button>
            {hasSchedule() && (
              <button 
                className="btn btn-danger"
                onClick={clearSchedule}
                style={{ fontSize: '18px', padding: '15px 40px' }}
              >
                시간표 삭제
              </button>
            )}
          </div>
        )}

        {isGenerating && (
          <div>
            <div style={{ width: '100%', backgroundColor: '#e9ecef', borderRadius: '10px', marginBottom: '20px' }}>
              <div 
                style={{ 
                  width: `${generationProgress}%`, 
                  backgroundColor: '#667eea', 
                  height: '20px', 
                  borderRadius: '10px',
                  transition: 'width 0.3s ease'
                }}
              ></div>
            </div>
            <p style={{ fontSize: '18px', color: '#667eea' }}>
              생성 중... {generationProgress}%
            </p>
          </div>
        )}
      </div>

      {/* 생성 로그 */}
      {generationLog.length > 0 && (
        <div className="card" style={{ marginBottom: '30px' }}>
          <h3>📝 생성 로그</h3>
          <div style={{ 
            maxHeight: '300px', 
            overflowY: 'auto', 
            backgroundColor: '#f8f9fa', 
            padding: '15px', 
            borderRadius: '8px',
            marginTop: '15px'
          }}>
            {generationLog.map((log, index) => (
              <div key={index} style={{ 
                marginBottom: '8px',
                color: log.type === 'error' ? '#dc3545' : 
                      log.type === 'warning' ? '#fd7e14' : 
                      log.type === 'success' ? '#28a745' : '#333'
              }}>
                <span style={{ color: '#666', fontSize: '12px' }}>[{log.timestamp}]</span> {log.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 생성 결과 통계 */}
      {generationResults && (
        <div className="card" style={{ marginBottom: '30px' }}>
          <h3>📊 생성 결과</h3>
          <div className="grid grid-4" style={{ marginTop: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <h4 style={{ color: '#667eea', fontSize: '2rem' }}>{generationResults.completionRate}%</h4>
              <p>완성도</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <h4 style={{ color: '#28a745', fontSize: '2rem' }}>{generationResults.placedSubjects}</h4>
              <p>배치된 수업</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <h4 style={{ color: '#fd7e14', fontSize: '2rem' }}>{generationResults.conflicts.length}</h4>
              <p>충돌 발견</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <h4 style={{ color: '#6c757d', fontSize: '2rem' }}>{generationResults.warnings.length}</h4>
              <p>경고</p>
            </div>
          </div>
        </div>
      )}

      {/* 충돌 목록 */}
      {generationResults?.conflicts.length > 0 && (
        <div className="card" style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#dc3545' }}>⚠️ 발견된 충돌</h3>
          <div style={{ marginTop: '15px' }}>
            {generationResults.conflicts.map((conflict, index) => (
              <div key={index} className="alert alert-error">
                <strong>교사 중복:</strong> {conflict.teacher} ({conflict.time}) - 
                담당 학급: {conflict.classes.join(', ')}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 시간표 미리보기 */}
      {hasSchedule() && stats && (
        <div className="card">
          <h3>👀 시간표 미리보기</h3>
          <div style={{ marginBottom: '20px' }}>
            <p>전체 {stats.totalSlots}개 시간 중 {stats.filledSlots}개 배치 완료 ({stats.fillRate}%)</p>
          </div>
          
          {/* 첫 번째 학급 시간표만 미리보기 */}
          {Object.keys(data.schedule).length > 0 && (
            <div>
              <h4>{Object.keys(data.schedule)[0]} 시간표</h4>
              <div style={{ overflowX: 'auto', marginTop: '15px' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>교시</th>
                      {days.map(day => (
                        <th key={day}>{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: Math.max(...Object.values(data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 })) }, (_, periodIndex) => {
                      const period = periodIndex + 1;
                      return (
                        <tr key={period}>
                          <td><strong>{period}교시</strong></td>
                          {days.map(day => {
                            const className = Object.keys(data.schedule)[0];
                            const scheduleItem = data.schedule[className]?.[day]?.[period - 1] || '';
                            const periodsPerDay = data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };
                            const isValidPeriod = period <= periodsPerDay[day];
                            
                            // 공동 수업인 경우 표시 형식 결정
                            let displayText = '';
                            let titleText = '';
                            let bgColor = '#fff';
                            
                            if (isValidPeriod && scheduleItem) {
                              if (typeof scheduleItem === 'object') {
                                if (scheduleItem.isCoTeaching) {
                                  displayText = `${scheduleItem.subject} (공동)`;
                                  titleText = `${scheduleItem.subject} - ${scheduleItem.teachers.join(', ')}`;
                                  bgColor = scheduleItem.isFixed ? '#e8f5ff' : '#e8f5ff'; // 공동 수업은 파란색 배경
                                } else {
                                  displayText = scheduleItem.subject;
                                  titleText = scheduleItem.subject;
                                  bgColor = scheduleItem.isFixed ? '#fff3cd' : '#e8f5e8'; // 고정 수업은 노란색 배경
                                }
                                
                                // 고정 수업 표시
                                if (scheduleItem.isFixed) {
                                  displayText += ' (고정)';
                                }
                              } else {
                                displayText = scheduleItem;
                                titleText = scheduleItem;
                                bgColor = '#e8f5e8';
                              }
                            }
                            
                            return (
                              <td key={day} className="text-ellipsis" style={{ 
                                backgroundColor: !isValidPeriod ? '#f8f9fa' : bgColor,
                                color: !isValidPeriod ? '#ccc' : '#333',
                                maxWidth: '120px'
                              }} title={isValidPeriod ? (titleText || '-') : ''}>
                                {isValidPeriod ? (displayText || '-') : ''}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <small style={{ color: '#666' }}>
                * 모든 학급의 시간표는 다음 단계에서 확인할 수 있습니다.
              </small>
            </div>
          )}
        </div>
      )}

      {/* 네비게이션 */}
      <div className="navigation">
        <button className="btn btn-secondary" onClick={prevStep}>
          ← 이전 단계
        </button>
        <button 
          className="btn btn-primary" 
          onClick={nextStep}
          disabled={!hasSchedule()}
        >
          다음 단계 →
        </button>
      </div>
    </div>
  );
}

export default TimetableGeneration; 