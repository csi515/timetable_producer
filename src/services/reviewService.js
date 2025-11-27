import { ISSUE_TYPES, DEFAULT_VALUES, CONSTRAINT_TYPES } from '../constants/reviewConstants';
import { safeArray, safeObject, safeNumber, createDefaultReviewData } from '../utils/reviewUtils';

/**
 * 검토 관련 비즈니스 로직 서비스
 */

/**
 * 학급별 시수 계산
 * @param {Object} data - 입력 데이터
 * @returns {Object.<string, Object>}
 */
export const calculateClassHours = (data) => {
  const classHours = {};
  const { base, fixedClasses } = data;

  // 학급별 시수 초기화
  for (let grade = 1; grade <= safeNumber(base?.grades, DEFAULT_VALUES.DEFAULT_GRADES); grade++) {
    const classCount = safeNumber(base?.classes_per_grade?.[grade - 1], 0);
    for (let classNum = 1; classNum <= classCount; classNum++) {
      const className = `${grade}학년 ${classNum}반`;
      classHours[className] = {
        totalHours: 0,
        subjects: {}
      };
    }
  }

  // 고정 수업으로부터 시수 계산
  safeArray(fixedClasses).forEach(fixedClass => {
    const className = `${fixedClass.grade}학년 ${fixedClass.class}반`;
    
    if (classHours[className]) {
      classHours[className].totalHours++;
      const subject = fixedClass.subject;
      classHours[className].subjects[subject] = 
        (classHours[className].subjects[subject] || 0) + 1;
    }
  });

  return classHours;
};

/**
 * 교사별 시수 계산
 * @param {Object} data - 입력 데이터
 * @returns {Object.<string, Object>}
 */
export const calculateTeacherHours = (data) => {
  const teacherHours = {};
  const { teachers, fixedClasses, constraints } = data;

  // 교사별 시수 초기화
  safeArray(teachers).forEach(teacher => {
    if (!teacher || !teacher.name) return; // teacher가 없거나 name이 없으면 건너뛰기
    
    const weeklyHoursSum = Object.values(safeObject(teacher.weeklyHoursByGrade)).reduce(
      (sum, hours) => sum + safeNumber(hours), 0
    );
    
    teacherHours[teacher.name] = {
      totalHours: 0,
      subjects: {},
      weeklyHours: safeNumber(teacher.maxHours, DEFAULT_VALUES.WEEKLY_HOURS),
      weeklyHoursByGrade: safeObject(teacher.weeklyHoursByGrade),
      weeklyHoursSum,
      allowParallel: Boolean(teacher.allow_parallel)
    };
  });

  // 고정 수업으로부터 시수 계산
  safeArray(fixedClasses).forEach(fixedClass => {
    const teacherName = fixedClass.teacher;
    
    if (teacherHours[teacherName]) {
      teacherHours[teacherName].totalHours++;
      const subject = fixedClass.subject;
      teacherHours[teacherName].subjects[subject] = 
        (teacherHours[teacherName].subjects[subject] || 0) + 1;
    }
  });

  // 공동 수업 제약 조건으로부터 시수 계산 (개선된 버전)
  const coTeachingConstraints = safeArray(constraints?.must).filter(c => 
    c.type === CONSTRAINT_TYPES.CO_TEACHING_REQUIREMENT || 
    c.type === CONSTRAINT_TYPES.SPECIFIC_TEACHER_CO_TEACHING
  );

  coTeachingConstraints.forEach(constraint => {
    if (constraint.mainTeacher && safeArray(constraint.coTeachers).length > 0) {
      const subject = constraint.subject || '공동수업';
      const mainTeacher = teachers.find(t => t.name === constraint.mainTeacher);
      
      if (mainTeacher) {
        const mainTeacherWeeklyHours = mainTeacher.weeklyHours || mainTeacher.maxHours || 25;
        const maxTeachersPerClass = constraint.maxTeachersPerClass || 2;
        const coTeachersCount = safeArray(constraint.coTeachers).length;
        
        // 주교사는 모든 수업에 참여
        if (teacherHours[constraint.mainTeacher]) {
          teacherHours[constraint.mainTeacher].totalHours += mainTeacherWeeklyHours;
          teacherHours[constraint.mainTeacher].subjects[subject] = 
            (teacherHours[constraint.mainTeacher].subjects[subject] || 0) + mainTeacherWeeklyHours;
        }
        
        // 부교사들은 최대 교사 수 제한에 따라 나누어서 참여
        const maxCoTeachersPerClass = maxTeachersPerClass - 1; // 주교사 제외
        const totalCoTeachingSlots = mainTeacherWeeklyHours;
        
        // 부교사별 참여 시간 계산
        constraint.coTeachers.forEach((coTeacherName, index) => {
          if (teacherHours[coTeacherName]) {
            // 부교사들이 순환하면서 참여하는 시간 계산
            const participationRate = Math.min(1, maxCoTeachersPerClass / coTeachersCount);
            const coTeacherHours = Math.floor(totalCoTeachingSlots * participationRate);
            
            teacherHours[coTeacherName].totalHours += coTeacherHours;
            teacherHours[coTeacherName].subjects[subject] = 
              (teacherHours[coTeacherName].subjects[subject] || 0) + coTeacherHours;
          }
        });
      }
    }
  });

  return teacherHours;
};

