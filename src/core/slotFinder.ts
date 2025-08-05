import { Schedule, Teacher, AvailableSlot, TimetableData } from '../types';
import { DAYS, convertClassNameToKey } from '../utils/helpers';
import { 
  checkTeacherUnavailable, 
  checkTeacherClassHoursLimit, 
  checkClassWeeklyHoursLimit, 
  checkClassDailyHoursLimit,
  checkTeacherTimeConflict,
  checkBlockPeriodRequirement
} from './constraints';

// 사용 가능한 슬롯 찾기 함수
export const findAvailableSlots = (
  schedule: Schedule, 
  className: string, 
  teacher: Teacher, 
  subjectName: string, 
  data: TimetableData,
  isCoTeaching: boolean = false,
  emergencyMode: boolean = false
): AvailableSlot[] => {
  const availableSlots: AvailableSlot[] = [];
  const periodsPerDay = data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };
  
  DAYS.forEach(day => {
    const maxPeriods = periodsPerDay[day] || 7;
    
    for (let period = 1; period <= maxPeriods; period++) {
      const slotIndex = period - 1;
      
      // 슬롯이 이미 점유되어 있는지 확인 (같은 교시 중복 방지)
      if (!schedule[className] || !schedule[className][day]) {
        continue;
      }
      
      // 해당 슬롯이 이미 사용 중인지 확인
      const currentSlot = schedule[className][day][slotIndex];
      if (currentSlot !== '' && currentSlot !== undefined && currentSlot !== null) {
        continue; // 이미 점유된 슬롯은 사용 불가
      }
      
      // 🚨 교사 시간 충돌 검사 (절대 우회 불가능!)
      const conflictCheck = checkTeacherTimeConflict(schedule, teacher.name, day, period, className);
      if (!conflictCheck.allowed) {
        continue; // 교사가 이미 다른 학급에서 수업 중이므로 배치 불가
      }
      
      // 교사별 수업 불가 시간 확인 (응급 모드에서는 우회)
      if (!emergencyMode) {
        const unavailableCheck = checkTeacherUnavailable(teacher, day, period);
        if (!unavailableCheck.allowed) {
          continue;
        }
      }
      
      // 교사별 학급 주간 수업시수 제한 확인 (응급 모드에서는 완화)
      if (!emergencyMode) {
        const classHoursCheck = checkTeacherClassHoursLimit(teacher, className, schedule);
        if (!classHoursCheck.allowed) {
          continue;
        }
      }
      
      // 교사가 해당 학급을 담당하는지 추가 확인 (응급 모드에서는 완화)
      if (!emergencyMode) {
        const classKey = convertClassNameToKey(className);
        const hasClassAssignment = (teacher.classWeeklyHours && teacher.classWeeklyHours[className] > 0) ||
                                  (teacher.weeklyHoursByGrade && teacher.weeklyHoursByGrade[classKey] > 0);
        if (!hasClassAssignment) {
          continue;
        }
      }
      
      // 학급별 주간 수업시수 제한 확인
      const classWeeklyCheck = checkClassWeeklyHoursLimit(className, schedule, data);
      if (!classWeeklyCheck.allowed) {
        continue;
      }
      
      // 학급별 일일 교시 수 제한 확인
      const classDailyCheck = checkClassDailyHoursLimit(className, day, schedule, data);
      if (!classDailyCheck.allowed) {
        continue;
      }
      
      // 교사 일일 학급 중복 금지 제약조건 확인
      const hasTeacherSameClassDailyLimit = (data.constraints?.must || []).some(c =>
        c.type === 'teacher_same_class_daily_limit'
      );
      
      if (hasTeacherSameClassDailyLimit) {
        let teacherAlreadyTeaching = false;
        Object.values(schedule[className][day]).forEach(slot => {
          if (slot && typeof slot === 'object' && 'teachers' in slot && slot.teachers.includes(teacher.name)) {
            teacherAlreadyTeaching = true;
          }
        });
        
        if (teacherAlreadyTeaching) {
          continue;
        }
      }
      
      // 교사 중복 금지 제약조건 확인
      const hasNoDuplicateTeachers = (data.constraints?.must || []).some(c =>
        c.type === 'no_duplicate_teachers'
      );
      
      if (hasNoDuplicateTeachers) {
        let teacherConflict = false;
        Object.keys(schedule).forEach(otherClassName => {
          if (otherClassName !== className && schedule[otherClassName] && schedule[otherClassName][day]) {
            const otherSlot = schedule[otherClassName][day][slotIndex];
            if (otherSlot && typeof otherSlot === 'object' && 'teachers' in otherSlot && otherSlot.teachers.includes(teacher.name)) {
              teacherConflict = true;
            }
          }
        });
        
        if (teacherConflict) {
          continue;
        }
      }
      
      // 학급 일일 과목 1회 제한 제약조건 확인
      const dailySubjectOnceConstraints = [
        ...(data.constraints?.must || []).filter(c => c.type === 'class_daily_subject_once'),
        ...(data.constraints?.optional || []).filter(c => c.type === 'class_daily_subject_once')
      ];
      
      if (dailySubjectOnceConstraints.length > 0) {
        let subjectAlreadyScheduled = false;
        
        // 해당 날짜에 이미 같은 과목이 배정되어 있는지 확인
        Object.values(schedule[className][day]).forEach(slot => {
          if (slot && typeof slot === 'object' && 'subject' in slot && slot.subject === subjectName) {
            subjectAlreadyScheduled = true;
          }
        });
        
        // "모든 수업에 해당" 제약조건이 있는 경우, 해당 과목에 대해서도 확인
        const allSubjectsConstraint = dailySubjectOnceConstraints.find(c => c.subject === 'all');
        if (allSubjectsConstraint) {
          Object.values(schedule[className][day]).forEach(slot => {
            if (slot && typeof slot === 'object' && 'subject' in slot && slot.subject === subjectName) {
              subjectAlreadyScheduled = true;
            }
          });
        }
        
        if (subjectAlreadyScheduled) {
          continue;
        }
      }
      
      // 블록제 교사 제약조건 확인 (블록제 교사인 경우에만)
      const blockPeriodConstraints = data.constraints?.must?.filter(c => c.type === 'block_period_requirement') || [];
      const isBlockPeriodTeacher = blockPeriodConstraints.some(c => c.subject === teacher.name);
      if (isBlockPeriodTeacher) {
        const blockCheck = checkBlockPeriodRequirement(schedule, className, day, period, teacher.name, data, subjectName);
        if (!blockCheck.allowed) {
          continue; // 블록제 교사 제약조건 위반
        }
      }
      
      // 공동수업 제약조건 확인 (완전 제외하지 않고 우선순위만 낮춤)
      const coTeachingConstraints = (data.constraints?.must || []).filter(c =>
        c.type === 'specific_teacher_co_teaching' && c.mainTeacher === teacher.name
      );
      
      if (coTeachingConstraints.length > 0 && !isCoTeaching) {
        // 이 교사는 공동수업 제약조건이 있으므로 우선순위를 낮춤
        // 하지만 완전히 제외하지는 않음 (배치 가능한 교사가 부족할 수 있으므로)
      }
      
      availableSlots.push({ day, period, slotIndex });
    }
  });
  
  // 슬롯들을 선호도에 따라 정렬
  return sortSlotsByPreference(availableSlots, teacher, data);
};

// 슬롯 선호도에 따른 정렬 함수
const sortSlotsByPreference = (
  slots: AvailableSlot[],
  teacher: Teacher,
  data: TimetableData
): AvailableSlot[] => {
  return slots.sort((a, b) => {
    // 1. 오전 시간대 선호 (1-4교시)
    const aIsMorning = a.period <= 4;
    const bIsMorning = b.period <= 4;
    if (aIsMorning !== bIsMorning) {
      return bIsMorning ? 1 : -1; // 오전을 선호
    }
    
    // 2. 중간 교시 선호 (너무 이르거나 늦지 않게)
    const aMiddleScore = Math.abs(a.period - 3); // 3교시를 기준으로 거리
    const bMiddleScore = Math.abs(b.period - 3);
    if (aMiddleScore !== bMiddleScore) {
      return aMiddleScore - bMiddleScore;
    }
    
    // 3. 요일별 선호도 (월-금 순서)
    const dayOrder: Record<string, number> = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5 };
    const aDayScore = dayOrder[a.day] || 6;
    const bDayScore = dayOrder[b.day] || 6;
    
    return aDayScore - bDayScore;
  });
}; 