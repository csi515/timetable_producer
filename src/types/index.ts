// 기본 데이터 타입
export interface BaseData {
  periods_per_day: Record<string, number>;
  grades: number;
  classes_per_grade: number[];
}

export interface Subject {
  name: string;
  weekly_hours: number;
  is_merged?: boolean;
  is_space_limited?: boolean;
  max_classes_at_once?: number;
  requires_co_teaching?: boolean;
}

export interface Teacher {
  name: string;
  subjects: string[];
  unavailable: [string, number][]; // [day, period]
  allow_parallel: boolean;
  co_teaching_with: string;
  maxHours: number;
  weeklyHoursByGrade: Record<string, number>;
  classWeeklyHours: Record<string, number>;
  subjectHours: Record<string, number>;
  id?: number;
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
  originalData?: any;
}

export interface TimetableData {
  base: BaseData;
  subjects: Subject[];
  teachers: Teacher[];
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
}

export interface DaySchedule {
  [period: number]: ScheduleSlot | string | undefined;
}

export interface ClassSchedule {
  [day: string]: DaySchedule;
}

export interface Schedule {
  [className: string]: ClassSchedule;
}

// 제약조건 검증 결과 타입
export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  current?: number;
  max?: number;
  day?: string;
  period?: number;
}

// 교사 시수 추적 타입
export interface TeacherHours {
  current: number;
  max: number;
  subjects: Record<string, number>;
  classHours?: Record<string, { current: number; max: number }>;
}

export interface TeacherHoursTracker {
  [teacherName: string]: TeacherHours;
}

// 생성 로그 타입
export interface GenerationLog {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp?: Date;
}

// 통계 타입
export interface ScheduleStats {
  totalSlots: number;
  filledSlots: number;
  emptySlots: number;
  fillRate: string;
  subjectHours: Record<string, number>;
  teacherHours: Record<string, number>;
  classSubjectHours: Record<string, Record<string, number>>;
}

// 배치 계획 타입
export interface PlacementPlan {
  className: string;
  subject: string;
  availableTeachers: Teacher[];
  priority: number;
}

// 사용 가능한 슬롯 타입
export interface AvailableSlot {
  day: string;
  period: number;
  slotIndex: number;
}

// 공동수업 제약조건 타입
export interface CoTeachingConstraint {
  mainTeacher: string;
  coTeachers: string[];
  balanceMode: boolean;
  participation: Record<string, number>;
} 