/**
 * 공동 수업 목록 생성
 * @param {Object} data - 입력 데이터
 * @returns {Array}
 */
export const calculateCoTeachingClasses = (data) => {
  const coTeachingClasses = [];
  const { fixedClasses, constraints, teachers } = data;

  // 1. 고정 수업에서 공동수업 찾기
  safeArray(fixedClasses).forEach(fixedClass => {
    if (!fixedClass || !fixedClass.originalData || 
        safeArray(fixedClass.originalData.coTeachers).length === 0) {
      return;
    }
    
    coTeachingClasses.push({
      className: `${fixedClass.grade || ''}학년 ${fixedClass.class || ''}반`,
      subject: fixedClass.subject || '',
      mainTeacher: fixedClass.teacher || '',
      coTeachers: safeArray(fixedClass.originalData.coTeachers)
        .map(ct => ct?.teacherName)
        .filter(name => name),
      day: fixedClass.day || '',
      period: fixedClass.period || 0,
      source: 'fixed_class'
    });
  });

  // 2. 제약 조건에서 공동수업 찾기
  const coTeachingConstraints = safeArray(constraints?.must).filter(c =>
    c.type === CONSTRAINT_TYPES.CO_TEACHING_REQUIREMENT ||
    c.type === CONSTRAINT_TYPES.SPECIFIC_TEACHER_CO_TEACHING
  );

  coTeachingConstraints.forEach((constraint, index) => {
    if (constraint.mainTeacher && safeArray(constraint.coTeachers).length > 0) {
      const mainTeacher = teachers.find(t => t.name === constraint.mainTeacher);
      const mainTeacherWeeklyHours = mainTeacher?.weeklyHours || mainTeacher?.maxHours || 25;
      const maxTeachersPerClass = constraint.maxTeachersPerClass || 2;
      const coTeachersCount = safeArray(constraint.coTeachers).length;
      
      coTeachingClasses.push({
        className: constraint.className || `제약조건 ${index + 1}`,
        subject: constraint.subject || '공동수업',
        mainTeacher: constraint.mainTeacher,
        coTeachers: safeArray(constraint.coTeachers)
          .map(ct => typeof ct === 'string' ? ct : ct?.teacherName)
          .filter(name => name),
        day: constraint.day || '',
        period: constraint.period || 0,
        source: 'constraint',
        constraintType: constraint.type,
        weeklyHours: mainTeacherWeeklyHours, // 주교사의 주간시수
        maxTeachersPerClass: maxTeachersPerClass, // 한 수업당 최대 교사 수
        description: `주교사 ${constraint.mainTeacher}의 주간시수(${mainTeacherWeeklyHours}시간)만큼 공동수업 배치, 최대 ${maxTeachersPerClass}명/수업, 부교사 ${coTeachersCount}명 순환 참여`
      });
    }
  });

  return coTeachingClasses;
};

/**
 * 이슈 검사 및 생성
 * @param {Object} classHours - 학급별 시수
 * @param {Object} teacherHours - 교사별 시수
 * @param {Object} data - 입력 데이터
 * @returns {Array}
 */
