import { Subject } from './subject';
import { Teacher } from './teacher';
import { ConstraintViolation } from './constraints';

export interface TimetableEntry {
  id: string;
  classId: string; // 학급 ID (예: "1학년-1반")
  subjectId: string; // 과목 ID
  teacherId: string; // 교사 ID (공동수업의 경우 여러 교사)
  teacherIds?: string[]; // 공동수업 시 여러 교사 ID
  day: string; // 요일
  period: number; // 교시
  roomId?: string; // 교실/특별실 ID
  isBlockClass: boolean; // 블록 수업 여부
  blockStartPeriod?: number; // 블록 수업 시작 교시
}

export interface ClassInfo {
  id: string;
  grade: number; // 학년
  classNumber: number; // 반
  name: string; // 표시명 (예: "1학년 1반")
  lunchPeriod?: number; // 점심시간 교시 (예: 4교시 후면 4)
}

export interface DailyScheduleConfig {
  days: string[]; // 수업 요일
  dailyMaxPeriods: { [day: string]: number }; // 요일별 최대 교시
}

export interface ScheduleConfig {
  grade: number; // 대표 학년 (기본값)
  numberOfClasses: number; // 대표 학급 수 (기본값)
  days: string[]; // 수업 요일 (기본값)
  maxPeriodsPerDay: number; // 전체 기본 최대 교시 (하위 호환성)
  dailyMaxPeriods?: { [day: string]: number }; // 요일별 최대 교시 (선택)
  lunchPeriod?: number; // 점심시간 교시 (선택, 기본값 4)

  // 학년별 설정 (신규)
  gradeConfigs?: {
    [grade: number]: DailyScheduleConfig;
  };
}

export interface ScheduleResult {
  entries: TimetableEntry[];
  classes: ClassInfo[];
  subjects: Subject[];
  teachers: Teacher[];
  violations: ConstraintViolation[];
  score: number; // 최적화 점수
  days?: string[]; // 요일 목록 (호환성을 위해 추가)
}


export interface MultipleScheduleResult {
  results: ScheduleResult[];
  selectedIndex?: number;
  generationAttempts: number;
  relaxationAttempts: number;
  canRelax: boolean;
  relaxationSuggestions?: RelaxationSuggestion[];
}

export interface RelaxationSuggestion {
  level: 'low' | 'medium' | 'high';
  message: string;
  suggestion: string;
  affectedConstraints: string[];
}

