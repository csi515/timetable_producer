// 제약조건 엔진 통합 타입 정의

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
  roomId?: string | null;
  isSpecialProgram?: boolean; // 창체, 동아리, 코티칭 등
  programType?: 'creative' | 'club' | 'co-teaching' | 'level-based';
  coTeachers?: string[]; // 코티칭 교사 목록
}

export interface Teacher {
  id: string;
  name: string;
  subjects: string[];
  weeklyHours: number;
  maxHoursPerDay?: number;
  unavailableSlots: TimeSlot[];
  preferredSlots?: TimeSlot[]; // 선호 시간대 (소프트 제약)
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
  requiresConsecutive?: boolean; // 연강 필요 여부
  requiresSpecialRoom?: boolean;
  specialRoomType?: string; // '실험실', '컴퓨터실', '음악실' 등
  maxPerDay?: number; // 하루 최대 배정 횟수
  fixedSlots?: TimeSlot[]; // 고정 시간대
  forbiddenSlots?: TimeSlot[]; // 금지 시간대
  preferredPeriods?: number[]; // 선호 교시 (소프트 제약)
  difficulty?: 'high' | 'medium' | 'low'; // 집중도 (1-2교시 우선 배치용)
}

export interface Room {
  id: string;
  name: string;
  type: 'regular' | 'lab' | 'computer' | 'music' | 'gym' | 'auditorium';
  capacity?: number;
  floor?: number;
  isSpecial: boolean;
}

export interface SpecialProgram {
  id: string;
  name: string;
  type: 'creative' | 'club' | 'co-teaching' | 'level-based';
  targetClasses: string[]; // 대상 학급 ID 목록
  targetGrade?: number; // 학년 전체인 경우
  requiredTeachers?: string[]; // 필수 교사 (코티칭)
  optionalTeachers?: string[]; // 선택 교사
  weeklyFrequency: number; // 주당 횟수
  fixedSlots?: TimeSlot[]; // 고정 시간대
  requiredRoom?: string; // 필요 교실
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
  lunchPeriod: number; // 점심 시간 전 교시
  breakPeriods?: number[]; // 쉬는 시간 (예: 3교시 후)
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
  severity: 'hard' | 'soft'; // 하드 제약조건 위반 vs 소프트 제약조건 위반
  details?: Record<string, any>;
  score?: number; // 소프트 제약조건 점수 (낮을수록 좋음)
}

// 제약조건 메타데이터
export interface ConstraintMetadata {
  id: string;
  name: string;
  description: string;
  type: 'hard' | 'soft'; // 하드 제약조건 vs 소프트 제약조건
  category: 'teacher' | 'class' | 'subject' | 'facility' | 'special-program' | 'distribution';
  priority: number; // 평가 우선순위 (낮을수록 먼저 평가)
}

// 제약조건 전파 결과
export interface PropagationResult {
  domains: Map<string, TimeSlot[]>; // 변수 ID -> 가능한 시간대 목록
  prunedValues: Array<{ variableId: string; slot: TimeSlot }>;
  hasEmptyDomain: boolean;
}

// 스코어링 결과
export interface ScoringResult {
  totalScore: number; // 총 점수 (낮을수록 좋음)
  breakdown: {
    consecutiveLessons: number;
    distribution: number;
    preferredSlots: number;
    fatigue: number;
  };
}
