// 기본 데이터 타입
export interface BaseData {
  periods_per_day: Record<string, number>;
  grades: number;
  classes_per_grade: number[];
}

export interface Subject {
  id: string;
  name: string;
  weekly_hours: number;
  is_merged?: boolean;
  is_space_limited?: boolean;
  max_classes_at_once?: number;
  requires_co_teaching?: boolean;
  block?: boolean; // 블록제 수업 여부 (2시간 연속 수업)
  priority?: number; // 배치 우선순위 (높을수록 우선)
}

export interface Teacher {
  id: string;
  name: string;
  subjects: string[]; // 과목 ID 배열
  unavailable: [string, number][]; // [day, period] - 불가능한 시간
  available_times?: [string, number][]; // [day, period] - 가능한 시간만 지정
  allow_parallel: boolean;
  co_teaching_with: string;
  maxHours: number;
  max_hours_per_week?: number; // 주간 최대 수업 시수 제한
  weeklyHoursByGrade: Record<string, number>;
  classWeeklyHours: Record<string, number>;
  subjectHours: Record<string, number>;
  priority?: number; // 배치 우선순위 (높을수록 우선)
}

export interface Class {
  id: string;
  name: string;
  grade: number;
  class_number: number;
  weekly_hours: number; // 주간 총 수업 시수
  subject_requirements: Record<string, number>; // 과목별 필요 시수
}

export interface Constraint {
  id: number;
  type: string;
  description: string;
  subject?: string;
  mainTeacher?: string;
  coTeachers?: string[];
  class?: string;
  maxPeriods?: number;
  subjects?: string[]; // 고정수업 전용 과목 목록
  priority?: number; // 제약조건 우선순위
}

export interface FixedClass {
  id: string;
  day: string;
  period: number;
  grade: number;
  class: number;
  subject: string;
  teacher: string;
  coTeachers: string[];
  className?: string; // 학급명 (선택적)
  originalData?: any;
}

export interface TimetableData {
  base: BaseData;
  subjects: Subject[];
  teachers: Teacher[];
  classes: Class[];
  constraints: {
    must: Constraint[];
    optional: Constraint[];
  };
  fixedClasses: FixedClass[];
  classWeeklyHours: Record<string, number>;
  schedule?: Schedule;
  teacherHours?: TeacherHoursTracker;
  statistics?: {
    totalSubjects: number;
    totalTeachers: number;
    totalConstraints: number;
    totalFixedClasses: number;
  };
}

// 시간표 스케줄 타입
export interface ScheduleSlot {
  subject: string;
  teachers: string[];
  isCoTeaching: boolean;
  isFixed: boolean;
  source?: string;
  constraintType?: string;
  mainTeacher?: string;
  coTeachers?: string[];
  isBlockPeriod?: boolean; // 블록제 수업 여부
  blockPartner?: number; // 블록제 수업의 짝이 되는 교시 인덱스
  priority?: number; // 우선순위 (재조정 시 사용)
}

export interface DaySchedule {
  [period: number]: ScheduleSlot | string | undefined;
}

export interface ClassSchedule {
  [day: string]: DaySchedule;
}

export interface Schedule {
  [classId: string]: ClassSchedule;
}

// 새로운 다차원 배열 형태의 시간표 구조
export interface ClassScheduleArray {
  [classId: string]: {
    [day: string]: {
      [period: number]: ScheduleSlot | null;
    };
  };
}

export interface TeacherScheduleArray {
  [teacherId: string]: {
    [day: string]: {
      [period: number]: {
        classId: string;
        subject: string;
        isCoTeaching: boolean;
      } | null;
    };
  };
}

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  message?: string;
  current?: number;
  max?: number;
  day?: string;
  period?: number;
  conflictClass?: string; // 충돌하는 학급명
  conflictSubject?: string; // 충돌하는 과목명
}

export interface TeacherHours {
  current: number;
  max: number;
  subjects: Record<string, number>;
  classHours?: Record<string, { current: number; max: number }>;
}

export interface TeacherHoursTracker {
  [teacherName: string]: TeacherHours;
}

export interface GenerationLog {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp?: Date;
}

export interface ScheduleStats {
  totalSlots: number;
  filledSlots: number;
  emptySlots: number;
  fillRate: string;
  subjectHours: Record<string, number>;
  teacherHours: Record<string, number>;
  classSubjectHours: Record<string, Record<string, number>>;
}

