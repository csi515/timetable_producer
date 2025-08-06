import { Schedule, TimetableData, Teacher, ValidationResult } from '../types';
import { DAYS, getCurrentSubjectHours, getCurrentTeacherHours, convertClassNameToKey } from '../utils/helpers';
import { 
  checkTeacherTimeConflict, 
  checkTeacherUnavailable, 
  checkTeacherClassHoursLimit, 
  checkClassWeeklyHoursLimit,
  validateCoTeachingConstraints,
  validateBlockPeriodConstraints,
  validateTeacherMutualExclusions,
  validateSequentialGradeTeaching,
  validateTeacherConsecutiveTeaching
} from './constraints';

export interface ConstraintViolation {
  type: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  message: string;
  details?: any;
  className?: string;
  teacher?: string;
  subject?: string;
  day?: string;
  period?: number;
}

export interface ValidationReport {
  isValid: boolean;
  violations: ConstraintViolation[];
  summary: {
    totalViolations: number;
    criticalViolations: number;
    highViolations: number;
    mediumViolations: number;
    lowViolations: number;
  };
}

// 종합적인 제약조건 검증 함수 (강화된 버전)
export const validateTimetableConstraints = (
  schedule: Schedule,
  data: TimetableData,
  addLog: (message: string, type?: string) => void
): ValidationReport => {
  const violations: ConstraintViolation[] = [];
  
  addLog('🔍 강화된 종합적인 제약조건 검증을 시작합니다.', 'info');
  
  // 1. 교사 중복 배정 검증 (CRITICAL)
  addLog('📋 교사 중복 배정 검증 중...', 'info');
  const teacherConflicts = validateTeacherConflicts(schedule, data);
  violations.push(...teacherConflicts);
  
  // 2. 교사 불가능 시간 위반 검증 (CRITICAL)
  addLog('📋 교사 불가능 시간 검증 중...', 'info');
  const unavailableViolations = validateTeacherUnavailableTimes(schedule, data);
  violations.push(...unavailableViolations);
  
  // 3. 교사 상호 배제 관계 검증 (CRITICAL) - 강화된 검증
  addLog('📋 교사 상호 배제 관계 검증 중...', 'info');
  const mutualExclusionViolations = validateTeacherMutualExclusionsStrict(schedule, data);
  violations.push(...mutualExclusionViolations);
  
  // 4. 교사 학급별 배정 제약조건 검증 (CRITICAL) - 강화된 검증
  addLog('📋 교사 학급별 배정 제약조건 검증 중...', 'info');
  const classAssignmentViolations = validateTeacherClassAssignments(schedule, data);
  violations.push(...classAssignmentViolations);
  
  // 5. 교사 시수 제한 검증 (HIGH)
  addLog('📋 교사 시수 제한 검증 중...', 'info');
  const teacherHoursViolations = validateTeacherHoursLimits(schedule, data);
  violations.push(...teacherHoursViolations);
  
  // 6. 학급별 시수 제한 검증 (HIGH)
  addLog('📋 학급별 시수 제한 검증 중...', 'info');
  const classHoursViolations = validateClassHoursLimits(schedule, data);
  violations.push(...classHoursViolations);
  
  // 7. 특별실 충돌 검증 (HIGH)
  addLog('📋 특별실 충돌 검증 중...', 'info');
  const specialRoomViolations = validateSpecialRoomConflicts(schedule, data);
  violations.push(...specialRoomViolations);
  
  // 8. 공동수업 제약조건 검증 (MEDIUM)
  addLog('📋 공동수업 제약조건 검증 중...', 'info');
  const coTeachingValid = validateCoTeachingConstraints(schedule, data, addLog);
  if (!coTeachingValid) {
    violations.push({
      type: 'medium',
      category: 'co_teaching',
      message: '공동수업 제약조건 위반'
    });
  }
  
  // 9. 블록제 수업 제약조건 검증 (MEDIUM)
  addLog('📋 블록제 수업 제약조건 검증 중...', 'info');
  const blockPeriodValid = validateBlockPeriodConstraints(schedule, data, addLog);
  if (!blockPeriodValid) {
    violations.push({
      type: 'medium',
      category: 'block_period',
      message: '블록제 수업 제약조건 위반'
    });
  }
  
  // 10. 교사 간 동시 수업 제약조건 검증 (MEDIUM)
  addLog('📋 교사 간 동시 수업 제약조건 검증 중...', 'info');
  const mutualExclusionValid = validateTeacherMutualExclusions(schedule, data, addLog);
  if (!mutualExclusionValid) {
    violations.push({
      type: 'medium',
      category: 'teacher_mutual_exclusion',
      message: '교사 간 동시 수업 제약조건 위반'
    });
  }
  
  // 11. 학년별 순차 수업 제약조건 검증 (MEDIUM)
  addLog('📋 학년별 순차 수업 제약조건 검증 중...', 'info');
  const sequentialTeachingValid = validateSequentialGradeTeaching(schedule, data, addLog);
  if (!sequentialTeachingValid) {
    violations.push({
      type: 'medium',
      category: 'sequential_grade_teaching',
      message: '학년별 순차 수업 제약조건 위반'
    });
  }
  
  // 12. 과목별 시수 검증 (LOW)
  addLog('📋 과목별 시수 검증 중...', 'info');
  const subjectHoursViolations = validateSubjectHours(schedule, data);
  violations.push(...subjectHoursViolations);
  
  // 13. 교사 3연속 수업 제약조건 검증 (HIGH)
  addLog('📋 교사 3연속 수업 제약조건 검증 중...', 'info');
  const consecutiveTeachingValid = validateTeacherConsecutiveTeaching(schedule, data, addLog);
  if (!consecutiveTeachingValid) {
    violations.push({
      type: 'high',
      category: 'teacher_consecutive_teaching',
      message: '교사 3연속 수업 제약조건 위반'
    });
  }
  
  // 검증 결과 요약
  const criticalViolations = violations.filter(v => v.type === 'critical');
  const highViolations = violations.filter(v => v.type === 'high');
  const mediumViolations = violations.filter(v => v.type === 'medium');
  const lowViolations = violations.filter(v => v.type === 'low');
  
  const summary = {
    totalViolations: violations.length,
    criticalViolations: criticalViolations.length,
    highViolations: highViolations.length,
    mediumViolations: mediumViolations.length,
    lowViolations: lowViolations.length
  };
  
  // 검증 결과 로그
  addLog(`📊 강화된 제약조건 검증 완료:`, 'info');
  addLog(`   - 치명적 위반: ${summary.criticalViolations}건`, summary.criticalViolations > 0 ? 'error' : 'info');
  addLog(`   - 높은 위반: ${summary.highViolations}건`, summary.highViolations > 0 ? 'error' : 'info');
  addLog(`   - 중간 위반: ${summary.mediumViolations}건`, summary.mediumViolations > 0 ? 'warning' : 'info');
  addLog(`   - 낮은 위반: ${summary.lowViolations}건`, summary.lowViolations > 0 ? 'warning' : 'info');
  
  if (summary.criticalViolations > 0) {
    addLog(`❌ 치명적 위반이 발견되어 시간표가 유효하지 않습니다.`, 'error');
  } else if (summary.highViolations > 0) {
    addLog(`⚠️ 높은 우선순위 위반이 발견되어 시간표 품질이 저하될 수 있습니다.`, 'warning');
  } else if (summary.mediumViolations > 0) {
    addLog(`ℹ️ 중간 우선순위 위반이 발견되었지만 시간표는 사용 가능합니다.`, 'info');
  } else {
    addLog(`✅ 모든 제약조건을 만족하는 완벽한 시간표입니다.`, 'success');
  }
  
  return {
    isValid: summary.criticalViolations === 0,
    violations,
    summary
  };
};

