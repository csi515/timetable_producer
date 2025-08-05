import { 
  ClassScheduleArray, 
  TeacherScheduleArray, 
  TeacherHoursTracker, 
  TimetableData, 
  ValidationResult,
  Teacher,
  Subject,
  Class
} from '../types';
import { DAYS } from '../utils/helpers';

// 최종 검증 시스템
export class PostValidator {
  private schedule: ClassScheduleArray;
  private teacherSchedule: TeacherScheduleArray;
  private teacherHours: TeacherHoursTracker;
  private data: TimetableData;

  constructor(
    schedule: ClassScheduleArray,
    teacherSchedule: TeacherScheduleArray,
    teacherHours: TeacherHoursTracker,
    data: TimetableData
  ) {
    this.schedule = schedule;
    this.teacherSchedule = teacherSchedule;
    this.teacherHours = teacherHours;
    this.data = data;
  }

  // 전체 검증 실행
  public validateTimetable(addLog: (message: string, type?: string) => void): {
    isValid: boolean;
    violations: string[];
    summary: any;
  } {
    addLog('🔍 최종 검증을 시작합니다...', 'info');
    addLog('', 'info');

    const violations: string[] = [];
    let isValid = true;

    // 1. 교사별 수업 가능 시간 검증
    addLog('1️⃣ 교사별 수업 가능 시간 검증', 'info');
    const teacherTimeViolations = this.validateTeacherAvailableTimes(addLog);
    if (teacherTimeViolations.length > 0) {
      violations.push(...teacherTimeViolations);
      isValid = false;
    } else {
      addLog('✅ 조건 만족', 'success');
    }
    addLog('', 'info');

    // 2. 교사별 주간 수업 시수 검증
    addLog('2️⃣ 교사별 주간 수업 시수 검증', 'info');
    const teacherHoursViolations = this.validateTeacherWeeklyHours(addLog);
    if (teacherHoursViolations.length > 0) {
      violations.push(...teacherHoursViolations);
      isValid = false;
    } else {
      addLog('✅ 조건 만족', 'success');
    }
    addLog('', 'info');

    // 3. 학급별 주간 수업 시수 검증
    addLog('3️⃣ 학급별 주간 수업 시수 검증', 'info');
    const classHoursViolations = this.validateClassWeeklyHours(addLog);
    if (classHoursViolations.length > 0) {
      violations.push(...classHoursViolations);
      isValid = false;
    } else {
      addLog('✅ 조건 만족', 'success');
    }
    addLog('', 'info');

    // 4. 블록제 수업 연속 배정 검증
    addLog('4️⃣ 블록제 수업 연속 배정 검증', 'info');
    const blockPeriodViolations = this.validateBlockPeriodPlacements(addLog);
    if (blockPeriodViolations.length > 0) {
      violations.push(...blockPeriodViolations);
      isValid = false;
    } else {
      addLog('✅ 조건 만족', 'success');
    }
    addLog('', 'info');

    // 5. 공동수업 조건 검증
    addLog('5️⃣ 공동수업 조건 검증', 'info');
    const coTeachingViolations = this.validateCoTeachingConditions(addLog);
    if (coTeachingViolations.length > 0) {
      violations.push(...coTeachingViolations);
      isValid = false;
    } else {
      addLog('✅ 조건 만족', 'success');
    }
    addLog('', 'info');

    // 6. 교사 동시 배정 검증
    addLog('6️⃣ 교사 동시 배정 검증', 'info');
    const teacherConflictViolations = this.validateTeacherSimultaneousAssignment(addLog);
    if (teacherConflictViolations.length > 0) {
      violations.push(...teacherConflictViolations);
      isValid = false;
    } else {
      addLog('✅ 조건 만족', 'success');
    }
    addLog('', 'info');

    // 7. 중복/누락 수업 검증
    addLog('7️⃣ 중복/누락 수업 검증', 'info');
    const duplicateMissingViolations = this.validateDuplicateMissingClasses(addLog);
    if (duplicateMissingViolations.length > 0) {
      violations.push(...duplicateMissingViolations);
      isValid = false;
    } else {
      addLog('✅ 조건 만족', 'success');
    }
    addLog('', 'info');

    // 8. 고정 수업 검증
    addLog('8️⃣ 고정 수업 검증', 'info');
    const fixedClassViolations = this.validateFixedClasses(addLog);
    if (fixedClassViolations.length > 0) {
      violations.push(...fixedClassViolations);
      isValid = false;
    } else {
      addLog('✅ 조건 만족', 'success');
    }
    addLog('', 'info');

    // 최종 결과 출력
    addLog('📊 최종 검증 결과 요약', 'info');
    if (isValid) {
      addLog('🎉 모든 제약조건이 만족되었습니다!', 'success');
    } else {
      addLog(`❌ 총 ${violations.length}개의 제약조건 위반이 발견되었습니다.`, 'error');
      addLog('위반된 항목들:', 'error');
      violations.forEach((violation, index) => {
        addLog(`  ${index + 1}. ${violation}`, 'error');
      });
    }

    // 요약 정보 생성
    const summary = {
      totalClasses: Object.keys(this.schedule).length,
      totalTeachers: this.data.teachers?.length || 0,
      totalSubjects: this.data.subjects?.length || 0,
      totalViolations: violations.length,
      isValid,
      violations
    };

    return { isValid, violations, summary };
  }

