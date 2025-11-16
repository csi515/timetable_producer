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
}

export interface Teacher {
  id: string;
  name: string;
  subjects: string[];
  weeklyHours: number;
  maxHoursPerDay?: number;
  unavailableSlots: TimeSlot[];
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
  requiresConsecutive?: boolean;
  requiresSpecialRoom?: boolean;
  specialRoomType?: string;
  maxPerDay?: number;
}

export interface Timetable {
  [classId: string]: {
    [day in Day]: {
      [period: number]: Slot;
    };
  };
}

export interface TimetableData {
  classes: Class[];
  subjects: Subject[];
  teachers: Teacher[];
  timetable: Timetable;
  schoolSchedule: {
    days: Day[];
    periodsPerDay: Record<Day, number>;
    lunchPeriod?: number;
  };
}

// 제약조건 평가 결과
export interface ConstraintEvaluationResult {
  satisfied: boolean;
  reason?: string;
  violatedConstraints: string[];
  severity: 'error' | 'warning';
  details?: Record<string, any>;
}

// 제약조건 메타데이터
export interface ConstraintMetadata {
  id: string;
  name: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
}
