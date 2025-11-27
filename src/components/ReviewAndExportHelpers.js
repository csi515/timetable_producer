// 기존 문자열 형식의 시간표 데이터를 객체 형식으로 변환하는 함수
export const convertScheduleItem = (scheduleItem, className, day, period, data) => {
  if (typeof scheduleItem === 'object' && scheduleItem !== null && !Array.isArray(scheduleItem)) {
    // 이미 객체 형식인 경우 그대로 반환
    return scheduleItem;
  } else if (typeof scheduleItem === 'string' && scheduleItem.trim() !== '') {
    // 문자열 형식인 경우 객체로 변환
    const teacherName = scheduleItem.trim();
    const teacher = data.teachers.find(t => t.name === teacherName);
    
    if (teacher) {
      // 해당 교사가 가르칠 수 있는 과목들 중에서 선택
      const teacherSubjects = teacher.subjects || [];
      if (teacherSubjects.length > 0) {
        // 가장 적합한 과목 선택 (현재 시간표에서 부족한 과목 우선)
        const currentSubjectHours = {};
        teacherSubjects.forEach(subject => {
          currentSubjectHours[subject] = getCurrentSubjectHours(data.schedule, className, subject, data);
        });
        
        // 가장 부족한 과목 선택
        const targetSubject = teacherSubjects.reduce((best, current) => {
          const currentHours = currentSubjectHours[current] || 0;
          const bestHours = currentSubjectHours[best] || 0;
          const currentTarget = data.subjects.find(s => s.name === current)?.weekly_hours || 1;
          const bestTarget = data.subjects.find(s => s.name === best)?.weekly_hours || 1;
          
          const currentShortfall = currentTarget - currentHours;
          const bestShortfall = bestTarget - bestHours;
          
          return currentShortfall > bestShortfall ? current : best;
        });
        
        return {
          subject: targetSubject,
          teachers: [teacherName],
          isCoTeaching: false,
          isFixed: false
        };
      }
    }
    
    // 교사 정보를 찾을 수 없는 경우 기본 형식으로 반환
    return {
      subject: teacherName,
      teachers: [teacherName],
      isCoTeaching: false,
      isFixed: false
    };
  }
  
  // 빈 슬롯인 경우 null 반환
  return null;
};

// 블록제 교사인지 확인하는 함수
export const isBlockPeriodTeacher = (teacherName, data) => {
  // 제약조건에서 해당 교사가 블록제로 설정되어 있는지 확인
  const blockPeriodConstraints = data.constraints?.must?.filter(c => c.type === 'block_period_requirement') || [];
  return blockPeriodConstraints.some(c => c.subject === teacherName);
};

// 과목별 현재 시수 계산 (헬퍼 함수)
export const getCurrentSubjectHours = (schedule, className, subjectName, data) => {
  let hours = 0;
  if (!schedule || !schedule[className]) return hours;
  
  const days = ['월', '화', '수', '목', '금'];
  days.forEach(day => {
    if (schedule[className][day]) {
      Object.values(schedule[className][day]).forEach(slot => {
        if (slot) {
          if (typeof slot === 'object' && slot.subject) {
            if (slot.subject === subjectName) {
              hours++;
            }
          } else if (typeof slot === 'string' && slot.trim() !== '') {
            if (slot.trim() === subjectName) {
              hours++;
            }
          }
        }
      });
    }
  });
  return hours;
};

// 학급 목록 생성
export const getClassList = (data) => {
  const classes = [];
  const grades = data.base?.grades || 3;
  const classesPerGrade = data.base?.classes_per_grade || [4, 4, 4];

  for (let grade = 1; grade <= grades; grade++) {
    const classCount = classesPerGrade[grade - 1] || 4;
    for (let classNum = 1; classNum <= classCount; classNum++) {
      classes.push(`${grade}학년 ${classNum}반`);
    }
  }

  return classes;
};

// 교사 스케줄 가져오기
export const getTeacherSchedule = (teacherName, data) => {
  const teacherSchedule = {};
  const days = ['월', '화', '수', '목', '금'];
  const periodsPerDay = data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };

  if (!data.schedule) return teacherSchedule;

  Object.keys(data.schedule).forEach(className => {
    teacherSchedule[className] = {};
    
    days.forEach(day => {
      const maxPeriods = periodsPerDay[day] || 7;
      teacherSchedule[className][day] = {};
      
      for (let period = 1; period <= maxPeriods; period++) {
        const slotIndex = period - 1;
        const slot = data.schedule[className][day][slotIndex];
        
        if (slot) {
          if (typeof slot === 'object' && slot.teachers && slot.teachers.includes(teacherName)) {
            teacherSchedule[className][day][period] = {
              subject: slot.subject,
              isCoTeaching: slot.isCoTeaching,
              isFixed: slot.isFixed,
              otherTeachers: slot.teachers.filter(t => t !== teacherName)
            };
          } else if (typeof slot === 'string' && slot.trim() === teacherName) {
            teacherSchedule[className][day][period] = {
              subject: '미정',
              isCoTeaching: false,
              isFixed: false,
              otherTeachers: []
            };
          }
        }
      }
    });
  });

  return teacherSchedule;
};