  // 1. 교사별 수업 가능 시간 검증
  private validateTeacherAvailableTimes(addLog: (message: string, type?: string) => void): string[] {
    const violations: string[] = [];
    const teachers = this.data.teachers || [];
    const classIds = Object.keys(this.schedule);

    teachers.forEach(teacher => {
      if (!teacher.available_times || teacher.available_times.length === 0) {
        return; // available_times가 설정되지 않은 경우 검증 제외
      }

      classIds.forEach(classId => {
        DAYS.forEach(day => {
          if (this.schedule[classId] && this.schedule[classId][day]) {
            Object.entries(this.schedule[classId][day]).forEach(([periodStr, slot]) => {
              if (slot && slot.teachers.includes(teacher.id)) {
                const period = parseInt(periodStr);
                
                // 교사 가능 시간 확인
                const isAvailable = teacher.available_times!.some(([availableDay, availablePeriod]) => 
                  availableDay === day && availablePeriod === period
                );
                
                if (!isAvailable) {
                  const violation = `${teacher.name} 교사가 ${classId} ${day}요일 ${period}교시에 수업 중이지만, 해당 시간은 가능한 시간 목록에 없습니다.`;
                  violations.push(violation);
                  addLog(`❌ ${violation}`, 'error');
                }
              }
            });
          }
        });
      });
    });

    return violations;
  }

  // 2. 교사별 주간 수업 시수 검증
  private validateTeacherWeeklyHours(addLog: (message: string, type?: string) => void): string[] {
    const violations: string[] = [];
    const teachers = this.data.teachers || [];

    teachers.forEach(teacher => {
      const currentHours = this.teacherHours[teacher.name]?.current || 0;
      const maxHours = teacher.max_hours_per_week || teacher.maxHours || 22;
      
      if (currentHours > maxHours) {
        const violation = `${teacher.name} 교사 시수 초과: ${currentHours}시간 > ${maxHours}시간`;
        violations.push(violation);
        addLog(`❌ ${violation}`, 'error');
      }

      // 학급별 시수 제한 확인
      const classIds = Object.keys(this.schedule);
      classIds.forEach(classId => {
        const classKey = classId.replace(/(\d+)학년_(\d+)반/, '$1학년-$2');
        const classHoursLimit = teacher.weeklyHoursByGrade?.[classKey] || 0;
        const currentClassHours = this.countTeacherHoursInClass(teacher.id, classId);
        
        if (classHoursLimit > 0 && currentClassHours > classHoursLimit) {
          const violation = `${teacher.name} 교사 ${classId} 학급 시수 초과: ${currentClassHours}시간 > ${classHoursLimit}시간`;
          violations.push(violation);
          addLog(`❌ ${violation}`, 'error');
        }
      });
    });

    return violations;
  }