export const calculateIssues = (classHours, teacherHours, data) => {
  const issues = [];
  const { teachers } = data;

  // 학급별 시수 검사
  Object.entries(safeObject(classHours)).forEach(([className, hours]) => {
    const targetHours = DEFAULT_VALUES.WEEKLY_HOURS;
    const difference = safeNumber(hours.totalHours) - targetHours;
    
    if (Math.abs(difference) > DEFAULT_VALUES.HOURS_TOLERANCE) {
      issues.push({
        type: ISSUE_TYPES.CLASS_HOURS,
        className,
        current: hours.totalHours,
        target: targetHours,
        difference
      });
    }
  });

  // 교사별 시수 검사
  Object.entries(safeObject(teacherHours)).forEach(([teacherName, hours]) => {
    const difference = safeNumber(hours.totalHours) - safeNumber(hours.weeklyHours);
    
    if (difference > 0) {
      issues.push({
        type: ISSUE_TYPES.TEACHER_HOURS,
        teacherName,
        current: hours.totalHours,
        weekly: hours.weeklyHours,
        difference
      });
    }
  });

  // 교사별 시수 불일치 검사
  safeArray(teachers).forEach(teacher => {
    if (!teacher || !teacher.name) return; // teacher가 없거나 name이 없으면 건너뛰기
    
    const actualHours = safeNumber(teacherHours[teacher.name]?.totalHours);
    const expectedHours = safeNumber(teacher.maxHours);
    const difference = actualHours - expectedHours;
    
    if (Math.abs(difference) > DEFAULT_VALUES.HOURS_TOLERANCE) {
      issues.push({
        type: ISSUE_TYPES.TEACHER_HOURS_MISMATCH,
        teacherName: teacher.name,
        actual: actualHours,
        expected: expectedHours,
        difference
      });
    }
  });

  // 과목별 시수 불균형 검사
  const subjectComparison = {};
  
  // 학급별 과목 시수 계산
  Object.values(safeObject(classHours)).forEach(classHour => {
    Object.entries(safeObject(classHour.subjects)).forEach(([subject, hours]) => {
      if (!subjectComparison[subject]) {
        subjectComparison[subject] = { classHours: 0, teacherHours: 0 };
      }
      subjectComparison[subject].classHours += safeNumber(hours);
    });
  });

  // 교사별 과목 시수 계산
  Object.entries(safeObject(teacherHours)).forEach(([teacherName, hours]) => {
    Object.entries(safeObject(hours.subjects)).forEach(([subject, hours]) => {
      if (!subjectComparison[subject]) {
        subjectComparison[subject] = { classHours: 0, teacherHours: 0 };
      }
      subjectComparison[subject].teacherHours += safeNumber(hours);
    });
  });

  // 과목별 시수 불균형 검사
  Object.entries(subjectComparison).forEach(([subject, comparison]) => {
    const difference = comparison.classHours - comparison.teacherHours;
    if (Math.abs(difference) > DEFAULT_VALUES.HOURS_TOLERANCE) {
      issues.push({
        type: ISSUE_TYPES.SUBJECT_BALANCE,
        subject,
        classHours: comparison.classHours,
        teacherHours: comparison.teacherHours,
        difference
      });
    }
  });

  return issues;
};

/**
 * 교사 시수 검증 데이터 계산 (공동수업 고려)
 * @param {Object} data - 입력 데이터
 * @param {Object} teacherHours - 교사별 시수 데이터
 * @returns {Object}
 */