// 과목별 시수 통계 계산
export const getSubjectHoursStats = (data) => {
  const stats = {};
  const days = ['월', '화', '수', '목', '금'];

  if (!data.schedule || !data.subjects) return stats;

  // 각 과목별로 초기화
  data.subjects.forEach(subject => {
    stats[subject.name] = {
      target: subject.weekly_hours || 1,
      actual: 0,
      shortage: 0,
      classBreakdown: {}
    };
  });

  // 실제 배치된 시수 계산
  Object.keys(data.schedule).forEach(className => {
    days.forEach(day => {
      if (data.schedule[className][day]) {
        Object.values(data.schedule[className][day]).forEach(slot => {
          if (slot) {
            let subjectName = '';
            
            if (typeof slot === 'object' && slot.subject) {
              subjectName = slot.subject;
            } else if (typeof slot === 'string' && slot.trim() !== '') {
              subjectName = slot.trim();
            }
            
            if (subjectName && stats[subjectName]) {
              stats[subjectName].actual++;
              
              if (!stats[subjectName].classBreakdown[className]) {
                stats[subjectName].classBreakdown[className] = 0;
              }
              stats[subjectName].classBreakdown[className]++;
            }
          }
        });
      }
    });
  });

  // 부족한 시수 계산
  Object.keys(stats).forEach(subjectName => {
    const stat = stats[subjectName];
    stat.shortage = Math.max(0, stat.target - stat.actual);
  });

  return stats;
};

// 교사 목록 생성
export const getTeacherList = (data) => {
  if (!data.teachers || !Array.isArray(data.teachers)) {
    return [];
  }
  return data.teachers.map(teacher => teacher.name);
};

// 전체 교사의 시간표 데이터 가져오기
export const getAllTeachersSchedule = (data) => {
  const allTeachersSchedule = {};
  const days = ['월', '화', '수', '목', '금'];
  const periodsPerDay = data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };
  const maxPeriods = Math.max(...Object.values(periodsPerDay));

  if (!data.schedule || !data.teachers) return allTeachersSchedule;

  // 각 교사별로 시간표 초기화
  data.teachers.forEach(teacher => {
    allTeachersSchedule[teacher.name] = {};
    days.forEach(day => {
      allTeachersSchedule[teacher.name][day] = {};
      for (let period = 1; period <= maxPeriods; period++) {
        allTeachersSchedule[teacher.name][day][period] = null;
      }
    });
  });

  // 스케줄에서 각 교사의 수업 정보 추출
  Object.keys(data.schedule).forEach(className => {
    days.forEach(day => {
      const maxPeriodsForDay = periodsPerDay[day] || 7;
      for (let period = 1; period <= maxPeriodsForDay; period++) {
        const slotIndex = period - 1;
        const slot = data.schedule[className]?.[day]?.[slotIndex];
        
        if (slot) {
          let teachers = [];
          let subject = '';
          let isCoTeaching = false;
          let isFixed = false;

          if (typeof slot === 'object' && slot.teachers) {
            teachers = slot.teachers;
            subject = slot.subject || '';
            isCoTeaching = slot.isCoTeaching || false;
            isFixed = slot.isFixed || false;
          } else if (typeof slot === 'string' && slot.trim() !== '') {
            teachers = [slot.trim()];
            subject = '미정';
          }

          // 각 교사에게 해당 시간의 수업 정보 할당
          teachers.forEach(teacherName => {
            if (allTeachersSchedule[teacherName]) {
              allTeachersSchedule[teacherName][day][period] = {
                className: className,
                subject: subject,
                isCoTeaching: isCoTeaching,
                isFixed: isFixed,
                isBlockPeriod: slot.isBlockPeriod || false,
                otherTeachers: teachers.filter(t => t !== teacherName)
              };
            }
          });
        }
      }
    });
  });

  return allTeachersSchedule;
};

// 교사별 시수 통계 계산
export const getTeacherHoursStats = (data) => {
  const stats = {};
  const days = ['월', '화', '수', '목', '금'];

  if (!data.schedule || !data.teachers) return stats;

  // 각 교사별로 초기화
  data.teachers.forEach(teacher => {
    stats[teacher.name] = {
      max: teacher.max_hours_per_week || teacher.maxHours || 25,
      actual: 0,
      excess: 0,
      classBreakdown: {}
    };
  });

  // 실제 배치된 시수 계산
  Object.keys(data.schedule).forEach(className => {
    days.forEach(day => {
      if (data.schedule[className][day]) {
        Object.values(data.schedule[className][day]).forEach(slot => {
          if (slot) {
            let teachers = [];
            
            if (typeof slot === 'object' && slot.teachers) {
              teachers = slot.teachers;
            } else if (typeof slot === 'string' && slot.trim() !== '') {
              teachers = [slot.trim()];
            }
            
            teachers.forEach(teacherName => {
              if (stats[teacherName]) {
                stats[teacherName].actual++;
                
                if (!stats[teacherName].classBreakdown[className]) {
                  stats[teacherName].classBreakdown[className] = 0;
                }
                stats[teacherName].classBreakdown[className]++;
              }
            });
          }
        });
      }
    });
  });

  // 초과 시수 계산
  Object.keys(stats).forEach(teacherName => {
    const stat = stats[teacherName];
    stat.excess = Math.max(0, stat.actual - stat.max);
  });

  return stats;
}; 