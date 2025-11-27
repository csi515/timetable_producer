/**
 * 검토 관련 타입 정의
 */

/**
 * @typedef {Object} ClassHours
 * @property {number} totalHours - 총 시수
 * @property {Object.<string, number>} subjects - 과목별 시수
 */

/**
 * @typedef {Object} TeacherHours
 * @property {number} totalHours - 총 시수
 * @property {Object.<string, number>} subjects - 과목별 시수
 * @property {number} weeklyHours - 주간 시수
 * @property {Object.<string, number>} weeklyHoursByGrade - 학급별 시수
 * @property {number} weeklyHoursSum - 학급별 시수 합계
 * @property {boolean} allowParallel - 병렬 수업 허용 여부
 */

/**
 * @typedef {Object} CoTeachingClass
 * @property {string} className - 학급명
 * @property {string} subject - 과목명
 * @property {string} mainTeacher - 주담당 교사
 * @property {Array.<string>} coTeachers - 공동 교사 목록
 * @property {string} day - 요일
 * @property {number} period - 교시
 */

/**
 * @typedef {Object} Issue
 * @property {string} type - 이슈 타입
 * @property {string} [className] - 학급명 (class_hours 타입일 때)
 * @property {string} [teacherName] - 교사명 (teacher_hours 타입일 때)
 * @property {string} [subject] - 과목명 (subject_balance 타입일 때)
 * @property {number} [current] - 현재 시수
 * @property {number} [target] - 목표 시수
 * @property {number} [difference] - 차이
 * @property {number} [actual] - 실제 시수
 * @property {number} [expected] - 예상 시수
 * @property {number} [classHours] - 학급 시수
 * @property {number} [teacherHours] - 교사 시수
 * @property {number} [weekly] - 주간 시수
 */

/**
 * @typedef {Object} ReviewData
 * @property {Object.<string, ClassHours>} classHours - 학급별 시수
 * @property {Object.<string, TeacherHours>} teacherHours - 교사별 시수
 * @property {Array.<CoTeachingClass>} coTeachingClasses - 공동 수업 목록
 * @property {Array.<Issue>} issues - 이슈 목록
 */

/**
 * @typedef {Object} SubjectComparison
 * @property {number} classHours - 학급 시수
 * @property {number} teacherHours - 교사 시수
 * @property {Array.<string>} teachers - 담당 교사 목록
 * @property {Array.<Object>} teacherDetails - 교사 상세 정보
 */

/**
 * @typedef {Object} TeacherDetail
 * @property {string} name - 교사명
 * @property {number} maxHours - 최대 시수
 * @property {number} estimatedHours - 추정 시수
 * @property {number} actualHours - 실제 시수
 */ 