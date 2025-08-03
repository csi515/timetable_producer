import { Schedule, FixedClass, TimetableData } from '../types';

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