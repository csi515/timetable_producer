// 제약조건 엔진 유틸리티 함수

import { Slot, TimetableData, Day } from './types';

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
  if (!slot) return true;
  return !slot.subjectId || !slot.teacherId;
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
  return slot !== null && !isEmptySlot(slot);
}

/**
 * 특정 교실이 특정 시간에 사용 중인지 확인
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
 * 교사가 특정 날에 배정된 수업 수 계산
 */
export function countTeacherDailyLessons(
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
 * 교사가 주간에 배정된 총 수업 수 계산
 */
export function countTeacherWeeklyLessons(
  timetable: TimetableData,
  teacherId: string
): number {
  let count = 0;

  for (const day of timetable.schoolSchedule.days) {
    count += countTeacherDailyLessons(timetable, teacherId, day);
  }

  return count;
}

/**
 * 반에서 특정 과목이 특정 날에 배정된 횟수 계산
 */
export function countSubjectDailyLessons(
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
 * 반에서 특정 과목이 주간에 배정된 총 횟수 계산
 */
export function countSubjectWeeklyLessons(
  timetable: TimetableData,
  classId: string,
  subjectId: string
): number {
  let count = 0;

  for (const day of timetable.schoolSchedule.days) {
    count += countSubjectDailyLessons(timetable, classId, subjectId, day);
  }

  return count;
}

/**
 * 교사가 특정 반에서 특정 날에 연속으로 수업하는 교시 수 계산
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
