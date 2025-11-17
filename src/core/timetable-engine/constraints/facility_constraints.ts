// 시설/공간 관련 제약조건

import { BaseConstraint } from './BaseConstraint';
import { TimetableSlot, TimetableData, ConstraintResult } from '../types';

/**
 * 특수 교실 중복 사용 금지 (Hard)
 */
export class FacilityConflictConstraint extends BaseConstraint {
  id = 'facility_conflict';
  name = '특수 교실 중복 사용 금지';
  type = 'hard' as const;
  priority = 9;

  checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult {
    if (!slot.subjectId || !slot.facilityId) return this.success();

    const subject = data.subjects.find(s => s.id === slot.subjectId);
    const facility = data.facilities.find(f => f.id === slot.facilityId);

    if (!subject?.requiresSpecialRoom || !facility) return this.success();

    // 같은 특수 교실을 같은 시간에 사용하는 다른 반이 있는지 확인
    const conflictingClass = this.findConflictingClass(
      timetable,
      slot.facilityId,
      slot.day,
      slot.period,
      slot.classId
    );

    if (conflictingClass) {
      return this.failure(
        `${facility.name}이(가) ${slot.day}요일 ${slot.period}교시에 이미 ${conflictingClass}에서 사용 중입니다.`,
        {
          facilityId: slot.facilityId,
          facilityName: facility.name,
          facilityType: facility.type,
          day: slot.day,
          period: slot.period,
          conflictingClass,
          subjectId: slot.subjectId,
          subjectName: subject.name,
        }
      );
    }

    return this.success();
  }

  validateTimetable(data: TimetableData, timetable: any): ConstraintResult[] {
    const violations: ConstraintResult[] = [];
    const facilityUsage: Record<string, Array<{ classId: string; day: string; period: number }>> = {};

    // 모든 특수 교실 사용 수집
    for (const classId of Object.keys(timetable)) {
      const classSchedule = timetable[classId];
      for (const day of data.schoolConfig.days) {
        const daySchedule = classSchedule[day];
        if (!daySchedule) continue;

        const maxPeriod = data.schoolConfig.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (this.isSlotEmpty(slot) || !slot.facilityId) continue;

          const key = `${slot.facilityId}_${day}_${period}`;
          if (!facilityUsage[key]) {
            facilityUsage[key] = [];
          }
          facilityUsage[key].push({ classId, day, period });
        }
      }
    }

    // 중복 확인
    for (const [key, classes] of Object.entries(facilityUsage)) {
      if (classes.length > 1) {
        const [facilityId, day, period] = key.split('_');
        const facility = data.facilities.find(f => f.id === facilityId);
        const classNames = classes.map(c => data.classes.find(cl => cl.id === c.classId)?.name || c.classId).join(', ');

        violations.push(this.failure(
          `${facility?.name || facilityId}이(가) ${day}요일 ${period}교시에 ${classes.length}개 반(${classNames})에서 중복 사용`,
          {
            facilityId,
            facilityName: facility?.name,
            facilityType: facility?.type,
            day,
            period: parseInt(period),
            conflictingClasses: classes.map(c => c.classId),
          }
        ));
      }
    }

    return violations;
  }

  private findConflictingClass(
    timetable: any,
    facilityId: string,
    day: string,
    period: number,
    excludeClassId: string
  ): string | null {
    for (const classId of Object.keys(timetable)) {
      if (classId === excludeClassId) continue;

      const slot = this.getSlot(timetable, classId, day, period);
      if (!this.isSlotEmpty(slot) && slot.facilityId === facilityId) {
        return classId;
      }
    }

    return null;
  }
}

/**
 * 이동 거리 최소화 (Soft)
 */
export class FacilityDistanceConstraint extends BaseConstraint {
  id = 'facility_distance';
  name = '교실 이동 거리 최소화';
  type = 'soft' as const;
  priority = 3;

  checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult {
    if (!slot.facilityId) return this.success();

    const facility = data.facilities.find(f => f.id === slot.facilityId);
    if (!facility || facility.type === 'regular') return this.success();

    // 이전 교시의 교실 확인
    const prevSlot = this.getSlot(timetable, slot.classId, slot.day, slot.period - 1);
    if (this.isSlotEmpty(prevSlot) || !prevSlot.facilityId) return this.success();

    const prevFacility = data.facilities.find(f => f.id === prevSlot.facilityId);
    if (!prevFacility) return this.success();

    // 같은 층/건물인지 확인
    const distance = this.calculateDistance(facility, prevFacility);
    if (distance > 0) {
      return this.failure(
        `${facility.name}과 이전 교시 교실(${prevFacility.name}) 간 이동 거리가 있습니다.`,
        {
          facilityId: slot.facilityId,
          facilityName: facility.name,
          prevFacilityId: prevSlot.facilityId,
          prevFacilityName: prevFacility.name,
          distance,
        },
        distance * 2 // 페널티: 거리 * 2
      );
    }

    return this.success();
  }

  validateTimetable(data: TimetableData, timetable: any): ConstraintResult[] {
    const violations: ConstraintResult[] = [];
    let totalDistance = 0;

    for (const classId of Object.keys(timetable)) {
      const classSchedule = timetable[classId];
      for (const day of data.schoolConfig.days) {
        const daySchedule = classSchedule[day];
        if (!daySchedule) continue;

        const maxPeriod = data.schoolConfig.periodsPerDay[day];
        for (let period = 2; period <= maxPeriod; period++) {
          const currentSlot = daySchedule[period];
          const prevSlot = daySchedule[period - 1];

          if (this.isSlotEmpty(currentSlot) || this.isSlotEmpty(prevSlot)) continue;
          if (!currentSlot.facilityId || !prevSlot.facilityId) continue;

          const currentFacility = data.facilities.find(f => f.id === currentSlot.facilityId);
          const prevFacility = data.facilities.find(f => f.id === prevSlot.facilityId);

          if (!currentFacility || !prevFacility) continue;

          const distance = this.calculateDistance(currentFacility, prevFacility);
          if (distance > 0) {
            totalDistance += distance;
            const classItem = data.classes.find(c => c.id === classId);
            violations.push(this.failure(
              `${classItem?.name || classId}이(가) ${day}요일 ${period - 1}-${period}교시에 ${prevFacility.name} → ${currentFacility.name} 이동 (거리: ${distance})`,
              {
                classId,
                className: classItem?.name,
                day,
                period,
                prevFacility: prevFacility.name,
                currentFacility: currentFacility.name,
                distance,
              },
              distance
            ));
          }
        }
      }
    }

    return violations;
  }

  private calculateDistance(facility1: any, facility2: any): number {
    // 같은 건물, 같은 층이면 거리 0
    if (facility1.building === facility2.building && facility1.floor === facility2.floor) {
      return 0;
    }

    // 다른 층이면 층 차이
    if (facility1.building === facility2.building && facility1.floor !== facility2.floor) {
      return Math.abs((facility1.floor || 0) - (facility2.floor || 0));
    }

    // 다른 건물이면 큰 페널티
    return 5;
  }
}
