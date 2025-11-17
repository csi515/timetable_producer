// 제약조건 엔진 공통 유틸리티

import { TimetableData, Slot, Day, TimeSlot } from './types';

/**
 * 시간표에서 특정 슬롯 가져오기
 */
export function getSlot(
  timetable: TimetableData,
  classId: string,
  day: Day,
  period: number
): Slot | null {
  const classSchedule = timetable.timetable[classId];
  if (!classSchedule) return null;

  const daySchedule = classSchedule[day];
  if (!daySchedule) return null;

  return daySchedule[period] || null;
}

/**
 * 슬롯이 비어있는지 확인
 */
export function isEmptySlot(slot: Slot | null): boolean {
  return !slot || !slot.subjectId || !slot.teacherId;
}

/**
 * 특정 교사가 특정 시간에 배정되어 있는지 확인
 */
export function isTeacherAssignedAt(
  timetable: TimetableData,
  teacherId: string,
  day: Day,
  period: number,
  excludeClassId?: string
): boolean {
  for (const classId of Object.keys(timetable.timetable)) {
    if (excludeClassId && classId === excludeClassId) continue;

    const slot = getSlot(timetable, classId, day, period);
    if (slot && slot.teacherId === teacherId) {
      return true;
    }
  }
  return false;
}

/**
 * 특정 반이 특정 시간에 수업이 있는지 확인
 */
export function isClassOccupiedAt(
  timetable: TimetableData,
  classId: string,
  day: Day,
  period: number
): boolean {
  const slot = getSlot(timetable, classId, day, period);
  return !isEmptySlot(slot);
}

/**
 * 특정 교사가 특정 날에 배정된 수업 수 계산
 */
export function countDailyLessonsForTeacher(
  timetable: TimetableData,
  teacherId: string,
  day: Day
): number {
  let count = 0;

  for (const classId of Object.keys(timetable.timetable)) {
    const classSchedule = timetable.timetable[classId];
    const daySchedule = classSchedule[day];
    if (!daySchedule) continue;

    const maxPeriod = timetable.schoolSchedule.periodsPerDay[day];
    for (let period = 1; period <= maxPeriod; period++) {
      const slot = daySchedule[period];
      if (slot && slot.teacherId === teacherId) {
        count++;
      }
    }
  }

  return count;
}

/**
 * 특정 반에서 특정 과목이 특정 날에 배정된 횟수 계산
 */
export function countDailyLessonsForSubject(
  timetable: TimetableData,
  classId: string,
  subjectId: string,
  day: Day
): number {
  const classSchedule = timetable.timetable[classId];
  if (!classSchedule) return 0;

  const daySchedule = classSchedule[day];
  if (!daySchedule) return 0;

  let count = 0;
  const maxPeriod = timetable.schoolSchedule.periodsPerDay[day];

  for (let period = 1; period <= maxPeriod; period++) {
    const slot = daySchedule[period];
    if (slot && slot.subjectId === subjectId) {
      count++;
    }
  }

  return count;
}

/**
 * 특정 교사가 특정 반에서 특정 날에 연속으로 배정된 교시 수 계산
 */
export function countConsecutivePeriods(
  timetable: TimetableData,
  teacherId: string,
  classId: string,
  day: Day,
  period: number
): number {
  const classSchedule = timetable.timetable[classId];
  if (!classSchedule) return 0;

  const daySchedule = classSchedule[day];
  if (!daySchedule) return 0;

  let count = 0;
  const maxPeriod = timetable.schoolSchedule.periodsPerDay[day];

  // 앞쪽 연속 교시 확인
  for (let p = period - 1; p >= 1; p--) {
    const slot = daySchedule[p];
    if (slot && slot.teacherId === teacherId) {
      count++;
    } else {
      break;
    }
  }

  // 뒤쪽 연속 교시 확인
  for (let p = period + 1; p <= maxPeriod; p++) {
    const slot = daySchedule[p];
    if (slot && slot.teacherId === teacherId) {
      count++;
    } else {
      break;
    }
  }

  return count;
}

/**
 * 점심 시간 전에 특정 교사가 배정된 수업 수 계산
 */
export function countBeforeLunch(
  timetable: TimetableData,
  teacherId: string,
  day: Day,
  lunchPeriod: number
): number {
  let count = 0;

  for (const classId of Object.keys(timetable.timetable)) {
    const classSchedule = timetable.timetable[classId];
    const daySchedule = classSchedule[day];
    if (!daySchedule) continue;

    for (let period = 1; period <= lunchPeriod; period++) {
      const slot = daySchedule[period];
      if (slot && slot.teacherId === teacherId) {
        count++;
      }
    }
  }

  return count;
}

/**
 * 특정 교사가 주당 배정된 총 시수 계산
 */
export function countWeeklyHoursForTeacher(
  timetable: TimetableData,
  teacherId: string
): number {
  let count = 0;

  for (const classId of Object.keys(timetable.timetable)) {
    const classSchedule = timetable.timetable[classId];

    for (const day of timetable.schoolSchedule.days) {
      const daySchedule = classSchedule[day];
      if (!daySchedule) continue;

      const maxPeriod = timetable.schoolSchedule.periodsPerDay[day];
      for (let period = 1; period <= maxPeriod; period++) {
        const slot = daySchedule[period];
        if (slot && slot.teacherId === teacherId) {
          count++;
        }
      }
    }
  }

  return count;
}

/**
 * 특정 반에서 특정 과목이 주당 배정된 총 시수 계산
 */
export function countWeeklyHoursForSubject(
  timetable: TimetableData,
  classId: string,
  subjectId: string
): number {
  let count = 0;
  const classSchedule = timetable.timetable[classId];
  if (!classSchedule) return 0;

  for (const day of timetable.schoolSchedule.days) {
    const daySchedule = classSchedule[day];
    if (!daySchedule) continue;

    const maxPeriod = timetable.schoolSchedule.periodsPerDay[day];
    for (let period = 1; period <= maxPeriod; period++) {
      const slot = daySchedule[period];
      if (slot && slot.subjectId === subjectId) {
        count++;
      }
    }
  }

  return count;
}

/**
 * 특정 특별실이 특정 시간에 사용 중인지 확인
 */
export function isRoomOccupiedAt(
  timetable: TimetableData,
  roomId: string,
  day: Day,
  period: number,
  excludeClassId?: string
): boolean {
  for (const classId of Object.keys(timetable.timetable)) {
    if (excludeClassId && classId === excludeClassId) continue;

    const slot = getSlot(timetable, classId, day, period);
    if (slot && slot.roomId === roomId) {
      return true;
    }
  }
  return false;
}

/**
 * 시간 슬롯 비교
 */
export function compareTimeSlots(a: TimeSlot, b: TimeSlot): number {
  const dayOrder: Record<Day, number> = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5 };
  const dayDiff = dayOrder[a.day] - dayOrder[b.day];
  if (dayDiff !== 0) return dayDiff;
  return a.period - b.period;
}

/**
 * 두 교시가 연속인지 확인
 */
export function isConsecutivePeriod(
  day1: Day,
  period1: number,
  day2: Day,
  period2: number
): boolean {
  if (day1 !== day2) return false;
  return Math.abs(period1 - period2) === 1;
}
