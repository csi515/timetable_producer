import { ISSUE_TYPES, ISSUE_ICONS, ISSUE_COLORS, DEFAULT_VALUES, CONSTRAINT_TYPES } from '../constants/reviewConstants';

/**
 * 안전한 객체 접근을 위한 유틸리티 함수들
 */

/**
 * 안전한 배열 접근
 * @param {Array} array - 배열
 * @param {Array} defaultValue - 기본값
 * @returns {Array}
 */
export const safeArray = (array, defaultValue = []) => {
  return Array.isArray(array) ? array : defaultValue;
};

/**
 * 안전한 객체 접근
 * @param {Object} obj - 객체
 * @param {Object} defaultValue - 기본값
 * @returns {Object}
 */
export const safeObject = (obj, defaultValue = {}) => {
  return obj && typeof obj === 'object' ? obj : defaultValue;
};

/**
 * 안전한 숫자 접근
 * @param {*} value - 값
 * @param {number} defaultValue - 기본값
 * @returns {number}
 */
export const safeNumber = (value, defaultValue = 0) => {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};

/**
 * 이슈 아이콘 가져오기
 * @param {string} type - 이슈 타입
 * @returns {string}
 */
export const getIssueIcon = (type) => {
  return ISSUE_ICONS[type] || ISSUE_ICONS.DEFAULT;
};

/**
 * 이슈 색상 가져오기
 * @param {string} type - 이슈 타입
 * @returns {string}
 */
export const getIssueColor = (type) => {
  return ISSUE_COLORS[type] || ISSUE_COLORS.DEFAULT;
};

/**
 * 이슈 메시지 생성
 * @param {Object} issue - 이슈 객체
 * @returns {string}
 */
export const getIssueMessage = (issue) => {
  if (!issue || !issue.type) return '알 수 없는 이슈';
  
  switch (issue.type) {
    case ISSUE_TYPES.CLASS_HOURS:
      return `현재 ${issue.current || 0}시간, 목표 ${issue.target || 0}시간 (차이: ${issue.difference || 0}시간)`;
    case ISSUE_TYPES.TEACHER_HOURS_MISMATCH:
      return `실제 ${issue.actual || 0}시간, 예상 ${issue.expected || 0}시간 (차이: ${issue.difference || 0}시간)`;
    case ISSUE_TYPES.SUBJECT_BALANCE:
      return `학급 필요: ${issue.classHours || 0}시간, 교사 담당: ${issue.teacherHours || 0}시간 (차이: ${issue.difference || 0}시간)`;
    default:
      return `현재 ${issue.current || 0}시간, 주간 ${issue.weekly || 0}시간 (초과: ${issue.difference || 0}시간)`;
  }
};

/**
 * 이슈 제목 생성
 * @param {Object} issue - 이슈 객체
 * @returns {string}
 */
export const getIssueTitle = (issue) => {
  if (!issue || !issue.type) return '알 수 없는 이슈';
  
  switch (issue.type) {
    case ISSUE_TYPES.CLASS_HOURS:
      return `${issue.className || '알 수 없는 학급'} 시수 문제`;
    case ISSUE_TYPES.TEACHER_HOURS_MISMATCH:
      return `${issue.teacherName || '알 수 없는 교사'} 시수 불일치`;
    case ISSUE_TYPES.SUBJECT_BALANCE:
      return `${issue.subject || '알 수 없는 과목'} 과목 시수 불균형`;
    default:
      return `${issue.teacherName || '알 수 없는 교사'} 교사 시수 초과`;
  }
};

/**
 * 공동 수업 여부 확인
 * @param {string} teacherName - 교사명
 * @param {Array} coTeachingClasses - 공동 수업 목록
 * @returns {boolean}
 */
export const hasCoTeaching = (teacherName, coTeachingClasses) => {
  if (!teacherName) return false;
  
  return safeArray(coTeachingClasses).some(ct => 
    ct?.mainTeacher === teacherName || 
    (ct?.coTeachers && Array.isArray(ct.coTeachers) && ct.coTeachers.includes(teacherName))
  );
};

/**
 * 교사의 공동수업 유형 확인
 * @param {string} teacherName - 교사명
 * @param {Array} coTeachingClasses - 공동 수업 목록
 * @returns {Array} 공동수업 유형 배열
 */
export const getCoTeachingTypes = (teacherName, coTeachingClasses) => {
  if (!teacherName) return [];
  
  const types = [];
  safeArray(coTeachingClasses).forEach(ct => {
    if (ct?.mainTeacher === teacherName || 
        (ct?.coTeachers && Array.isArray(ct.coTeachers) && ct.coTeachers.includes(teacherName))) {
      if (ct?.source === 'constraint') {
        types.push('제약조건');
      } else {
        types.push('고정수업');
      }
    }
  });
  
  return [...new Set(types)]; // 중복 제거
};

/**
 * 시수 차이 계산
 * @param {number} current - 현재 시수
 * @param {number} target - 목표 시수
 * @returns {number}
 */
export const calculateHoursDifference = (current, target) => {
  return safeNumber(current) - safeNumber(target);
};

/**
 * 시수 균형 상태 확인
 * @param {number} difference - 시수 차이
 * @returns {string}
 */
export const getBalanceStatus = (difference) => {
  const absDifference = Math.abs(difference);
  if (absDifference <= DEFAULT_VALUES.HOURS_TOLERANCE) {
    return '✅ 균형';
  }
  return difference > 0 ? '⚠️ 부족' : '⚠️ 초과';
};

/**
 * 기본 검토 데이터 생성
 * @returns {Object}
 */
export const createDefaultReviewData = () => ({
  classHours: {},
  teacherHours: {},
  coTeachingClasses: [],
  issues: []
}); 