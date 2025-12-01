import { Constraint, ConstraintType, SoftConstraint } from '../types/constraints';
import { TimetableEntry } from '../types/timetable';
import { Subject } from '../types/subject';
import { Teacher } from '../types/teacher';

// Critical 제약조건들
export const criticalConstraints: Constraint[] = [
  {
    type: ConstraintType.CRITICAL,
    name: '교사 중복 방지',
    check: (entry, allEntries, subjects, teachers) => {
      const teacherIds = entry.teacherIds || [entry.teacherId];
      const sameTimeEntries = allEntries.filter(
        e => e.day === entry.day && e.period === entry.period && e.id !== entry.id
      );

      for (const otherEntry of sameTimeEntries) {
        const otherTeacherIds = otherEntry.teacherIds || [otherEntry.teacherId];
        if (teacherIds.some(id => otherTeacherIds.includes(id))) {
          return false; // 같은 교사가 같은 시간에 중복
        }
      }
      return true;
    },
    message: (entry) => `교사가 ${entry.day}요일 ${entry.period}교시에 중복 배정됨`
  },
  {
    type: ConstraintType.CRITICAL,
    name: '교사 불가능 시간 체크',
    check: (entry, allEntries, subjects, teachers) => {
      const teacher = teachers.find(t => t.id === entry.teacherId);
      if (!teacher) return true;

      const teacherIds = entry.teacherIds || [entry.teacherId];
      for (const teacherId of teacherIds) {
        const t = teachers.find(te => te.id === teacherId);
        if (t) {
          const isUnavailable = t.unavailableTimes.some(
            ut => ut.day === entry.day && ut.period === entry.period
          );
          if (isUnavailable) return false;
        }
      }
      return true;
    },
    message: (entry) => `교사가 ${entry.day}요일 ${entry.period}교시에 불가능한 시간에 배정됨`
  },
  {
    type: ConstraintType.CRITICAL,
    name: '특별실 충돌 방지',
    check: (entry, allEntries, subjects, teachers) => {
      if (!entry.roomId) return true; // 일반 교실은 충돌 없음

      const subject = subjects.find(s => s.id === entry.subjectId);
      if (!subject || !subject.requiresSpecialRoom) return true;

      const conflictingEntries = allEntries.filter(
        e => e.id !== entry.id &&
          e.roomId === entry.roomId &&
          e.day === entry.day &&
          e.period === entry.period
      );

      return conflictingEntries.length === 0;
    },
    message: (entry) => `특별실이 ${entry.day}요일 ${entry.period}교시에 중복 사용됨`
  },
  {
    type: ConstraintType.CRITICAL,
    name: '블록 수업 연속 시간 보장',
    check: (entry, allEntries, subjects, teachers) => {
      if (!entry.isBlockClass || !entry.blockStartPeriod) return true;

      const subject = subjects.find(s => s.id === entry.subjectId);
      if (!subject || !subject.blockHours) return true;

      const requiredPeriods = subject.blockHours;
      const startPeriod = entry.blockStartPeriod;

      // 연속된 교시에 모두 배정되어 있는지 확인
      for (let i = 0; i < requiredPeriods; i++) {
        const period = startPeriod + i;
        const exists = allEntries.some(
          e => e.id === entry.id ||
            (e.classId === entry.classId &&
              e.day === entry.day &&
              e.period === period &&
              e.subjectId === entry.subjectId)
        );
        if (!exists) return false;
      }

      return true;
    },
    message: (entry) => `블록 수업이 연속된 교시에 배정되지 않음`
  }
];

