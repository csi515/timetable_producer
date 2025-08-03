export const ISSUE_TYPES = {
  CLASS_HOURS: 'class_hours',
  TEACHER_HOURS: 'teacher_hours',
  TEACHER_HOURS_MISMATCH: 'teacher_hours_mismatch',
  SUBJECT_BALANCE: 'subject_balance'
};

export const ISSUE_ICONS = {
  [ISSUE_TYPES.CLASS_HOURS]: '📚',
  [ISSUE_TYPES.TEACHER_HOURS]: '👨‍🏫',
  [ISSUE_TYPES.TEACHER_HOURS_MISMATCH]: '⚠️',
  [ISSUE_TYPES.SUBJECT_BALANCE]: '⚖️'
};

export const ISSUE_COLORS = {
  [ISSUE_TYPES.CLASS_HOURS]: '#dc3545',
  [ISSUE_TYPES.TEACHER_HOURS]: '#fd7e14',
  [ISSUE_TYPES.TEACHER_HOURS_MISMATCH]: '#ffc107',
  [ISSUE_TYPES.SUBJECT_BALANCE]: '#6c757d'
};

export const DEFAULT_VALUES = {
  DEFAULT_GRADES: 3,
  DEFAULT_CLASSES_PER_GRADE: [4, 4, 4],
  DEFAULT_PERIODS_PER_DAY: { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 },
  WEEKLY_HOURS: 25,
  SUBJECT_WEEKLY_HOURS: {
    '국어': 5, '수학': 5, '과학': 4, '영어': 4,
    '역사': 3, '사회': 3, '체육': 3,
    '도덕': 2, '기술가정': 2, '음악': 2, '미술': 2,
    '정보': 1, '원어민': 1, '보건': 1, '진로와직업': 1,
    '동아리': 1, '스포츠': 1
  }
};

export const CONSTRAINT_TYPES = {
  CO_TEACHING_REQUIREMENT: 'co_teaching_requirement',
  SPECIFIC_TEACHER_CO_TEACHING: 'specific_teacher_co_teaching',
  SUBJECT_BLOCKED_PERIOD: 'subject_blocked_period',
  TEACHER_UNAVAILABLE: 'teacher_unavailable'
}; 