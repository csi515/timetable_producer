// 시간표 생성 엔진 타입 정의

export type Day = '월' | '화' | '수' | '목' | '금';

export interface TimeSlot {
  day: Day;
  period: number; // 1-based
}

export interface SchoolConfig {
  days: Day[];
  periodsPerDay: Record<Day, number>;
  lunchPeriod: number; // 점심 시간 전 교시 (예: 4교시까지)
  gradeCommonPeriods?: Array<{
    grade: number;
    day: Day;
    period: number;
    activity: string; // '창체', '학년행사' 등
  }>;
}

export interface Class {
  id: string;
  name: string; // "1학년 1반"
  grade: number;
  classNumber: number;
  level?: string; // 수준별 이동수업용: 'A', 'B', 'C' 등
}

export interface Subject {
  id: string;
  name: string;
  weeklyHours: number; // 주당 시수
  grade: number; // 학년
  requiresConsecutive?: boolean; // 연강 필요 여부
  consecutiveHours?: number; // 연강 시 연속 교시 수 (기본 2)
  requiresSpecialRoom?: boolean;
  specialRoomType?: string; // '실험실', '컴퓨터실', '음악실' 등
  fixedTime?: TimeSlot; // 고정 시간대
  preferredPeriods?: number[]; // 선호 교시 (예: [1, 2] - 오전 우선)
  avoidPeriods?: number[]; // 피해야 할 교시
  maxPerDay?: number; // 하루 최대 배정 횟수 (기본 1)
  difficulty?: 'high' | 'medium' | 'low'; // 난이도 (학생 피로도 고려)
  isLevelBased?: boolean; // 수준별 이동수업 여부
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
  isCoTeacher?: boolean; // 공동수업 가능 여부
  coTeachingSubjects?: string[]; // 공동수업 가능 과목
}

export interface Facility {
  id: string;
  name: string;
  type: 'regular' | 'lab' | 'computer' | 'music' | 'gym' | 'auditorium';
  capacity?: number; // 수용 인원
  floor?: number; // 층수 (이동 거리 계산용)
  building?: string; // 건물명
}

export interface CoTeaching {
  id: string;
  subjectId: string;
  mainTeacherId: string;
  coTeacherIds: string[];
  requiredRoom?: string; // 필요한 교실 ID
  classes: string[]; // 대상 학급 ID 목록
}

export interface LevelBasedClass {
  id: string;
  grade: number;
  level: string; // 'A', 'B', 'C' 등
  subjectId: string;
  teacherId: string;
  sourceClasses: string[]; // 원본 학급들
  period: TimeSlot;
}

export interface SpecialProgram {
  type: 'creative' | 'club' | 'assembly'; // 창체, 동아리, 집회
  name: string;
  grade?: number; // 학년 (전교면 undefined)
  day: Day;
  period: number;
  classes: string[]; // 참여 학급
  teachers?: string[]; // 담당 교사 (선택)
  requiredRoom?: string;
}

export interface TimetableSlot {
  classId: string;
  day: Day;
  period: number;
  subjectId: string | null;
  teacherId: string | null;
  facilityId?: string | null;
  isCoTeaching?: boolean;
  coTeacherIds?: string[];
  isLevelBased?: boolean;
  isSpecialProgram?: boolean;
  specialProgramType?: string;
}

export interface Timetable {
  [classId: string]: {
    [day in Day]: {
      [period: number]: TimetableSlot;
    };
  };
}

export interface TimetableData {
  schoolConfig: SchoolConfig;
  classes: Class[];
  subjects: Subject[];
  teachers: Teacher[];
  facilities: Facility[];
  coTeachings?: CoTeaching[];
  levelBasedClasses?: LevelBasedClass[];
  specialPrograms?: SpecialProgram[];
}

// 제약조건 평가 결과
export interface ConstraintResult {
  satisfied: boolean;
  severity: 'hard' | 'soft';
  message: string;
  details?: Record<string, any>;
  penalty?: number; // 소프트 제약조건 위반 시 페널티 점수
}

// 알고리즘 상태
export interface SchedulerState {
  timetable: Timetable;
  assignments: TimetableSlot[];
  unassigned: Array<{
    classId: string;
    subjectId: string;
    requiredHours: number;
  }>;
  domains: Map<string, TimeSlot[]>; // 변수별 가능한 시간대
  iteration: number;
  backtrackCount: number;
  violations: ConstraintResult[];
  score: number; // 현재 해의 점수
}

// 생성 결과
export interface GenerationResult {
  success: boolean;
  timetable: Timetable | null;
  teacherTimetables: Record<string, Timetable>;
  violations: ConstraintResult[];
  statistics: {
    totalIterations: number;
    totalBacktracks: number;
    generationTime: number;
    hardViolations: number;
    softViolations: number;
    finalScore: number;
  };
  logs: string[];
}
