// 제약조건 엔진 타입 정의

export type Day = '월' | '화' | '수' | '목' | '금';

export interface TimeSlot {
  day: Day;
  period: number; // 1-based
}

export interface Slot {
  classId: string;
  day: Day;
  period: number;
  subjectId: string | null;
  teacherId: string | null;
  coTeachers?: string[]; // 공동수업 교사 목록
  roomId?: string; // 교실 ID
}

export interface Teacher {
  id: string;
  name: string;
  subjects: string[];
  weeklyHours: number;
  maxHoursPerDay?: number;
  unavailableSlots: TimeSlot[];
  grade?: number; // 담당 학년
}

export interface Class {
  id: string;
  name: string;
  grade: number;
  classNumber: number;
  floor?: number; // 층수 (이동수업 최적화용)
}

export interface Subject {
  id: string;
  name: string;
  weeklyHours: number; // 주당 시수
  requiresConsecutive?: boolean; // 연강 필요
  consecutivePeriods?: number; // 연강 교시 수 (기본 2)
  requiresSpecialRoom?: boolean;
  specialRoomType?: string; // '실험실', '컴퓨터실', '음악실' 등
  maxPerDay?: number; // 하루 최대 배정 횟수
  preferredPeriods?: number[]; // 선호 교시 (소프트 제약)
  difficulty?: number; // 난이도 (1-10)
  requiresCoTeaching?: boolean; // 공동수업 필요
  coTeachers?: string[]; // 공동수업 교사 목록
}

export interface Room {
  id: string;
  name: string;
  type: 'regular' | 'lab' | 'computer' | 'music' | 'gym' | 'auditorium';
  capacity?: number;
  floor?: number;
  building?: string;
}

export interface SpecialProgram {
  id: string;
  type: 'creative' | 'club' | 'co-teaching' | 'level-based';
  name: string;
  targetClasses: string[]; // 대상 학급 ID 목록
  targetGrade?: number; // 대상 학년
  day: Day;
  period: number;
  teachers?: string[]; // 담당 교사 (선택)
  roomId?: string;
}

export interface Timetable {
  [classId: string]: {
    [day in Day]: {
      [period: number]: Slot | null;
    };
  };
}

export interface SchoolConfig {
  days: Day[];
  periodsPerDay: Record<Day, number>;
  lunchPeriod: number; // 점심 시간 전 마지막 교시
  totalWeeks: number; // 학기 주수 (기본 1)
}

export interface TimetableData {
  classes: Class[];
  subjects: Subject[];
  teachers: Teacher[];
  rooms?: Room[];
  specialPrograms?: SpecialProgram[];
  timetable: Timetable;
  schoolSchedule: SchoolConfig;
}

// 제약조건 평가 결과
export interface ConstraintEvaluationResult {
  satisfied: boolean;
  reason?: string;
  violatedConstraints: string[];
  severity: 'error' | 'warning';
  details?: Record<string, any>;
  score?: number; // 소프트 제약조건 점수 (낮을수록 좋음)
}

// 제약조건 메타데이터
export interface ConstraintMetadata {
  id: string;
  name: string;
  description: string;
  type: 'hard' | 'soft';
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
}

// 제약조건 위반 리포트
export interface ViolationReport {
  constraintId: string;
  constraintName: string;
  severity: 'error' | 'warning';
  message: string;
  affectedSlots: Slot[];
  details?: Record<string, any>;
}

// 전체 검증 리포트
export interface ValidationReport {
  isValid: boolean;
  hardViolations: ViolationReport[];
  softViolations: ViolationReport[];
  totalScore: number; // 소프트 제약조건 총 점수
  summary: {
    totalConstraints: number;
    hardConstraints: number;
    softConstraints: number;
    hardViolations: number;
    softViolations: number;
  };
}
