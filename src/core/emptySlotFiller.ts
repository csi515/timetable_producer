import { Schedule, TimetableData, TeacherHoursTracker, Teacher, Subject } from '../types';
import { DAYS, getDefaultWeeklyHours, getCurrentSubjectHours } from '../utils/helpers';
import { checkTeacherUnavailable, validateSlotPlacement, checkSubjectFixedOnly, checkTeacherTimeConflict } from './constraints';
import { findAvailableTeachersForSubject } from './teacherAssignment';

// 빈 슬롯 채우기
export const fillEmptySlots = (
  schedule: Schedule,
  data: TimetableData,
  teacherHours: TeacherHoursTracker,
  addLog: (message: string, type?: string) => void
): number => {
  let filledSlots = 0;
  const subjects = data.subjects || [];
  const teachers = data.teachers || [];
  const defaultWeeklyHours = getDefaultWeeklyHours();

  Object.keys(schedule).forEach(className => {
    DAYS.forEach(day => {
      if (schedule[className] && schedule[className][day]) {
        Object.entries(schedule[className][day]).forEach(([periodStr, slot]) => {
          if (slot === '' || slot === undefined) {
            const period = parseInt(periodStr);
            
            // 빈 슬롯을 찾아서 더 적극적으로 채우기
            // 1단계: 시수가 부족한 과목들 먼저 시도
            let availableSubjects = subjects.filter(subject => {
              // 고정수업 전용 과목 제외
              if (checkSubjectFixedOnly(subject.name, data)) {
                return false;
              }
              
              const currentHours = getCurrentSubjectHours(schedule, className, subject.name);
              const targetHours = subject.weekly_hours || defaultWeeklyHours[subject.name] || 1;
              return currentHours < targetHours;
            });
            
            // 2단계: 1단계에서 배치 불가능하면 시수가 충족된 과목들도 시도 (추가 수업)
            if (availableSubjects.length === 0) {
              availableSubjects = subjects.filter(subject => {
                // 고정수업 전용 과목 제외
                if (checkSubjectFixedOnly(subject.name, data)) {
                  return false;
                }
                
                // 교사가 해당 학급을 담당하는 과목들
                const availableTeachers = findAvailableTeachersForSubject(teachers, subject.name, className, schedule, data);
                return availableTeachers.length > 0;
              });
            }

            if (availableSubjects.length > 0) {
              const subjectTeacherPairs: Array<{
                subject: Subject;
                teacher: Teacher;
                priority: number;
              }> = [];

              availableSubjects.forEach(subject => {
                const availableTeachers = findAvailableTeachersForSubject(teachers, subject.name, className, schedule, data);

                availableTeachers.forEach(teacher => {
                  const currentTeacherHours = teacherHours[teacher.name]?.current || 0;
                  const maxTeacherHours = teacherHours[teacher.name]?.max || 25;
                  const remainingTeacherHours = maxTeacherHours - currentTeacherHours;

                  let priority = 0;

                  // 공동수업 제약조건이 있는 교사는 우선순위를 낮춤
                  const coTeachingConstraints = (data.constraints?.must || []).filter(c =>
                    c.type === 'specific_teacher_co_teaching' && c.mainTeacher === teacher.name
                  );
                  if (coTeachingConstraints.length > 0) {
                    priority += 1000;
                  }

                  // 교사 시수 부족도 (부족할수록 우선)
                  priority += Math.max(0, 25 - remainingTeacherHours) * 100;

                  // 랜덤 요소
                  priority += Math.random() * 10;

                  subjectTeacherPairs.push({
                    subject,
                    teacher,
                    priority
                  });
                });
              });

              subjectTeacherPairs.sort((a, b) => a.priority - b.priority);

              if (subjectTeacherPairs.length > 0) {
                const selectedPair = subjectTeacherPairs[0];

                // 빈 슬롯 채우기 직전 수업 불가 시간 최종 확인
                const unavailableCheck = checkTeacherUnavailable(selectedPair.teacher, day, period);
                
                // 응급 모드: 80% 이상 채워졌으면 수업 불가 시간도 우회 (조건 완화)
                const totalSlots = Object.keys(schedule).reduce((total, cn) => {
                  return total + DAYS.reduce((dayTotal, d) => {
                    const periodsForDay = data.base?.periods_per_day?.[d] || 7;
                    return dayTotal + periodsForDay;
                  }, 0);
                }, 0);
                
                // 더 정확한 빈 슬롯 계산
                let emptySlots = 0;
                Object.keys(schedule).forEach(cn => {
                  DAYS.forEach(d => {
                    const periodsForDay = data.base?.periods_per_day?.[d] || 7;
                    for (let p = 0; p < periodsForDay; p++) {
                      if (!schedule[cn] || !schedule[cn][d] || !schedule[cn][d][p] || schedule[cn][d][p] === '') {
                        emptySlots++;
                      }
                    }
                  });
                });
                
                const currentFillRate = ((totalSlots - emptySlots) / totalSlots) * 100;
                const isEmergencyFill = currentFillRate >= 98; // 98%부터만 제한적 응급 모드
                
                if (!unavailableCheck.allowed && !isEmergencyFill) {
                  return;
                }

                // 🚨 교사 시간 충돌 검사 (절대 우회 불가능!)
                const conflictCheck = checkTeacherTimeConflict(schedule, selectedPair.teacher.name, day, period + 1, className);
                if (!conflictCheck.allowed) {
                  addLog(`🚨 빈 슬롯 채우기 - 교사 중복 방지: ${selectedPair.teacher.name} - ${conflictCheck.message}`, 'error');
                  return; // 절대 배치하지 않음
                }

                // 슬롯 배치 전 최종 중복 검증
                if (!validateSlotPlacement(schedule, className, day, period, selectedPair.teacher, selectedPair.subject.name, data, addLog)) {
                  return;
                }

                schedule[className][day][period] = {
                  subject: selectedPair.subject.name,
                  teachers: [selectedPair.teacher.name],
                  isCoTeaching: false,
                  isFixed: false
                };

                filledSlots++;

                // 시수 업데이트
                if (teacherHours[selectedPair.teacher.name]) {
                  teacherHours[selectedPair.teacher.name].current++;
                  teacherHours[selectedPair.teacher.name].subjects[selectedPair.subject.name] = 
                    (teacherHours[selectedPair.teacher.name].subjects[selectedPair.subject.name] || 0) + 1;
                }
              }
            }
          }
        });
      }
    });
  });

  addLog(`빈 슬롯 ${filledSlots}개를 채웠습니다.`, 'success');
  return filledSlots;
}; 