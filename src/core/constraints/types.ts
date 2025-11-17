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
  roomId?: string | null; // 교실 ID
  isCoTeaching?: boolean; // 공동수업 여부
  coTeachers?: string[]; // 공동수업 교사 목록
  isSpecialProgram?: boolean; // 특수 프로그램 여부
  programType?: 'creative' | 'club' | 'level_based'; // 프로그램 타입
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
}

export interface Subject {
  id: string;
  name: string;
  weeklyHours: number; // 주당 시수
  requiresConsecutive?: boolean; // 연강 필요
  consecutivePeriods?: number; // 연속 교시 수 (기본 2)
  requiresSpecialRoom?: boolean; // 특별실 필요
  specialRoomType?: string; // 특별실 종류
  maxPerDay?: number; // 하루 최대 배정 횟수
  fixedDay?: Day; // 고정 요일
  fixedPeriod?: number; // 고정 교시
  preferredPeriods?: number[]; // 선호 교시
  avoidPeriods?: number[]; // 피해야 할 교시
}

export interface Room {
  id: string;
  name: string;
  type: 'regular' | 'lab' | 'computer' | 'music' | 'gym' | 'auditorium';
  capacity?: number;
  floor?: number; // 층수
  canCoTeaching?: boolean; // 공동수업 가능 여부
}

export interface SpecialProgram {
  id: string;
  name: string;
  type: 'creative' | 'club' | 'level_based';
  grade?: number; // 학년 (창체, 수준별 이동수업)
  classes: string[]; // 참여 학급 ID 목록
  teachers: string[]; // 담당 교사 ID 목록 (선택적)
  weeklyFrequency: number; // 주당 횟수
  fixedDay?: Day; // 고정 요일
  fixedPeriod?: number; // 고정 교시
  requiredRoom?: string; // 필요 교실 ID
}

export interface Timetable {
  [classId: string]: {
    [day in Day]: {
      [period: number]: Slot;
    };
  };
}

export interface SchoolSchedule {
  days: Day[];
  periodsPerDay: Record<Day, number>;
  lunchPeriod?: number; // 점심 시간 전 교시
  breakPeriods?: Array<{ day: Day; period: number }>; // 쉬는 시간
}

export interface TimetableData {
  classes: Class[];
  subjects: Subject[];
  teachers: Teacher[];
  rooms?: Room[];
  specialPrograms?: SpecialProgram[];
  timetable: Timetable;
  schoolSchedule: SchoolSchedule;
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
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'teacher' | 'class' | 'subject' | 'facility' | 'special_program' | 'distribution';
  isHard: boolean; // 하드 제약조건 여부
}

// 제약조건 엔진 설정
export interface ConstraintEngineConfig {
  maxConsecutivePeriods?: number;
  lunchPeriod?: number;
  maxBeforeLunch?: number;
  minDaysBetween?: number;
  enableSoftConstraints?: boolean;
}
