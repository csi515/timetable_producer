// 시간표 생성 시스템의 핵심 타입 정의

export type Day = '월' | '화' | '수' | '목' | '금';

export interface TimeSlot {
  day: Day;
  period: number; // 1-based
}

export interface Class {
  id: string;
  name: string; // 예: "1학년 1반"
  grade: number;
  classNumber: number;
}

export interface Subject {
  id: string;
  name: string; // 예: "수학", "체육"
  requiresConsecutive?: boolean; // 연강 필요 여부 (2교시 연속)
  requiresSpecialRoom?: boolean; // 특별실 필요 여부
  specialRoomType?: string; // "실험실", "컴퓨터실" 등
  maxPerDay?: number; // 하루 최대 배정 횟수 (기본 1)
  difficulty?: number; // 난이도 (휴리스틱용)
}

export interface Teacher {
  id: string;
  name: string;
  subjects: string[]; // 담당 과목 ID 목록
  weeklyHours: number; // 주당 시수
  maxHoursPerDay?: number; // 하루 최대 수업수
  unavailableSlots: TimeSlot[]; // 불가능한 시간대
}

export interface Assignment {
  classId: string;
  subjectId: string;
  teacherId: string;
  slot: TimeSlot;
}

export interface TimetableSlot {
  classId: string;
  subjectId: string | null;
  teacherId: string | null;
  isEmpty: boolean;
}

export interface Timetable {
  [classId: string]: {
    [day in Day]: {
      [period: number]: TimetableSlot;
    };
  };
}

export interface SchoolSchedule {
  days: Day[];
  periodsPerDay: Record<Day, number>; // 각 요일별 교시 수
  lunchPeriod?: number; // 점심 시간 전 교시 (예: 4교시까지)
}

export interface ConstraintConfig {
  preventConsecutive3Periods: boolean; // 3교시 연속 금지
  preventMorningOverload: boolean; // 점심 전 편중 방지
  preventDuplicateSubjectPerDay: boolean; // 하루 2회 배정 금지
  ensureEvenDistribution: boolean; // 고르게 분포
}

export interface TimetableData {
  classes: Class[];
  subjects: Subject[];
  teachers: Teacher[];
  schoolSchedule: SchoolSchedule;
  constraints: ConstraintConfig;
  assignments: Assignment[];
}

// CSP 변수 (Variable)
export interface CSPVariable {
  classId: string;
  subjectId: string;
  requiredHours: number; // 이 과목이 이 반에 필요한 주당 시수
}

// CSP 도메인 (Domain)
export type Domain = TimeSlot[];

// CSP 제약조건 타입
export type ConstraintType = 
  | 'teacher_conflict' // 교사 시간 충돌
  | 'class_conflict' // 반 시간 충돌
  | 'teacher_unavailable' // 교사 불가능 시간
  | 'consecutive_required' // 연강 필요
  | 'consecutive_forbidden' // 연속 금지
  | 'special_room_conflict' // 특별실 충돌
  | 'subject_limit_per_day' // 하루 배정 제한
  | 'teacher_hours_limit' // 교사 시수 제한
  | 'teacher_daily_limit'; // 교사 하루 제한

export interface CSPConstraint {
  type: ConstraintType;
  variables: CSPVariable[];
  check: (assignments: Assignment[]) => boolean;
  description: string;
}

// 알고리즘 상태
export interface GenerationState {
  variables: CSPVariable[];
  assignments: Assignment[];
  backtrackCount: number;
  iterationCount: number;
  startTime: number;
  logs: string[];
}

// 제약조건 위반 정보
export interface Violation {
  type: ConstraintType;
  message: string;
  assignments: Assignment[];
  severity: 'error' | 'warning';
}