export interface PlacementPlan {
  className: string;
  subject: string;
  availableTeachers: Teacher[];
  priority: number;
}

export interface AvailableSlot {
  day: string;
  period: number;
  slotIndex: number;
}

export interface CoTeachingConstraint {
  mainTeacher: string;
  coTeachers: string[];
  balanceMode: boolean;
  participation: Record<string, number>;
}

// 새로운 배치 우선순위 관련 타입
export interface PlacementPriority {
  subjectId: string;
  classId: string;
  priority: number;
  difficulty: number; // 배치 난이도 (높을수록 어려움)
  availableSlots: number; // 가능한 슬롯 수
  requiredTeachers: string[]; // 필요한 교사들
  isBlockSubject: boolean;
  isCoTeaching: boolean;
}

// 백트래킹 관련 타입
export interface BacktrackState {
  schedule: ClassScheduleArray;
  teacherSchedule: TeacherScheduleArray;
  teacherHours: TeacherHoursTracker;
  placementHistory: PlacementHistory[];
  currentStep: number;
}

export interface PlacementHistory {
  classId: string;
  day: string;
  period: number;
  subjectId: string;
  teachers: string[];
  timestamp: Date;
  slotScore?: number; // 슬롯 점수 (백트래킹 시 사용)
  currentHours?: number; // 현재 배정된 시수
  targetHours?: number; // 목표 시수
}

// 후보 슬롯 타입
export interface CandidateSlot {
  day: string;
  period: number;
  score: number;
  isBlockSlot: boolean;
  nextPeriod?: number; // 블록제 슬롯의 경우 다음 교시
}

// 제약조건 위반 기록
export interface ConstraintViolation {
  subjectId: string;
  classId: string;
  availableSlots: number;
  timestamp: Date;
  reason: 'no_available_slots' | 'constraint_conflict' | 'teacher_unavailable' | 'time_conflict';
  details?: string;
}

// 성능 메트릭
export interface PerformanceMetrics {
  startTime: number;
  totalPlacementTime: number;
  averagePlacementTime: number;
  cacheHitRate?: number;
  memoryUsage?: number;
}

// 연속 수업 제한 관련 타입
export interface ConsecutiveTeachingConstraint {
  teacherId: string;
  maxConsecutiveHours: number; // 최대 연속 수업 시간 (기본값: 2)
  penaltyWeight: number; // 위반 시 페널티 가중치 (기본값: 10)
}

// 시간표 품질 평가 결과
export interface TimetableQualityScore {
  totalScore: number;
  consecutiveTeachingScore: number;
  consecutiveTeachingViolations: Array<{
    teacherId: string;
    day: string;
    consecutiveHours: number;
    maxAllowed: number;
    penalty: number;
  }>;
  otherScores: {
    [key: string]: number;
  };
}

// 실패 분석 결과
export interface FailureAnalysis {
  totalAttempts: number;
  successfulPlacements: number;
  failedPlacements: number;
  backtrackCount: number;
  constraintViolations: ConstraintViolation[];
  performanceMetrics: PerformanceMetrics;
  qualityScore?: TimetableQualityScore;
  topFailureReasons?: Array<{
    subjectId: string;
    classId: string;
    failureCount: number;
    reason: string;
  }>;
}

// 제약조건 검증 함수 타입
export interface ConstraintChecker {
  isTeacherAvailable: (teacherId: string, day: string, period: number) => ValidationResult;
  isClassSubjectLimitOk: (classId: string, subjectId: string) => ValidationResult;
  isTeacherWeeklyHoursWithinLimit: (teacherId: string) => ValidationResult;
  isBlockSubjectValid: (subjectId: string, day: string, period: number) => ValidationResult;
  isCoTeachingValid: (subjectId: string, teacher1: string, teacher2: string, day: string, period: number) => ValidationResult;
  isTeacherConflictFree: (teacherId: string, day: string, period: number, excludeClassId?: string) => ValidationResult;
  isClassWeeklyHoursWithinLimit: (classId: string) => ValidationResult;
  validatePlacement: (classId: string, day: string, period: number, subjectId: string, teachers: string[]) => ValidationResult;
} 