  // 3. 학급별 주간 수업 시수 검증
  private validateClassWeeklyHours(addLog: (message: string, type?: string) => void): string[] {
    const violations: string[] = [];
    const classIds = Object.keys(this.schedule);

    classIds.forEach(classId => {
      const classData = this.data.classes.find(c => c.id === classId);
      if (!classData) return;

      let currentHours = 0;
      DAYS.forEach(day => {
        if (this.schedule[classId] && this.schedule[classId][day]) {
          Object.values(this.schedule[classId][day]).forEach(slot => {
            if (slot) {
              currentHours++;
            }
          });
        }
      });
      
      if (currentHours > classData.weekly_hours) {
        const violation = `${classData.name} 학급 주간 수업 시수 초과: ${currentHours}시간 > ${classData.weekly_hours}시간`;
        violations.push(violation);
        addLog(`❌ ${violation}`, 'error');
      }
    });

    return violations;
  }

  // 4. 블록제 수업 연속 배정 검증
  private validateBlockPeriodPlacements(addLog: (message: string, type?: string) => void): string[] {
    const violations: string[] = [];
    const classIds = Object.keys(this.schedule);
    
    classIds.forEach(classId => {
      DAYS.forEach(day => {
        if (this.schedule[classId] && this.schedule[classId][day]) {
          const periods = Object.keys(this.schedule[classId][day]).map(p => parseInt(p)).sort((a, b) => a - b);
          
          for (let i = 0; i < periods.length - 1; i++) {
            const currentPeriod = periods[i];
            const nextPeriod = periods[i + 1];
            
            const currentSlot = this.schedule[classId][day][currentPeriod];
            const nextSlot = this.schedule[classId][day][nextPeriod];
            
            if (currentSlot && nextSlot && 
                currentSlot.subject === nextSlot.subject &&
                currentSlot.isBlockPeriod && nextSlot.isBlockPeriod) {
              
              // 블록제 수업이 연속되지 않은 경우
              if (nextPeriod !== currentPeriod + 1) {
                const subject = this.data.subjects.find(s => s.id === currentSlot.subject);
                const violation = `${classId} ${day}요일 ${currentPeriod}교시와 ${nextPeriod}교시에 ${subject?.name || currentSlot.subject} 블록제 수업이 배정되었지만 연속되지 않습니다.`;
                violations.push(violation);
                addLog(`❌ ${violation}`, 'error');
              }
            }
          }
        }
      });
    });

    return violations;
  }

  // 5. 공동수업 조건 검증
  private validateCoTeachingConditions(addLog: (message: string, type?: string) => void): string[] {
    const violations: string[] = [];
    const coTeachingConstraints = this.data.constraints?.must?.filter(c => c.type === 'specific_teacher_co_teaching') || [];

    if (coTeachingConstraints.length === 0) {
      return violations;
    }

    coTeachingConstraints.forEach(constraint => {
      const { mainTeacher, coTeachers, subject } = constraint;
      
      if (!mainTeacher || !coTeachers || coTeachers.length === 0) {
        return;
      }

      const classIds = Object.keys(this.schedule);
      let mainTeacherFound = false;
      let coTeachingValid = false;

      classIds.forEach(classId => {
        DAYS.forEach(day => {
          if (this.schedule[classId] && this.schedule[classId][day]) {
            Object.entries(this.schedule[classId][day]).forEach(([periodStr, slot]) => {
              if (slot && slot.teachers.includes(mainTeacher) && (!subject || slot.subject === subject)) {
                mainTeacherFound = true;
                
                // 부교사가 함께 배정되었는지 확인
                const hasCoTeacher = coTeachers.some(coTeacher => slot.teachers.includes(coTeacher));
                if (hasCoTeacher) {
                  coTeachingValid = true;
                }
              }
            });
          }
        });
      });

      if (mainTeacherFound && !coTeachingValid) {
        const violation = `${mainTeacher} 교사의 ${subject || '수업'}에 공동수업 부교사(${coTeachers.join(', ')})가 배정되지 않았습니다.`;
        violations.push(violation);
        addLog(`❌ ${violation}`, 'error');
      }
    });

    return violations;
  }

