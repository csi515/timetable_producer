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
  block?: boolean; // 블록제 수업 여부 (2시간 연속 수업)
  category?: string; // 과목 분류 (교과과목, 창의적 체험활동 등)
}

export interface Teacher {
  name: string;
  subjects: string[];
  unavailable: [string, number][]; // [day, period]
  allow_parallel: boolean;
  co_teaching_with: string;
  maxHours: number;
  max_hours_per_week?: number; // 주간 최대 수업 시수 제한
  weeklyHoursByGrade: Record<string, number>;
  classWeeklyHours: Record<string, number>;
  subjectHours: Record<string, number>;
  id?: number;
  // 교사 간 동시 수업 제약조건
  mutual_exclusions?: string[]; // 동시에 수업할 수 없는 교사들의 이름 배열
  // 학년별 순차 수업 배정 제약조건
  sequential_grade_teaching?: boolean; // 학년별 순차 수업 배정 적용 여부
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
  className?: string; // 학급명 (선택적)
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
  [className: string]: ClassSchedule;
}

// 제약조건 검증 결과 타입
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
  conflictTeacher?: string; // 충돌하는 교사명
  consecutiveCount?: number; // 연속 수업 횟수
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
  targetHours?: number; // 목표 시수
  currentHours?: number; // 현재 시수
  remainingHours?: number; // 남은 시수
  isClassWeeklyHoursSetting?: boolean; // 학급별 주간시수 설정 여부
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