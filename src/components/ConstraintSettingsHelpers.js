// 조건 타입 이름 가져오기
export const getConstraintTypeName = (type) => {
  const typeNames = {
    'block_period_requirement': '블록제 교사 지정',
    'co_teaching_requirement': '공동수업 요구사항',
    'class_daily_subject_once': '일일 과목 1회 제한',
    'teacher_unavailable_time': '교사 불가능 시간',
    'specific_teacher_co_teaching': '특정 교사 공동수업',
    'subject_fixed_only': '과목 고정 수업만',
    'class_max_periods': '학급 최대 교시 제한',
    'teacher_mutual_exclusion': '교사 상호 배타',
    'special_room_requirement': '특별실 요구사항',
    'special_room_capacity': '특별실 용량 제한',
    'special_room_availability': '특별실 사용 가능 시간',
    'special_room_class_limit': '학급별 특별실 사용 제한',
    'daily_subject_once': '일일 과목 한 번 제한',
    'teacher_time_conflict': '교사 시간 충돌 방지',
    'class_weekly_hours_limit': '학급 주간 시수 제한',
    'teacher_weekly_hours_limit': '교사 주간 시수 제한'
  };
  return typeNames[type] || type;
};

// 현재 조건 타입 가져오기
export const getCurrentConstraintType = () => {
  return '';
};

// 기본 조건 로드
export const loadDefaultConstraints = () => {
  return {
    must: [
      {
        id: 1,
        type: 'block_period_requirement',
        description: '블록제 교사 지정 예시',
        subject: '김교사',
        day: '월',
        period: 1
      }
    ],
    optional: [
      {
        id: 2,
        type: 'co_teaching_requirement',
        description: '공동수업 요구사항 예시',
        mainTeacher: '김교사',
        coTeachers: ['이교사', '박교사'],
        class: '1학년 1반'
      }
    ]
  };
};

// 조건 추가 함수
export const addConstraint = (constraints, newConstraint, priority, updateData) => {
  if (!newConstraint.type) {
    alert('조건 타입을 선택해주세요.');
    return;
  }

  // 필수 필드 검증
  const validationErrors = validateConstraint(newConstraint);
  if (validationErrors.length > 0) {
    alert(`다음 필드를 입력해주세요:\n${validationErrors.join('\n')}`);
    return;
  }

  const constraint = {
    id: Date.now(),
    ...newConstraint
  };

  const updatedConstraints = {
    ...constraints,
    [priority]: [...(constraints[priority] || []), constraint]
  };

  updateData('constraints', updatedConstraints);
  return updatedConstraints;
};

// 조건 삭제 함수
export const removeConstraint = (constraints, priority, index, updateData) => {
  const updatedConstraints = {
    ...constraints,
    [priority]: constraints[priority].filter((_, i) => i !== index)
  };
  updateData('constraints', updatedConstraints);
  return updatedConstraints;
};

// 조건 검증 함수
export const validateConstraint = (constraint) => {
  const errors = [];

  switch (constraint.type) {
    case 'block_period_requirement':
      if (!constraint.subject) errors.push('- 교사');
      if (!constraint.day) errors.push('- 요일');
      if (!constraint.period) errors.push('- 교시');
      break;

    case 'co_teaching_requirement':
      if (!constraint.mainTeacher) errors.push('- 주교사');
      if (!constraint.coTeachers) errors.push('- 부교사');
      if (!constraint.class) errors.push('- 학급');
      break;

    case 'class_daily_subject_once':
      if (!constraint.subject) errors.push('- 과목');
      break;

    case 'teacher_unavailable_time':
      if (!constraint.subject) errors.push('- 교사');
      if (!constraint.day) errors.push('- 요일');
      if (!constraint.period) errors.push('- 교시');
      break;

    case 'specific_teacher_co_teaching':
      if (!constraint.mainTeacher) errors.push('- 주교사');
      if (!constraint.coTeachers) errors.push('- 부교사');
      if (!constraint.subject) errors.push('- 과목');
      break;

    case 'subject_fixed_only':
      if (!constraint.subject) errors.push('- 과목');
      break;

    case 'class_max_periods':
      if (!constraint.class) errors.push('- 학급');
      if (!constraint.maxPeriods) errors.push('- 최대 교시 수');
      break;

    case 'teacher_mutual_exclusion':
      if (!constraint.teacher1) errors.push('- 교사 1');
      if (!constraint.teacher2) errors.push('- 교사 2');
      break;

    case 'special_room_requirement':
      if (!constraint.subject) errors.push('- 과목');
      break;

    case 'special_room_capacity':
      if (!constraint.roomType) errors.push('- 특별실 종류');
      if (!constraint.maxClasses) errors.push('- 최대 학급 수');
      break;

    case 'special_room_availability':
      if (!constraint.roomType) errors.push('- 특별실 종류');
      if (!constraint.restrictedDays && !constraint.restrictedPeriods) {
        errors.push('- 제한된 요일 또는 교시');
      }
      break;

    case 'special_room_class_limit':
      if (!constraint.className) errors.push('- 학급');
      if (!constraint.roomType) errors.push('- 특별실 종류');
      if (!constraint.maxConcurrent) errors.push('- 최대 동시 사용 학급 수');
      break;

    case 'daily_subject_once':
      if (!constraint.subject) errors.push('- 과목');
      break;

    case 'teacher_time_conflict':
      if (!constraint.teacher) errors.push('- 교사');
      break;

    case 'class_weekly_hours_limit':
      if (!constraint.class) errors.push('- 학급');
      if (!constraint.maxHours) errors.push('- 최대 시수');
      break;

    case 'teacher_weekly_hours_limit':
      if (!constraint.teacher) errors.push('- 교사');
      if (!constraint.maxHours) errors.push('- 최대 시수');
      break;

    default:
      errors.push('- 알 수 없는 제약조건 타입');
  }

  return errors;
};

