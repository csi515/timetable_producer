// 시간표 생성 엔진 통합 타입 정의

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
  isSpecialProgram?: boolean; // 창체/동아리 등 특수 프로그램 여부
  programType?: 'creative' | 'club' | 'co-teaching' | 'level-based'; // 프로그램 타입
}

export interface Teacher {
  id: string;
  name: string;
  subjects: string[];
  weeklyHours: number;
  maxHoursPerDay?: number;
  unavailableSlots: TimeSlot[];
  preferredSlots?: TimeSlot[]; // 선호 시간대
  grade?: number; // 담당 학년 (선택)
}

export interface Class {
  id: string;
  name: string;
  grade: number;
  classNumber: number;
  floor?: number; // 층수 (이동수업 거리 계산용)
}

export interface Subject {
  id: string;
  name: string;
  weeklyHours: number; // 주당 시수
  requiresConsecutive?: boolean; // 연강 필요 여부
  requiresSpecialRoom?: boolean; // 특별실 필요 여부
  specialRoomType?: string; // 특별실 종류
  maxPerDay?: number; // 하루 최대 배정 횟수
  fixedSlots?: TimeSlot[]; // 고정 시간대
  forbiddenSlots?: TimeSlot[]; // 금지 시간대
  preferredPeriods?: number[]; // 선호 교시 (예: 1-2교시)
  difficulty?: 'high' | 'medium' | 'low'; // 난이도 (집중도)
  isCoreSubject?: boolean; // 핵심 과목 여부
}

export interface Room {
  id: string;
  name: string;
  type: 'regular' | 'science' | 'computer' | 'music' | 'gym' | 'auditorium';
  capacity?: number;
  floor?: number;
  grade?: number; // 학년별 전용 교실
}

export interface SpecialProgram {
  id: string;
  name: string;
  type: 'creative' | 'club' | 'co-teaching' | 'level-based';
  grade?: number; // 학년 (전체면 undefined)
  classes?: string[]; // 참여 학급 목록
  teachers: string[]; // 담당 교사 목록
  weeklyFrequency: number; // 주당 횟수
  requiredRoom?: string; // 필요 교실
  fixedSlots?: TimeSlot[]; // 고정 시간대
}

export interface Timetable {
  [classId: string]: {
    [day in Day]: {
      [period: number]: Slot;
    };
  };
}

export interface SchoolConfig {
  days: Day[];
  periodsPerDay: Record<Day, number>;
  lunchPeriod: number; // 점심 시간 전 마지막 교시
  breakPeriods?: number[]; // 쉬는 시간 교시
  gradeCommonSlots?: Record<number, TimeSlot[]>; // 학년별 공통 시간대
}

export interface TimetableData {
  schoolConfig: SchoolConfig;
  classes: Class[];
  subjects: Subject[];
  teachers: Teacher[];
  rooms: Room[];
  specialPrograms?: SpecialProgram[];
  timetable: Timetable;
}

// 제약조건 평가 결과
export interface ConstraintEvaluationResult {
  satisfied: boolean;
  reason?: string;
  violatedConstraints: string[];
  severity: 'error' | 'warning';
  details?: Record<string, any>;
  score?: number; // 소프트 제약조건 점수
}

// 제약조건 메타데이터
export interface ConstraintMetadata {
  id: string;
  name: string;
  description: string;
  type: 'hard' | 'soft'; // 하드/소프트 제약조건
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
}

// 생성 결과
export interface GenerationResult {
  success: boolean;
  timetable: Timetable;
  violations: ConstraintEvaluationResult[];
  statistics: {
    totalSlots: number;
    filledSlots: number;
    emptySlots: number;
    hardConstraintViolations: number;
    softConstraintScore: number;
    generationTime: number;
    iterations: number;
    backtracks: number;
  };
  heuristicSummary: {
    variableSelection: string;
    valueOrdering: string;
    strategiesUsed: string[];
  };
}
