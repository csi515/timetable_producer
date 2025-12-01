import { TimetableEntry } from '../types/timetable';
import { Teacher } from '../types/teacher';
import { TeacherWorkload, ClassDistribution } from '../types/validation';

/**
 * 교사별 업무량 계산
 */
export function calculateTeacherWorkload(
    entries: TimetableEntry[],
    teachers: Teacher[]
): TeacherWorkload[] {
    return teachers.map(teacher => {
        const teacherEntries = entries.filter(e =>
            e.teacherId === teacher.id ||
            (e.teacherIds && e.teacherIds.includes(teacher.id))
        );

        const totalHours = teacherEntries.length;

        // 요일별 시간
        const dailyHours: { [day: string]: number } = {};
        teacherEntries.forEach(entry => {
            dailyHours[entry.day] = (dailyHours[entry.day] || 0) + 1;
        });

        // 과목별 시간
        const subjectBreakdown: { [subjectId: string]: number } = {};
        teacherEntries.forEach(entry => {
            subjectBreakdown[entry.subjectId] = (subjectBreakdown[entry.subjectId] || 0) + 1;
        });

        // 활용률
        const utilizationRate = teacher.maxWeeklyHours > 0
            ? (totalHours / teacher.maxWeeklyHours) * 100
            : 0;

        return {
            teacherId: teacher.id,
            teacherName: teacher.name,
            totalHours,
            dailyHours,
            subjectBreakdown,
            utilizationRate,
            isOverloaded: totalHours > teacher.maxWeeklyHours,
            isUnderloaded: totalHours < teacher.maxWeeklyHours * 0.7
        };
    });
}

/**
 * 학급별 분포 계산
 */
export function calculateClassDistribution(
    entries: TimetableEntry[],
    classes: any[]
): ClassDistribution[] {
    return classes.map(cls => {
        const classEntries = entries.filter(e => e.classId === cls.id);

        const totalHours = classEntries.length;

        // 과목별 시간
        const subjectBreakdown: { [subjectId: string]: number } = {};
        classEntries.forEach(entry => {
            subjectBreakdown[entry.subjectId] = (subjectBreakdown[entry.subjectId] || 0) + 1;
        });

        const totalSlots = 5 * 7; // 주 5일, 하루 7교시
        const emptySlots = totalSlots - totalHours;

        // 최대 연속 수업 시간
        let maxConsecutive = 0;
        const days = ['월', '화', '수', '목', '금'];

        days.forEach(day => {
            const dayEntries = classEntries
                .filter(e => e.day === day)
                .map(e => e.period)
                .sort((a, b) => a - b);

            let current = 1;
            for (let i = 1; i < dayEntries.length; i++) {
                if (dayEntries[i] === dayEntries[i - 1] + 1) {
                    current++;
                    maxConsecutive = Math.max(maxConsecutive, current);
                } else {
                    current = 1;
                }
            }
        });

        return {
            classId: cls.id,
            className: cls.name,
            totalHours,
            subjectBreakdown,
            emptySlots,
            consecutiveHours: maxConsecutive
        };
    });
}

/**
 * 교사 하루 최대 시수 검증
 */
export function validateDailyHours(
    entries: TimetableEntry[],
    teachers: Teacher[]
): { teacherId: string; day: string; actual: number; max: number }[] {
    const violations: { teacherId: string; day: string; actual: number; max: number }[] = [];
    const days = ['월', '화', '수', '목', '금'];

    teachers.forEach(teacher => {
        const maxDailyHours = teacher.maxDailyHours || 6;

        days.forEach(day => {
            const dailyCount = entries.filter(e =>
                e.day === day && (
                    e.teacherId === teacher.id ||
                    (e.teacherIds && e.teacherIds.includes(teacher.id))
                )
            ).length;

            if (dailyCount > maxDailyHours) {
                violations.push({
                    teacherId: teacher.id,
                    day,
                    actual: dailyCount,
                    max: maxDailyHours
                });
            }
        });
    });

    return violations;
}

/**
 * 입력 데이터 분석 결과 인터페이스
 */
