import { Schedule, TimetableData, TeacherHoursTracker, Teacher, Subject } from '../types';
import { DAYS } from '../utils/helpers';

/**
 * 응급모드: 모든 제약조건을 무시하고 100% 채움률 달성
 * @param schedule 현재 스케줄
 * @param data 시간표 데이터
 * @param teacherHours 교사 시수 추적기
 * @param addLog 로그 추가 함수
 * @returns 추가로 배치된 슬롯 수
 */
export const emergencyFillAllSlots = async (
  schedule: Schedule,
  data: TimetableData,
  teacherHours: TeacherHoursTracker,
  addLog: (message: string, type?: string) => void
): Promise<number> => {
  let filledSlots = 0;
  const teachers = data.teachers || [];
  const subjects = data.subjects || [];
  
  addLog('🚨 응급모드: 빈 슬롯 전체 스캔 시작', 'warning');
  
  // 1단계: 모든 빈 슬롯 찾기
  const emptySlots: Array<{className: string, day: string, period: number}> = [];
  
  Object.keys(schedule).forEach(className => {
    DAYS.forEach(day => {
      const periodsForDay = data.base?.periods_per_day?.[day] || 7;
      for (let period = 0; period < periodsForDay; period++) {
        if (!schedule[className] || !schedule[className][day] || !schedule[className][day][period] || schedule[className][day][period] === '') {
          emptySlots.push({ className, day, period: period + 1 });
        }
      }
    });
  });
  
  addLog(`🔍 발견된 빈 슬롯: ${emptySlots.length}개`, 'info');
  
  // 2단계: 과목별 교사 매핑 생성
  const subjectTeacherMap: { [subjectName: string]: Teacher[] } = {};
  subjects.forEach(subject => {
    if (subject && subject.name) {
      subjectTeacherMap[subject.name] = teachers.filter(teacher => 
        teacher.subjects && teacher.subjects.includes(subject.name)
      );
    }
  });
  
  // 3단계: 응급모드 배치 (모든 제약조건 무시)
  for (const emptySlot of emptySlots) {
    const { className, day, period } = emptySlot;
    let placed = false;
    
    // 가능한 모든 과목 시도
    for (const subject of subjects) {
      if (!subject || !subject.name) continue;
      
      const availableTeachers = subjectTeacherMap[subject.name] || [];
      
      for (const teacher of availableTeachers) {
        // 응급모드: 교사 중복 검사만 수행 (다른 제약조건 무시)
        const hasConflict = checkEmergencyTeacherConflict(schedule, teacher.name, day, period, className);
        
        if (!hasConflict) {
          // 강제 배치
          if (!schedule[className]) schedule[className] = {};
          if (!schedule[className][day]) schedule[className][day] = {};
          
          schedule[className][day][period - 1] = {
            subject: subject.name,
            teachers: [teacher.name],
            isCoTeaching: false,
            isFixed: false,
            source: 'emergency'
          };
          
          // 교사 시수 업데이트
          if (teacherHours[teacher.name]) {
            teacherHours[teacher.name].current++;
            if (teacherHours[teacher.name].subjects[subject.name]) {
              teacherHours[teacher.name].subjects[subject.name]++;
            } else {
              teacherHours[teacher.name].subjects[subject.name] = 1;
            }
          }
          
          filledSlots++;
          placed = true;
          
          addLog(`🚨 응급배치: ${className} ${day} ${period}교시 - ${subject.name} (${teacher.name})`, 'warning');
          break;
        }
      }
      
      if (placed) break;
    }
    
    // 과목별 교사가 없으면 아무 교사나 배치
    if (!placed && teachers.length > 0) {
      for (const teacher of teachers) {
        const hasConflict = checkEmergencyTeacherConflict(schedule, teacher.name, day, period, className);
        
        if (!hasConflict) {
          // 교사가 가르칠 수 있는 첫 번째 과목으로 배치
          const teacherSubjects = teacher.subjects || [];
          const subjectName = teacherSubjects.length > 0 ? teacherSubjects[0] : '기타';
          
          if (!schedule[className]) schedule[className] = {};
          if (!schedule[className][day]) schedule[className][day] = {};
          
          schedule[className][day][period - 1] = {
            subject: subjectName,
            teachers: [teacher.name],
            isCoTeaching: false,
            isFixed: false,
            source: 'emergency_fallback'
          };
          
          // 교사 시수 업데이트
          if (teacherHours[teacher.name]) {
            teacherHours[teacher.name].current++;
            if (teacherHours[teacher.name].subjects[subjectName]) {
              teacherHours[teacher.name].subjects[subjectName]++;
            } else {
              teacherHours[teacher.name].subjects[subjectName] = 1;
            }
          }
          
          filledSlots++;
          addLog(`🆘 최후수단 배치: ${className} ${day} ${period}교시 - ${subjectName} (${teacher.name})`, 'error');
          break;
        }
      }
    }
  }
  
  addLog(`✅ 응급모드 완료: ${filledSlots}개 슬롯 추가 배치`, 'success');
  return filledSlots;
};

/**
 * 응급모드용 교사 중복 검사 (최소한의 검사만 수행)
 * @param schedule 스케줄
 * @param teacherName 교사명
 * @param day 요일
 * @param period 교시
 * @param excludeClassName 제외할 학급명
 * @returns 충돌 여부
 */
const checkEmergencyTeacherConflict = (
  schedule: Schedule,
  teacherName: string,
  day: string,
  period: number,
  excludeClassName: string
): boolean => {
  const slotIndex = period - 1;
  
  // 해당 시간에 이미 다른 학급에서 수업하는지만 확인
  for (const className of Object.keys(schedule)) {
    if (className === excludeClassName) continue;
    
    if (schedule[className] && schedule[className][day] && schedule[className][day][slotIndex]) {
      const slot = schedule[className][day][slotIndex];
      
      if (slot && typeof slot === 'object' && 'teachers' in slot && Array.isArray(slot.teachers)) {
        if (slot.teachers.includes(teacherName)) {
          return true; // 충돌 발견
        }
      }
    }
  }
  
  return false; // 충돌 없음
};