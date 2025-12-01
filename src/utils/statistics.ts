import { TimetableEntry, ClassInfo, ScheduleConfig } from '../types/timetable';
import { Teacher } from '../types/teacher';
import { Subject } from '../types/subject';
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
    classes: ClassInfo[]
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
    subjects: Subject[],
    classes: ClassInfo[],
    config: ScheduleConfig
): InputAnalysisResult {
    // 1. 교사별 부하량 분석
    // 주의: Subject 인터페이스에 teacherId가 없으므로, 
    // 실제 구현에서는 TimetableEntry 기반으로 계산해야 합니다.
    // 현재는 타입 안전성을 위해 빈 배열로 반환합니다.
    const teacherLoad = teachers.map(teacher => {
        // Subject가 teacherId를 가지지 않으므로, 
        // 실제 구현은 TimetableEntry를 통해 계산해야 합니다.
        const assignedHours = 0;
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
    // 주의: Subject 인터페이스에 classId가 없으므로,
    // 실제 구현에서는 다른 방식으로 관계를 파악해야 합니다.
    const classHours = classes.map(cls => {
        // Subject가 classId를 가지지 않으므로,
        // 0으로 초기화합니다.
        const requiredHours = 0;

        // 시간표상 가능한 총 시수
        let availableHours = 0;
        if (config.dailyMaxPeriods) {
            availableHours = config.days.reduce((sum: number, day: string) => {
                return sum + ((config.dailyMaxPeriods as Record<string, number>)[day] || config.maxPeriodsPerDay);
            }, 0);
        } else {
            availableHours = config.days.length * config.maxPeriodsPerDay;
        }

        let status: 'balanced' | 'lacking' | 'excess' = 'balanced';
        if (requiredHours > availableHours) status = 'excess';
        else if (requiredHours < availableHours - 5) status = 'lacking';

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