// 교사 중복 배정 검증
const validateTeacherConflicts = (schedule: Schedule, data: TimetableData): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];
  
  DAYS.forEach(day => {
    const maxPeriods = data.base?.periods_per_day?.[day] || 7;
    
    for (let period = 1; period <= maxPeriods; period++) {
      const slotIndex = period - 1;
      const teacherSlots: Record<string, string[]> = {}; // 교사별 배정된 학급들
      
      Object.keys(schedule).forEach(className => {
        if (schedule[className]?.[day]?.[slotIndex]) {
          const slot = schedule[className][day][slotIndex];
          
          if (slot && typeof slot === 'object' && 'teachers' in slot && Array.isArray(slot.teachers)) {
            slot.teachers.forEach(teacherName => {
              if (!teacherSlots[teacherName]) {
                teacherSlots[teacherName] = [];
              }
              teacherSlots[teacherName].push(className);
            });
          }
        }
      });
      
      // 중복 배정 확인
      Object.entries(teacherSlots).forEach(([teacherName, classes]) => {
        if (classes.length > 1) {
          violations.push({
            type: 'critical',
            category: 'teacher_conflict',
            message: `${teacherName} 교사가 ${day}요일 ${period}교시에 ${classes.length}개 학급에 중복 배정됨`,
            teacher: teacherName,
            day: day,
            period: period,
            details: { classes }
          });
        }
      });
    }
  });
  
  return violations;
};

