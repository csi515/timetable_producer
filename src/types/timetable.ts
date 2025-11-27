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
}

export interface ScheduleConfig {
  grade: number;
  numberOfClasses: number; // 학급 수
  days: string[]; // 요일 목록 (예: ["월", "화", "수", "목", "금"])
  maxPeriodsPerDay: number; // 1일 최대 교시
  lunchPeriod?: number; // 점심 시간 교시
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
}

export interface RelaxationSuggestion {
  level: 'low' | 'medium' | 'high';
  message: string;
  suggestion: string;
  affectedConstraints: string[];
}