// High 제약조건들
export const highConstraints: Constraint[] = [
  {
    type: ConstraintType.HIGH,
    name: '시수 충족 검증',
    check: (entry, allEntries, subjects, teachers) => {
      // 이 제약조건은 전체 검증에서 확인 (개별 entry 체크 불가)
      return true;
    },
    message: (entry) => `과목의 주간 시수가 충족되지 않음`
  },
  {
    type: ConstraintType.HIGH,
    name: '우선 배치 교사 일정 충돌',
    check: (entry, allEntries, subjects, teachers) => {
      const teacher = teachers.find(t => t.id === entry.teacherId);
      if (!teacher || !teacher.isPriority) return true;

      // 우선 배치 교사의 다른 수업과의 충돌 체크는 critical에서 이미 처리
      return true;
    },
    message: (entry) => `우선 배치 교사의 일정이 충돌함`
  },
  {
    type: ConstraintType.HIGH,
    name: '외부 강사 하루 몰아넣기',
    check: (entry, allEntries, subjects, teachers) => {
      const subject = subjects.find(s => s.id === entry.subjectId);
      if (!subject || !subject.isExternalInstructor || !subject.preferConcentrated) {
        return true;
      }

      // 외부 강사의 모든 수업이 같은 날에 있는지 확인
      const teacher = teachers.find(t => t.id === entry.teacherId);
      if (!teacher || !teacher.isExternal) return true;

      const allTeacherEntries = allEntries.filter(
        e => (e.teacherIds || [e.teacherId]).includes(entry.teacherId)
      );

      if (allTeacherEntries.length === 0) return true;

      const days = new Set(allTeacherEntries.map(e => e.day));
      return days.size === 1; // 모든 수업이 같은 날에 있어야 함
    },
    message: (entry) => `외부 강사의 수업이 하루에 몰아서 배치되지 않음`
  },
  {
    type: ConstraintType.HIGH,
    name: '교사 하루 최대 시수 준수',
    check: (entry, allEntries, subjects, teachers) => {
      const teacherIds = entry.teacherIds || [entry.teacherId];

      for (const teacherId of teacherIds) {
        const teacher = teachers.find(t => t.id === teacherId);
        if (!teacher) continue;

        // maxDailyHours가 설정되어 있으면 확인 (기본값: 6)
        const maxDailyHours = teacher.maxDailyHours || 6;

        // 같은 날 해당 교사의 총 수업 시간 계산
        const sameDayEntries = allEntries.filter(e =>
          e.day === entry.day &&
          (e.teacherId === teacherId || (e.teacherIds && e.teacherIds.includes(teacherId)))
        );

        if (sameDayEntries.length > maxDailyHours) {
          return false;
        }
      }

      return true;
    },
    message: (entry) => {
      const teacher = entry.teacherId; // simplified
      return `교사가 ${entry.day}요일에 하루 최대 시수를 초과함`;
    }
  }
];

// Medium 제약조건들
export const mediumConstraints: Constraint[] = [
  {
    type: ConstraintType.MEDIUM,
    name: '연속 3교시 이상 금지',
    check: (entry, allEntries, subjects, teachers) => {
      const teacherIds = entry.teacherIds || [entry.teacherId];
      const subject = subjects.find(s => s.id === entry.subjectId);

      // 블록 수업은 예외
      if (subject?.isBlockClass) return true;

      // 같은 교사의 연속 수업 체크
      for (const teacherId of teacherIds) {
        const sameDayEntries = allEntries.filter(
          e => (e.teacherIds || [e.teacherId]).includes(teacherId) &&
            e.day === entry.day &&
            e.id !== entry.id
        ).sort((a, b) => a.period - b.period);

        // 연속된 교시가 3개 이상인지 확인
        let consecutiveCount = 1;
        for (let i = 0; i < sameDayEntries.length; i++) {
          if (sameDayEntries[i].period === entry.period - 1 ||
            sameDayEntries[i].period === entry.period + 1) {
            consecutiveCount++;
          }
        }

        if (consecutiveCount >= 3) return false;
      }

      return true;
    },
    message: (entry) => `같은 교사가 연속 3교시 이상 배정됨`
  },
  {
    type: ConstraintType.MEDIUM,
    name: '점심 전 몰빵 방지',
    check: (entry, allEntries, subjects, teachers) => {
      // 점심 시간 전에 너무 많은 수업이 몰려있는지 체크
      // 이는 전체 검증에서 확인 (개별 entry 체크 불가)
      return true;
    },
    message: (entry) => `점심 전에 수업이 너무 몰려있음`
  },
  {
    type: ConstraintType.MEDIUM,
    name: '학년 적합성 검증',
    check: (entry, allEntries, subjects, teachers) => {
      const subject = subjects.find(s => s.id === entry.subjectId);
      if (!subject || !subject.gradeSuitability || subject.gradeSuitability.length === 0) {
        return true; // 제한 없음
      }

      // 학급 ID에서 학년 추출 (예: "1-1" -> 1)
      // 실제 구현은 프로젝트의 학급 ID 형식에 따라 조정 필요
      const classIdParts = entry.classId.split('-');
      if (classIdParts.length > 0) {
        const grade = parseInt(classIdParts[0]);
        if (!isNaN(grade)) {
          return subject.gradeSuitability.includes(grade);
        }
      }

      return true; // 학년 파싱 실패 시 통과
    },
    message: (entry) => `과목이 해당 학년에 적합하지 않음`
  }
];

// Low 제약조건들 (Soft Constraint로 처리)
export const lowConstraints: Constraint[] = [
  {
    type: ConstraintType.LOW,
    name: '선호 패턴 반영',
    check: (entry, allEntries, subjects, teachers) => {
      // 항상 통과 (soft constraint로 처리)
      return true;
    },
    message: (entry) => `선호 패턴과 일치하지 않음`
  }
];