  // 6. 교사 동시 배정 검증
  private validateTeacherSimultaneousAssignment(addLog: (message: string, type?: string) => void): string[] {
    const violations: string[] = [];
    const teachers = this.data.teachers || [];

    teachers.forEach(teacher => {
      const teacherSlots: { day: string; period: number; classId: string }[] = [];
      
      const classIds = Object.keys(this.schedule);
      classIds.forEach(classId => {
        DAYS.forEach(day => {
          if (this.schedule[classId] && this.schedule[classId][day]) {
            Object.entries(this.schedule[classId][day]).forEach(([periodStr, slot]) => {
              if (slot && slot.teachers.includes(teacher.id)) {
                teacherSlots.push({
                  day,
                  period: parseInt(periodStr),
                  classId
                });
              }
            });
          }
        });
      });

      // 같은 시간에 여러 학급에서 수업하는지 확인
      const timeSlots = new Map<string, string[]>();
      teacherSlots.forEach(slot => {
        const timeKey = `${slot.day}-${slot.period}`;
        if (!timeSlots.has(timeKey)) {
          timeSlots.set(timeKey, []);
        }
        timeSlots.get(timeKey)!.push(slot.classId);
      });

      timeSlots.forEach((classes, timeKey) => {
        if (classes.length > 1) {
          const [day, period] = timeKey.split('-');
          const violation = `${teacher.name} 교사가 ${day}요일 ${period}교시에 ${classes.join(', ')}에서 동시에 수업 중입니다.`;
          violations.push(violation);
          addLog(`❌ ${violation}`, 'error');
        }
      });
    });

    return violations;
  }

  // 7. 중복/누락 수업 검증
  private validateDuplicateMissingClasses(addLog: (message: string, type?: string) => void): string[] {
    const violations: string[] = [];
    const subjects = this.data.subjects || [];
    const classIds = Object.keys(this.schedule);

    classIds.forEach(classId => {
      const classData = this.data.classes.find(c => c.id === classId);
      if (!classData) return;

      const subjectCounts: Record<string, number> = {};
      
      DAYS.forEach(day => {
        if (this.schedule[classId] && this.schedule[classId][day]) {
          Object.values(this.schedule[classId][day]).forEach(slot => {
            if (slot) {
              subjectCounts[slot.subject] = (subjectCounts[slot.subject] || 0) + 1;
            }
          });
        }
      });

      // 과목별 목표 시수와 비교
      subjects.forEach(subject => {
        const targetHours = subject.weekly_hours || 1;
        const actualHours = subjectCounts[subject.id] || 0;
        
        if (actualHours > targetHours) {
          const violation = `${classData.name} ${subject.name} 과목 중복 배정: ${actualHours}시간 > ${targetHours}시간`;
          violations.push(violation);
          addLog(`❌ ${violation}`, 'error');
        } else if (actualHours < targetHours) {
          const violation = `${classData.name} ${subject.name} 과목 누락: ${actualHours}시간 < ${targetHours}시간`;
          violations.push(violation);
          addLog(`❌ ${violation}`, 'error');
        }
      });
    });

    return violations;
  }

  // 8. 고정 수업 검증
  private validateFixedClasses(addLog: (message: string, type?: string) => void): string[] {
    const violations: string[] = [];

    this.data.fixedClasses.forEach(fixedClass => {
      const classId = fixedClass.className || `${fixedClass.grade}학년_${fixedClass.class}반`;
      
      if (this.schedule[classId] && 
          this.schedule[classId][fixedClass.day] && 
          this.schedule[classId][fixedClass.day][fixedClass.period]) {
        
        const slot = this.schedule[classId][fixedClass.day][fixedClass.period];
        
        if (!slot || slot.subject !== fixedClass.subject || !slot.isFixed) {
          const violation = `${classId} ${fixedClass.day}요일 ${fixedClass.period}교시에 고정 수업 ${fixedClass.subject}이 올바르게 배정되지 않았습니다.`;
          violations.push(violation);
          addLog(`❌ ${violation}`, 'error');
        }
      } else {
        const violation = `${classId} ${fixedClass.day}요일 ${fixedClass.period}교시에 고정 수업 ${fixedClass.subject}이 배정되지 않았습니다.`;
        violations.push(violation);
        addLog(`❌ ${violation}`, 'error');
      }
    });

    return violations;
  }

  // 교사별 학급 시수 계산 헬퍼 함수
  private countTeacherHoursInClass(teacherId: string, classId: string): number {
    let count = 0;
    
    DAYS.forEach(day => {
      if (this.schedule[classId] && this.schedule[classId][day]) {
        Object.values(this.schedule[classId][day]).forEach(slot => {
          if (slot && slot.teachers.includes(teacherId)) {
            count++;
          }
        });
      }
    });

    return count;
  }
}