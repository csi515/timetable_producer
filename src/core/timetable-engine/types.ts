// 시간표 생성 엔진 타입 정의

export type Day = '월' | '화' | '수' | '목' | '금';

export interface TimeSlot {
  day: Day;
  period: number; // 1-based
}

export interface SchoolConfig {
  days: Day[];
  periodsPerDay: Record<Day, number>;
  lunchPeriod: number; // 점심 시간 전 교시 (예: 4)
  gradeCommonPeriods?: Array<{
    grade: number;
    day: Day;
    period: number;
    activity: string; // 창의적 체험활동, 학년행사 등
  }>;
}

export interface Class {
  id: string;
  name: string; // 예: "1학년 1반"
  grade: number;
  classNumber: number;
}

export interface Subject {
  id: string;
  name: string;
  weeklyHours: number; // 주당 시수
  requiresConsecutive?: boolean; // 연강 필요 (예: 체육 1,2교시)
  maxPerDay?: number; // 하루 최대 배정 횟수 (기본 1)
  fixedTime?: TimeSlot; // 고정 시간대
  preferredPeriods?: number[]; // 선호 교시 (예: 수학은 1,2교시)
  avoidPeriods?: number[]; // 피해야 할 교시
  facilityType?: string; // 특수 교실 타입 (실험실, 컴퓨터실 등)
  requiresCoTeaching?: boolean; // 코티칭 필요
  coTeachers?: string[]; // 공동 수업 교사 ID 목록
  levelBased?: boolean; // 수준별 이동수업 여부
  levelGroup?: string; // 수준별 그룹 ID
}

export interface Teacher {
  id: string;
  name: string;
  subjects: string[]; // 담당 과목 ID 목록
  weeklyHours: number; // 주당 시수
  maxHoursPerDay?: number; // 하루 최대 수업 수
  unavailableSlots: TimeSlot[]; // 금지 시간대
  maxConsecutivePeriods?: number; // 최대 연속 교시 (기본 3)
  maxBeforeLunch?: number; // 점심 전 최대 수업 수 (기본 2)
  coTeachingSubjects?: string[]; // 코티칭 과목 ID 목록
}

export interface Facility {
  id: string;
  name: string;
  type: string; // 'laboratory' | 'computer' | 'music' | 'gym' | 'auditorium' | 'classroom'
  floor?: number; // 층수
  capacity?: number; // 수용 인원
  exclusive: boolean; // 동시 사용 불가 여부
}

export interface SpecialProgram {
  id: string;
  type: 'creative' | 'club' | 'co-teaching' | 'level-based';
  name: string;
  grade?: number; // 학년 (전교면 undefined)
  day: Day;
  period: number;
  classes?: string[]; // 참여 학급 ID 목록
  teachers?: string[]; // 담당 교사 ID 목록
  facilityId?: string; // 사용 교실
}

export interface Assignment {
  classId: string;
  subjectId: string;
  teacherId: string | string[]; // 단일 교사 또는 코티칭 교사들
  day: Day;
  period: number;
  facilityId?: string;
  isCoTeaching?: boolean;
  isLevelBased?: boolean;
  levelGroup?: string;
}

export interface Timetable {
  [classId: string]: {
    [day in Day]: {
      [period: number]: Assignment | null;
    };
  };
}

export interface TeacherTimetable {
  [teacherId: string]: {
    [day in Day]: {
      [period: number]: Assignment | null;
    };
  };
}

export interface TimetableData {
  schoolConfig: SchoolConfig;
  classes: Class[];
  subjects: Subject[];
  teachers: Teacher[];
  facilities: Facility[];
  specialPrograms: SpecialProgram[];
  timetable: Timetable;
  teacherTimetable: TeacherTimetable;
}

// 제약조건 평가 결과
export interface ConstraintResult {
  satisfied: boolean;
  severity: 'hard' | 'soft';
  message: string;
  details?: Record<string, any>;
}

// 생성 결과
export interface GenerationResult {
  success: boolean;
  timetable: Timetable;
  teacherTimetable: TeacherTimetable;
  violations: Array<{
    type: 'hard' | 'soft';
    constraint: string;
    message: string;
    details?: any;
  }>;
  statistics: {
    totalAssignments: number;
    hardViolations: number;
    softViolations: number;
    generationTime: number;
    iterations: number;
    backtracks: number;
  };
  heuristics: {
    variableSelection: string;
    valueOrdering: string;
    strategies: string[];
  };
}

// 제약조건 위반 리포트
export interface ViolationReport {
  hardViolations: Array<{
    constraint: string;
    message: string;
    assignments: Assignment[];
    details: any;
  }>;
  softViolations: Array<{
    constraint: string;
    message: string;
    score: number;
    details: any;
  }>;
  summary: {
    totalHardViolations: number;
    totalSoftViolations: number;
    isFeasible: boolean;
  };
}