// 교사 불가능 시간 위반 검증
const validateTeacherUnavailableTimes = (schedule: Schedule, data: TimetableData): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];
  
  data.teachers?.forEach(teacher => {
    if (teacher.unavailable && Array.isArray(teacher.unavailable)) {
      teacher.unavailable.forEach(([unavailableDay, unavailablePeriod]) => {
        Object.keys(schedule).forEach(className => {
          const slotIndex = unavailablePeriod - 1;
          const slot = schedule[className]?.[unavailableDay]?.[slotIndex];
          
          if (slot && typeof slot === 'object' && 'teachers' in slot && slot.teachers.includes(teacher.name)) {
            violations.push({
              type: 'critical',
              category: 'teacher_unavailable',
              message: `${teacher.name} 교사가 불가능 시간에 수업 배정됨`,
              teacher: teacher.name,
              className: className,
              day: unavailableDay,
              period: unavailablePeriod,
              subject: slot.subject
            });
          }
        });
      });
    }
  });
  
  return violations;
};

// 교사 상호 배제 관계 검증 (강화된 버전)
const validateTeacherMutualExclusionsStrict = (schedule: Schedule, data: TimetableData): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];
  
  // 상호 배제 제약조건이 있는 교사들 찾기
  const teachersWithExclusions = data.teachers?.filter(t => t.mutual_exclusions && t.mutual_exclusions.length > 0) || [];
  
  teachersWithExclusions.forEach(teacher => {
    Object.keys(schedule).forEach(className => {
      DAYS.forEach(day => {
        const maxPeriods = data.base?.periods_per_day?.[day] || 7;
        
        for (let period = 1; period <= maxPeriods; period++) {
          const slotIndex = period - 1;
          const slot = schedule[className]?.[day]?.[slotIndex];
          
          if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.includes(teacher.name)) {
            // 이 교사가 수업하는 시간에 상호 배제 교사들이 다른 학급에서 수업하는지 확인
            for (const otherClassName of Object.keys(schedule)) {
              if (otherClassName === className) continue; // 같은 학급은 제외
              
              const otherSlot = schedule[otherClassName]?.[day]?.[slotIndex];
              if (otherSlot && typeof otherSlot === 'object' && otherSlot.teachers) {
                for (const otherTeacher of otherSlot.teachers) {
                  if (teacher.mutual_exclusions && teacher.mutual_exclusions.includes(otherTeacher)) {
                    violations.push({
                      type: 'critical',
                      category: 'teacher_mutual_exclusion',
                      message: `${teacher.name} 교사와 ${otherTeacher} 교사가 ${day}요일 ${period}교시에 동시 수업 중`,
                      details: {
                        teacher1: teacher.name,
                        teacher2: otherTeacher,
                        class1: className,
                        class2: otherClassName,
                        day,
                        period
                      },
                      className,
                      teacher: teacher.name,
                      day,
                      period
                    });
                  }
                }
              }
            }
          }
        }
      });
    });
  });
  
  return violations;
};

// 교사 학급별 배정 제약조건 검증 (강화된 버전)
const validateTeacherClassAssignments = (schedule: Schedule, data: TimetableData): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];
  
  data.teachers?.forEach(teacher => {
    Object.keys(schedule).forEach(className => {
      // 교사가 해당 학급에서 수업하는지 확인
      let hasClassAssignment = false;
      
      DAYS.forEach(day => {
        const maxPeriods = data.base?.periods_per_day?.[day] || 7;
        
        for (let period = 1; period <= maxPeriods; period++) {
          const slotIndex = period - 1;
          const slot = schedule[className]?.[day]?.[slotIndex];
          
          if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.includes(teacher.name)) {
            hasClassAssignment = true;
            
            // 학급별 배정 제약조건 확인 (0시간 설정된 학급)
            const classKey = convertClassNameToKey(className);
            const hasZeroHours = (teacher.classWeeklyHours && teacher.classWeeklyHours[className] === 0) ||
                                (teacher.weeklyHoursByGrade && teacher.weeklyHoursByGrade[classKey] === 0);
            
            if (hasZeroHours) {
              violations.push({
                type: 'critical',
                category: 'teacher_class_assignment',
                message: `${teacher.name} 교사는 ${className}에서 수업할 수 없도록 설정되어 있습니다.`,
                details: {
                  teacher: teacher.name,
                  className,
                  classWeeklyHours: teacher.classWeeklyHours?.[className],
                  weeklyHoursByGrade: teacher.weeklyHoursByGrade?.[classKey],
                  day,
                  period
                },
                className,
                teacher: teacher.name,
                day,
                period
              });
            }
          }
        }
      });
    });
  });
  
  return violations;
};