// 조건 타입 목록
export const getConstraintTypes = () => {
  return [
    {
      value: 'block_period_requirement',
      label: '블록제 교사 지정',
      description: '특정 교사를 특정 시간에 고정 배치'
    },
    {
      value: 'co_teaching_requirement',
      label: '공동수업 요구사항',
      description: '주교사와 부교사가 함께 수업'
    },
    {
      value: 'class_daily_subject_once',
      label: '일일 과목 1회 제한',
      description: '하루에 같은 과목을 한 번만 배치'
    },
    {
      value: 'teacher_unavailable_time',
      label: '교사 불가능 시간',
      description: '특정 교사의 특정 시간 배치 금지'
    },
    {
      value: 'specific_teacher_co_teaching',
      label: '특정 교사 공동수업',
      description: '특정 교사가 반드시 공동수업에 참여'
    },
    {
      value: 'subject_fixed_only',
      label: '과목 고정 수업만',
      description: '특정 과목은 고정 수업으로만 배치'
    },
    {
      value: 'class_max_periods',
      label: '학급 최대 교시 제한',
      description: '특정 학급의 하루 최대 교시 수 제한'
    },
    {
      value: 'teacher_mutual_exclusion',
      label: '교사 상호 배타',
      description: '두 교사가 같은 시간에 수업할 수 없음'
    },
    {
      value: 'special_room_requirement',
      label: '특별실 요구사항',
      description: '특별실이 필요한 과목의 충돌 방지'
    },
    {
      value: 'special_room_capacity',
      label: '특별실 용량 제한',
      description: '특별실별 동시 사용 가능한 학급 수 제한'
    },
    {
      value: 'special_room_availability',
      label: '특별실 사용 가능 시간',
      description: '특별실별 사용 가능한 요일/교시 제한'
    },
    {
      value: 'special_room_class_limit',
      label: '학급별 특별실 사용 제한',
      description: '특정 학급의 특별실 동시 사용 제한'
    },
    {
      value: 'daily_subject_once',
      label: '일일 과목 한 번 제한',
      description: '하루에 같은 과목을 한 번만 배치 (전체 학급)'
    },
    {
      value: 'teacher_time_conflict',
      label: '교사 시간 충돌 방지',
      description: '교사가 같은 시간에 여러 학급에서 수업하는 것 방지'
    },
    {
      value: 'class_weekly_hours_limit',
      label: '학급 주간 시수 제한',
      description: '특정 학급의 주간 총 수업 시간 제한'
    },
    {
      value: 'teacher_weekly_hours_limit',
      label: '교사 주간 시수 제한',
      description: '특정 교사의 주간 총 수업 시간 제한'
    }
  ];
};

// 학급 목록 생성
export const generateClassList = (data) => {
  const classes = [];
  const grades = data.base?.grades || 3;
  const classesPerGrade = data.base?.classes_per_grade || [4, 4, 4];

  for (let grade = 1; grade <= grades; grade++) {
    const classCount = classesPerGrade[grade - 1] || 4;
    for (let classNum = 1; classNum <= classCount; classNum++) {
      classes.push(`${grade}학년 ${classNum}반`);
    }
  }

  return classes;
};

// 조건 데이터 검증
export const validateConstraintData = (constraints, subjects, teachers, classes) => {
  const errors = [];

  if (!constraints) return errors;

  ['must', 'optional'].forEach(priority => {
    if (constraints[priority]) {
      constraints[priority].forEach((constraint, index) => {
        // 과목 존재 여부 확인
        if (constraint.subject && constraint.type !== 'block_period_requirement' && constraint.type !== 'teacher_unavailable_time') {
          if (!subjects.find(s => s.name === constraint.subject)) {
            errors.push(`${priority} 조건 ${index + 1}: 존재하지 않는 과목 "${constraint.subject}"`);
          }
        }

        // 교사 존재 여부 확인
        if (constraint.subject && (constraint.type === 'block_period_requirement' || constraint.type === 'teacher_unavailable_time')) {
          if (!teachers.find(t => t.name === constraint.subject)) {
            errors.push(`${priority} 조건 ${index + 1}: 존재하지 않는 교사 "${constraint.subject}"`);
          }
        }

        if (constraint.mainTeacher) {
          if (!teachers.find(t => t.name === constraint.mainTeacher)) {
            errors.push(`${priority} 조건 ${index + 1}: 존재하지 않는 주교사 "${constraint.mainTeacher}"`);
          }
        }

        // 학급 존재 여부 확인
        if (constraint.class) {
          if (!classes.includes(constraint.class)) {
            errors.push(`${priority} 조건 ${index + 1}: 존재하지 않는 학급 "${constraint.class}"`);
          }
        }

        // 시간 범위 확인
        if (constraint.period && (constraint.period < 1 || constraint.period > 7)) {
          errors.push(`${priority} 조건 ${index + 1}: 교시 범위가 1-7을 벗어났습니다.`);
        }
      });
    }
  });

  return errors;
}; 