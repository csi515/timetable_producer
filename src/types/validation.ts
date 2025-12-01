import { ConstraintViolation } from './constraints';
import { TimetableEntry } from './timetable';

// 시간표 통계
export interface TimetableStatistics {
    totalHours: number; // 전체 수업 시간
    averageHoursPerTeacher: number; // 교사당 평균 수업 시간
    averageHoursPerClass: number; // 학급당 평균 수업 시간
    teacherWorkload: TeacherWorkload[]; // 교사별 업무량
    classDistribution: ClassDistribution[]; // 학급별 분포
    constraintComplianceRate: number; // 제약조건 준수율 (0-100)
}

// 교사 업무량
export interface TeacherWorkload {
    teacherId: string;
    teacherName: string;
    totalHours: number; // 총 수업 시간
    dailyHours: { [day: string]: number }; // 요일별 시간
    subjectBreakdown: { [subjectId: string]: number }; // 과목별 시간
    utilizationRate: number; // 활용률 (0-100)
    isOverloaded: boolean; // 과부하 여부
    isUnderloaded: boolean; // 저활용 여부
}

// 학급 분포
export interface ClassDistribution {
    classId: string;
    className: string;
    totalHours: number; // 총 수업 시간
    subjectBreakdown: { [subjectId: string]: number }; // 과목별 시간
    emptySlots: number; // 빈 시간 수
    consecutiveHours: number; // 최대 연속 수업 시간
}

// 자동 수정 제안
export interface AutoFixSuggestion {
    id: string;
    type: 'redistribute' | 'swap' | 'adjust' | 'remove'; // 제안 타입
    priority: 'high' | 'medium' | 'low'; // 우선순위
    title: string; // 제안 제목
    description: string; // 상세 설명
    targetEntries: string[]; // 대상 Entry ID들
    expectedImprovement: string; // 예상 개선 효과
    autoApplicable: boolean; // 자동 적용 가능 여부
    action?: () => TimetableEntry[]; // 실행 함수
}

// 전체 검증 보고서
export interface ValidationReport {
    isValid: boolean; // 전체 유효성
    severity: 'none' | 'warning' | 'error' | 'critical'; // 심각도
    violations: ConstraintViolation[]; // 제약조건 위반 목록
    statistics: TimetableStatistics; // 통계
    suggestions: AutoFixSuggestion[]; // 자동 수정 제안
    summary: string; // 요약
    generatedAt: Date; // 생성 시간
}

// 시수 검증 결과
export interface HourValidationResult {
    isValid: boolean;
    classHours: { [classId: string]: number }; // 학급별 시수
    teacherHours: { [teacherId: string]: number }; // 교사별 시수
    expectedHours: { [classId: string]: number }; // 예상 시수
    discrepancies: HourDiscrepancy[]; // 불일치 항목
}

// 시수 불일치
export interface HourDiscrepancy {
    type: 'class' | 'teacher' | 'subject';
    id: string; // 학급/교사/과목 ID
    name: string;
    expected: number; // 예상 시수
    actual: number; // 실제 시수
    difference: number; // 차이
    severity: 'minor' | 'major' | 'critical';
}

// 교사 충돌 정보
export interface TeacherConflict {
    teacherId: string;
    teacherName: string;
    day: string;
    period: number;
    conflictingEntries: TimetableEntry[]; // 충돌하는 수업들
    type: 'overlap' | 'overload' | 'no_rest'; // 충돌 유형
}

// 검증 컨텍스트 (검증 시 필요한 전체 정보)
export interface ValidationContext {
    entries: TimetableEntry[];
    classes: any[]; // ClassInfo[]
    subjects: any[]; // Subject[]
    teachers: any[]; // Teacher[]
    config: any; // ScheduleConfig
}
