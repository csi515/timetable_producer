import { Schedule, FixedClass, TimetableData } from '../types';
import { getCurrentTeacherHours } from '../utils/helpers';

// 고정 수업 적용 함수
export const applyFixedClasses = (
  schedule: Schedule, 
  data: TimetableData,
  addLog: (message: string, type?: string) => void
): number => {
  const fixedClasses = data.fixedClasses || [];
  let appliedCount = 0;
  
  fixedClasses.forEach((fixedClass, index) => {
    // className이 없으면 grade와 class로부터 생성
    let className = fixedClass.className;
    if (!className && fixedClass.grade && fixedClass.class) {
      className = `${fixedClass.grade}학년 ${fixedClass.class}반`;
    }
    
    const { day, period, subject, teacher, coTeachers } = fixedClass;
    
    // 데이터 유효성 검사
    if (!className || !day || !period || !subject || !teacher) {
      addLog(`경고: 고정 수업 ${index + 1}번째 데이터가 불완전합니다. (className: ${className}, day: ${day}, period: ${period}, subject: ${subject}, teacher: ${teacher})`, 'warning');
      return;
    }
    
    // 0시간 설정 학급은 고정 수업도 적용하지 않음
    if (data.classWeeklyHours && data.classWeeklyHours[className] === 0) {
      addLog(`🚫 ${className}: 0시간 설정으로 고정 수업도 적용하지 않음 - ${subject}`, 'error');
      return;
    }
    
    if (schedule[className] && schedule[className][day]) {
      const slotIndex = period - 1;
      if (slotIndex >= 0 && slotIndex < Object.keys(schedule[className][day]).length && 
          (schedule[className][day][slotIndex] === '' || schedule[className][day][slotIndex] === undefined)) {
        
        // 공동수업 여부 확인 (coTeachers 배열이 있고 비어있지 않은 경우)
        const isCoTeaching = coTeachers && coTeachers.length > 0;
        const allTeachers = isCoTeaching ? [teacher, ...coTeachers] : [teacher];
        
        schedule[className][day][slotIndex] = {
          subject: subject,
          teachers: allTeachers,
          isFixed: true,
          isCoTeaching: isCoTeaching,
          source: 'fixed',
          constraintType: isCoTeaching ? 'fixed_co_teaching' : 'fixed_single'
        };
        
        appliedCount++;
        
        if (isCoTeaching) {
          addLog(`고정 공동수업 적용: ${className} ${day}요일 ${period}교시 - ${subject} (${teacher} + ${coTeachers.join(', ')})`, 'success');
        } else {
          addLog(`고정 수업 적용: ${className} ${day}요일 ${period}교시 - ${subject} (${teacher})`, 'success');
        }
      } else {
        addLog(`경고: ${className} ${day}요일 ${period}교시에 고정 수업을 배치할 수 없습니다. (슬롯이 이미 사용 중이거나 범위를 벗어남)`, 'warning');
      }
    } else {
      addLog(`경고: ${className} 학급이 존재하지 않습니다. (존재하는 학급: ${Object.keys(schedule).join(', ')})`, 'warning');
    }
  });
  
  addLog(`고정 수업 ${appliedCount}개를 적용했습니다.`, 'success');
  return appliedCount;
}; 

// 고정 수업 제약조건 검증 함수
export const validateFixedClassesConstraints = (
  schedule: Schedule,
  data: TimetableData,
  teacherHours: Record<string, { current: number; max: number; subjects: Record<string, number> }>
): { isValid: boolean; message: string } => {
  const violations: string[] = [];
  
  // 각 교사별로 고정 수업으로 인한 시수 제한 위반 확인
  for (const teacher of data.teachers) {
    const teacherName = teacher.name;
    const currentHours = teacherHours[teacherName]?.current || 0;
    const maxHours = teacher.maxHours || 0;
    
    // 전체 주간 시수 제한 확인
    if (currentHours > maxHours) {
      violations.push(`${teacherName} 교사 전체 시수 초과: ${currentHours}시간 > ${maxHours}시간`);
    }
    
    // 학급별 시수 제한 확인 (교과과목만 적용)
    if (teacher.weeklyHoursByGrade) {
      for (const [gradeClass, limit] of Object.entries(teacher.weeklyHoursByGrade)) {
        // 해당 학급에서 교사가 담당하는 교과과목만 계산
        let currentClassHours = 0;
        
        const classSchedule = schedule[gradeClass];
        if (classSchedule) {
          for (const day of Object.keys(classSchedule)) {
            const daySchedule = classSchedule[day];
            if (daySchedule) {
              const periods = Object.keys(daySchedule).length;
              for (let period = 0; period < periods; period++) {
                const slot = daySchedule[period];
                if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.includes(teacherName)) {
                  // 과목이 교과과목인지 확인
                  const subject = data.subjects?.find(s => s.name === slot.subject);
                  if (subject && subject.category === '교과과목') {
                    currentClassHours++;
                  }
                }
              }
            }
          }
        }
        
        if (currentClassHours > limit) {
          violations.push(`${teacherName} 교사 ${gradeClass} 학급 교과과목 시수 초과: ${currentClassHours}시간 > ${limit}시간`);
        }
      }
    }
  }
  
  // 각 학급별로 고정 수업으로 인한 과목별 시수 제한 확인
  for (const className of Object.keys(schedule)) {
    // classes 속성이 없으므로 다른 방법으로 학급 데이터 확인
    const classSchedule = schedule[className];
    if (classSchedule) {
      const subjectHours: Record<string, number> = {};
      
      // 고정 수업에서 과목별 시수 계산
      for (const day of Object.keys(classSchedule)) {
        const daySchedule = classSchedule[day];
        if (daySchedule) {
          const periods = Object.keys(daySchedule).length;
          for (let period = 0; period < periods; period++) {
            const slot = daySchedule[period];
            if (slot && typeof slot === 'object' && slot.subject && slot.isFixed) {
              subjectHours[slot.subject] = (subjectHours[slot.subject] || 0) + 1;
            }
          }
        }
      }
      
      // 제한 확인 (data.classWeeklyHours 사용)
      for (const [subject, currentHours] of Object.entries(subjectHours)) {
        // 과목별 시수 제한은 별도로 설정되어 있지 않으므로 기본 검증만 수행
        if (currentHours > 10) { // 임시 제한
          violations.push(`${className} ${subject} 과목 시수 초과: ${currentHours}시간 > 10시간`);
        }
      }
    }
  }
  
  if (violations.length > 0) {
    return {
      isValid: false,
      message: `고정 수업으로 인한 제약조건 위반:\n${violations.join('\n')}`
    };
  }
  
  return {
    isValid: true,
    message: "모든 고정 수업이 제약조건을 만족합니다."
  };
}; 