// Soft Constraints (최적화 점수 계산용)
export const softConstraints: SoftConstraint[] = [
  {
    name: '이동 최소화',
    weight: 1.0,
    evaluate: (entries, subjects, teachers) => {
      // 같은 날 같은 교사가 다른 교실로 이동하는 횟수 계산
      let moveCount = 0;
      const teacherDays = new Map<string, Map<string, Set<string>>>();

      for (const entry of entries) {
        const teacherIds = entry.teacherIds || [entry.teacherId];
        for (const teacherId of teacherIds) {
          if (!teacherDays.has(teacherId)) {
            teacherDays.set(teacherId, new Map());
          }
          const dayMap = teacherDays.get(teacherId)!;
          if (!dayMap.has(entry.day)) {
            dayMap.set(entry.day, new Set());
          }
          dayMap.get(entry.day)!.add(entry.roomId || 'default');
        }
      }

      // 각 교사-날짜별로 교실 종류 수를 세어 이동 횟수 계산
      for (const [teacherId, dayMap] of teacherDays) {
        for (const [day, rooms] of dayMap) {
          moveCount += Math.max(0, rooms.size - 1);
        }
      }

      return moveCount;
    }
  },
  {
    name: '연속 3교시 이상 방지',
    weight: 2.0,
    evaluate: (entries, subjects, teachers) => {
      let violationCount = 0;
      const teacherDays = new Map<string, Map<string, number[]>>();

      for (const entry of entries) {
        const teacherIds = entry.teacherIds || [entry.teacherId];
        const subject = subjects.find(s => s.id === entry.subjectId);

        // 블록 수업은 제외
        if (subject?.isBlockClass) continue;

        for (const teacherId of teacherIds) {
          if (!teacherDays.has(teacherId)) {
            teacherDays.set(teacherId, new Map());
          }
          const dayMap = teacherDays.get(teacherId)!;
          if (!dayMap.has(entry.day)) {
            dayMap.set(entry.day, []);
          }
          dayMap.get(entry.day)!.push(entry.period);
        }
      }

      // 연속된 교시가 3개 이상인지 확인
      for (const [teacherId, dayMap] of teacherDays) {
        for (const [day, periods] of dayMap) {
          const sorted = periods.sort((a, b) => a - b);
          for (let i = 0; i < sorted.length - 2; i++) {
            if (sorted[i + 1] === sorted[i] + 1 && sorted[i + 2] === sorted[i] + 2) {
              violationCount++;
            }
          }
        }
      }

      return violationCount;
    }
  },
  {
    name: '점심 전 몰빵 방지',
    weight: 1.5,
    evaluate: (entries, subjects, teachers, classes) => {
      // 각 학급별로 점심 전 교시에 수업이 몰려있는지 확인
      const classDays = new Map<string, Map<string, number>>();

      for (const entry of entries) {
        const key = `${entry.classId}-${entry.day}`;
        if (!classDays.has(key)) {
          classDays.set(key, new Map());
        }
        const periods = classDays.get(key)!;
        periods.set(entry.period.toString(), (periods.get(entry.period.toString()) || 0) + 1);
      }

      let concentrationScore = 0;
      // 점심 전 교시(1-4교시)에 수업이 몰려있는지 확인
      for (const [key, periods] of classDays) {
        const classId = key.split('-')[0] + '-' + key.split('-')[1]; // "1학년-1반-월" -> "1학년-1반"
        // classId 파싱이 좀 복잡할 수 있으니 entry.classId를 직접 map key로 쓰는게 나았을 수도 있음.
        // 하지만 key는 "classId-day" 형태임.
        // classId 추출: key의 마지막 "-" 앞부분
        const lastDashIndex = key.lastIndexOf('-');
        const realClassId = key.substring(0, lastDashIndex);

        const classInfo = classes?.find(c => c.id === realClassId);
        const lunchPeriod = classInfo?.lunchPeriod || 4; // 기본값 4

        const morningPeriods = Array.from(periods.keys())
          .map(p => parseInt(p))
          .filter(p => p <= lunchPeriod);

        // 점심 전 교시가 4교시 이상이면 (점심시간 포함) 꽉 찬 것으로 간주?
        // 보통 점심 전 4교시까지 풀로 차있는걸 피하고 싶어함?
        // 아니면 4교시 연속 수업을 피하고 싶은건가?
        // "몰빵"은 보통 연속 수업이나 하루 집중을 의미하는데, 여기서는 점심 전 집중도를 보는 듯.
        // 점심 전 교시 수 - 3 만큼 벌점 부여 (즉 4교시 꽉 차면 1점 벌점)
        if (morningPeriods.length > 3) {
          concentrationScore += morningPeriods.length - 3;
        }
      }

      return concentrationScore;
    }
  }
];