export interface InputAnalysisResult {
    teacherLoad: {
        teacherId: string;
        teacherName: string;
        assignedHours: number; // 담당 과목들의 총 시수
        maxHours: number; // 교사의 최대 시수
        loadRate: number; // 부하율 (%)
        status: 'optimal' | 'heavy' | 'overloaded' | 'underloaded';
    }[];
    classHours: {
        classId: string;
        className: string;
        requiredHours: number; // 필요한 총 시수
        availableHours: number; // 시간표상 가능한 총 시수
        status: 'balanced' | 'lacking' | 'excess';
    }[];
    totalStats: {
        totalRequired: number;
        totalCapacity: number;
        balanceRate: number;
    };
}

/**
 * 입력 데이터 분석 (시간표 생성 전)
 */
export function analyzeInputData(
    teachers: Teacher[],
    subjects: any[], // Subject 타입이지만 순환 참조 방지를 위해 any 사용 가능 또는 타입 import 필요
    classes: any[],
    config: any
): InputAnalysisResult {
    // 1. 교사별 부하량 분석
    const teacherLoad = teachers.map(teacher => {
        // 해당 교사가 담당하는 과목들의 시수 합계 계산
        // 주: 공동 수업의 경우 단순 합산 (보수적 접근)
        const assignedHours = subjects
            .filter(s => s.teacherId === teacher.id || (s.teacherIds && s.teacherIds.includes(teacher.id)))
            .reduce((sum, s) => {
                // 과목 시수 * 해당 과목을 듣는 학급 수
                // Subject 타입에 따라 다를 수 있음. 보통 Subject는 특정 학급에 매핑됨.
                // 만약 Subject가 여러 반을 대상으로 한다면 로직 조정 필요.
                // 현재 구조상 Subject 하나는 특정 반 또는 여러 반에 할당될 수 있음.
                return sum + s.weeklyHours;
            }, 0);

        const maxHours = teacher.maxWeeklyHours;
        const loadRate = maxHours > 0 ? (assignedHours / maxHours) * 100 : 0;

        let status: 'optimal' | 'heavy' | 'overloaded' | 'underloaded' = 'optimal';
        if (loadRate > 100) status = 'overloaded';
        else if (loadRate > 90) status = 'heavy';
        else if (loadRate < 50) status = 'underloaded';

        return {
            teacherId: teacher.id,
            teacherName: teacher.name,
            assignedHours,
            maxHours,
            loadRate,
            status
        };
    });

    // 2. 학급별 시수 분석
    const classHours = classes.map(cls => {
        // 이 학급이 들어야 하는 과목들의 총 시수
        const requiredHours = subjects
            .filter(s => s.classId === cls.id || (s.classIds && s.classIds.includes(cls.id)))
            .reduce((sum, s) => sum + s.weeklyHours, 0);

        // 시간표상 가능한 총 시수 (일주일 수업 가능 시간)
        // config.days.length * config.maxPeriodsPerDay (단순 계산)
        // 요일별 설정이 있다면 그것을 반영
        let availableHours = 0;
        if (config.dailyMaxPeriods) {
            availableHours = config.days.reduce((sum: number, day: string) => {
                return sum + (config.dailyMaxPeriods[day] || config.maxPeriodsPerDay);
            }, 0);
        } else {
            availableHours = config.days.length * config.maxPeriodsPerDay;
        }

        let status: 'balanced' | 'lacking' | 'excess' = 'balanced';
        if (requiredHours > availableHours) status = 'excess'; // 시간이 부족함 (수업이 너무 많음)
        else if (requiredHours < availableHours - 5) status = 'lacking'; // 시간이 너무 많이 남음

        return {
            classId: cls.id,
            className: cls.name,
            requiredHours,
            availableHours,
            status
        };
    });

    // 3. 전체 통계
    const totalRequired = classHours.reduce((sum, c) => sum + c.requiredHours, 0);
    const totalCapacity = teacherLoad.reduce((sum, t) => sum + t.maxHours, 0);
    const balanceRate = totalCapacity > 0 ? (totalRequired / totalCapacity) * 100 : 0;

    return {
        teacherLoad,
        classHours,
        totalStats: {
            totalRequired,
            totalCapacity,
            balanceRate
        }
    };
}