// 교사 시수 제한 검증
const validateTeacherHoursLimits = (schedule: Schedule, data: TimetableData): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];
  
  data.teachers?.forEach(teacher => {
    const currentHours = getCurrentTeacherHours(schedule, teacher.name);
    const maxHours = teacher.max_hours_per_week || teacher.maxHours || 22;
    
    if (currentHours > maxHours) {
      violations.push({
        type: 'high',
        category: 'teacher_hours_limit',
        message: `${teacher.name} 교사 시수 초과: ${currentHours}시간 > ${maxHours}시간`,
        teacher: teacher.name,
        details: { current: currentHours, max: maxHours }
      });
    }
    
    // 학급별 시수 제한 확인
    if (teacher.classWeeklyHours) {
      Object.keys(teacher.classWeeklyHours).forEach(className => {
        const classMaxHours = teacher.classWeeklyHours[className];
        const classCurrentHours = getCurrentTeacherHours(schedule, teacher.name, className);
        
        if (classCurrentHours > classMaxHours) {
          violations.push({
            type: 'high',
            category: 'teacher_class_hours_limit',
            message: `${teacher.name} 교사 ${className} 시수 초과: ${classCurrentHours}시간 > ${classMaxHours}시간`,
            teacher: teacher.name,
            className: className,
            details: { current: classCurrentHours, max: classMaxHours }
          });
        }
      });
    }
  });
  
  return violations;
};

// 학급별 시수 제한 검증
const validateClassHoursLimits = (schedule: Schedule, data: TimetableData): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];
  
  Object.keys(schedule).forEach(className => {
    const maxWeeklyHours = data.classWeeklyHours?.[className];
    
    if (maxWeeklyHours !== undefined && maxWeeklyHours !== null) {
      let currentHours = 0;
      
      DAYS.forEach(day => {
        if (schedule[className]?.[day]) {
          Object.values(schedule[className][day]).forEach((slot: any) => {
            if (slot && typeof slot === 'object' && 'subject' in slot && slot.subject) {
              currentHours++;
            }
          });
        }
      });
      
      if (currentHours > maxWeeklyHours) {
        violations.push({
          type: 'high',
          category: 'class_hours_limit',
          message: `${className} 주간 수업 시수 초과: ${currentHours}시간 > ${maxWeeklyHours}시간`,
          className: className,
          details: { current: currentHours, max: maxWeeklyHours }
        });
      }
    }
  });
  
  return violations;
};

// 특별실 충돌 검증
const validateSpecialRoomConflicts = (schedule: Schedule, data: TimetableData): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];
  
  DAYS.forEach(day => {
    const maxPeriods = data.base?.periods_per_day?.[day] || 7;
    
    for (let period = 1; period <= maxPeriods; period++) {
      const slotIndex = period - 1;
      const specialRoomSubjects: string[] = [];
      
      Object.keys(schedule).forEach(className => {
        const slot = schedule[className]?.[day]?.[slotIndex];
        
        if (slot && typeof slot === 'object' && 'subject' in slot) {
          const subject = data.subjects?.find(s => s.name === slot.subject);
          if (subject?.is_space_limited) {
            specialRoomSubjects.push(className);
          }
        }
      });
      
      if (specialRoomSubjects.length > 1) {
        violations.push({
          type: 'high',
          category: 'special_room_conflict',
          message: `${day}요일 ${period}교시에 특별실을 사용하는 과목이 ${specialRoomSubjects.length}개 학급에서 충돌`,
          day: day,
          period: period,
          details: { classes: specialRoomSubjects }
        });
      }
    }
  });
  
  return violations;
};

// 과목 시수 검증
const validateSubjectHours = (schedule: Schedule, data: TimetableData): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];
  
  data.subjects?.forEach(subject => {
    Object.keys(schedule).forEach(className => {
      const currentHours = getCurrentSubjectHours(schedule, className, subject.name);
      const targetHours = subject.weekly_hours || 1;
      
      if (currentHours !== targetHours) {
        violations.push({
          type: 'high',
          category: 'subject_hours_mismatch',
          message: `${className} ${subject.name} 시수 불일치: ${currentHours}시간 ≠ ${targetHours}시간`,
          className: className,
          subject: subject.name,
          details: { current: currentHours, target: targetHours }
        });
      }
    });
  });
  
  return violations;
}; 