export const calculateTeacherHoursValidation = (data, teacherHours) => {
  if (!data || !teacherHours) {
    return { isValid: true, issues: [], teacherDetails: {} };
  }

  const teachers = data.teachers || [];
  const issues = [];
  const teacherDetails = {};

  teachers.forEach(teacher => {
    const teacherName = teacher.name;
    const teacherData = teacherHours[teacherName];
    
    if (!teacherData) return;

    // 실제 시수 (teacherHours에서 계산)
    const actualTotalHours = teacherData.totalHours || 0;
    
    // 요구 시수 계산
    let requiredTotalHours = 0;
    const teacherSubjects = teacher.subjects || [];
    
    teacherSubjects.forEach(subjectName => {
      const subject = data.subjects?.find(s => s.name === subjectName);
      if (!subject) return;
      
      // 학급별 요구 시수 계산
      const base = data.base;
      for (let grade = 1; grade <= (base?.grades || 0); grade++) {
        const classCount = base?.classes_per_grade?.[grade - 1] || 0;
        for (let classNum = 1; classNum <= classCount; classNum++) {
          const className = `${grade}학년 ${classNum}반`;
          const classKey = `${grade}학년`;
          
          let teacherClassHours = 0;
          
          // 교사별 학급 시수 설정 확인
          if (teacher.weeklyHoursByGrade && teacher.weeklyHoursByGrade[classKey] !== undefined) {
            teacherClassHours = teacher.weeklyHoursByGrade[classKey];
          }
          else if (teacher.classWeeklyHours && teacher.classWeeklyHours[className] !== undefined) {
            teacherClassHours = teacher.classWeeklyHours[className];
          }
          else {
            teacherClassHours = subject.weekly_hours || 1;
          }
          
          requiredTotalHours += teacherClassHours;
        }
      }
    });

    // 공동수업 조정 계산 (간단한 버전)
    const coTeachingAdjustments = {};
    const coTeachingConstraints = data.constraints?.must?.filter(c => 
      c.type === CONSTRAINT_TYPES.CO_TEACHING_REQUIREMENT || c.type === CONSTRAINT_TYPES.SPECIFIC_TEACHER_CO_TEACHING
    ) || [];

    coTeachingConstraints.forEach(constraint => {
      if (constraint.mainTeacher === teacherName || 
          (constraint.coTeachers && constraint.coTeachers.includes(teacherName))) {
        const className = constraint.className || '공동수업';
        const adjustment = constraint.weeklyHours || 1;
        coTeachingAdjustments[className] = (coTeachingAdjustments[className] || 0) + adjustment;
        requiredTotalHours += adjustment;
      }
    });

    // 시수 차이 계산
    const totalDifference = actualTotalHours - requiredTotalHours;
    const isTotalHoursMatch = Math.abs(totalDifference) <= DEFAULT_VALUES.HOURS_TOLERANCE;

    if (!isTotalHoursMatch) {
      issues.push({
        type: 'TEACHER_HOURS_MISMATCH',
        teacherName: teacherName,
        actual: actualTotalHours,
        expected: requiredTotalHours,
        difference: totalDifference,
        message: `${teacherName}: 총 시수 불일치 (실제: ${actualTotalHours}시간, 요구: ${requiredTotalHours}시간, 차이: ${totalDifference}시간)`
      });
    }

    // 학급별 상세 분석 계산
    const classBreakdown = {};
    teacherSubjects.forEach(subjectName => {
      const subject = data.subjects?.find(s => s.name === subjectName);
      if (!subject) return;
      
      const base = data.base;
      for (let grade = 1; grade <= (base?.grades || 0); grade++) {
        const classCount = base?.classes_per_grade?.[grade - 1] || 0;
        for (let classNum = 1; classNum <= classCount; classNum++) {
          const className = `${grade}학년 ${classNum}반`;
          const classKey = `${grade}학년`;
          
          let teacherClassHours = 0;
          
          // 교사별 학급 시수 설정 확인
          if (teacher.weeklyHoursByGrade && teacher.weeklyHoursByGrade[classKey] !== undefined) {
            teacherClassHours = teacher.weeklyHoursByGrade[classKey];
          }
          else if (teacher.classWeeklyHours && teacher.classWeeklyHours[className] !== undefined) {
            teacherClassHours = teacher.classWeeklyHours[className];
          }
          else {
            teacherClassHours = subject.weekly_hours || 1;
          }
          
          // 실제 시수는 간단히 요구 시수와 동일하게 설정 (실제로는 더 복잡한 계산 필요)
          const actualHours = teacherClassHours;
          const requiredHours = teacherClassHours;
          const difference = actualHours - requiredHours;
          
          classBreakdown[className] = {
            actual: actualHours,
            required: requiredHours,
            difference: difference
          };
        }
      }
    });

    // 교사별 상세 정보 저장
    teacherDetails[teacherName] = {
      actualTotalHours,
      requiredTotalHours,
      totalDifference,
      classBreakdown,
      coTeachingAdjustments
    };
  });

  return {
    isValid: issues.length === 0,
    issues,
    teacherDetails
  };
};

/**
 * 전체 검토 데이터 계산
 * @param {Object} data - 입력 데이터
 * @returns {Object}
 */
export const calculateReviewData = (data) => {
  if (!data) {
    return createDefaultReviewData();
  }

  const classHours = calculateClassHours(data);
  const teacherHours = calculateTeacherHours(data);
  const coTeachingClasses = calculateCoTeachingClasses(data);
  const issues = calculateIssues(classHours, teacherHours, data);
  const teacherHoursValidation = calculateTeacherHoursValidation(data, teacherHours);

  return {
    classHours,
    teacherHours,
    coTeachingClasses,
    issues,
    teacherHoursValidation
  };
}; 