import * as XLSX from 'xlsx';

// JSON 형식으로 내보내기
export const exportToJSON = (data) => {
  const exportData = {
    ...data,
    exportDate: new Date().toISOString(),
    version: '1.0'
  };
  
  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `timetable_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Excel 형식으로 내보내기
export const exportToExcel = (data) => {
  const workbook = XLSX.utils.book_new();
  const days = ['월', '화', '수', '목', '금'];
  const periodsPerDay = data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };

  // 학급별 시간표 시트 생성
  if (data.schedule) {
    Object.keys(data.schedule).forEach(className => {
      const worksheetData = [];
      
      // 헤더 행
      const headerRow = ['교시', ...days];
      worksheetData.push(headerRow);
      
      // 시간표 데이터
      const maxPeriods = Math.max(...Object.values(periodsPerDay));
      for (let period = 1; period <= maxPeriods; period++) {
        const row = [period];
        
        days.forEach(day => {
          const slotIndex = period - 1;
          const slot = data.schedule[className][day][slotIndex];
          
          if (slot) {
            if (typeof slot === 'object' && slot.subject) {
              const teachers = slot.teachers ? slot.teachers.join(', ') : '';
              const coTeaching = slot.isCoTeaching ? ' (공동수업)' : '';
              const fixed = slot.isFixed ? ' (고정)' : '';
              row.push(`${slot.subject} - ${teachers}${coTeaching}${fixed}`);
            } else if (typeof slot === 'string' && slot.trim() !== '') {
              row.push(slot.trim());
            } else {
              row.push('');
            }
          } else {
            row.push('');
          }
        });
        
        worksheetData.push(row);
      }
      
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, className);
    });
  }

  // 교사별 시간표 시트 생성
  if (data.teachers && data.schedule) {
    data.teachers.forEach(teacher => {
      const worksheetData = [];
      const headerRow = ['교시', ...days];
      worksheetData.push(headerRow);
      
      const maxPeriods = Math.max(...Object.values(periodsPerDay));
      for (let period = 1; period <= maxPeriods; period++) {
        const row = [period];
        
        days.forEach(day => {
          const slotIndex = period - 1;
          let teacherSlot = '';
          
          Object.keys(data.schedule).forEach(className => {
            const slot = data.schedule[className][day][slotIndex];
            if (slot) {
              if (typeof slot === 'object' && slot.teachers && slot.teachers.includes(teacher.name)) {
                const otherTeachers = slot.teachers.filter(t => t !== teacher.name);
                const otherTeachersStr = otherTeachers.length > 0 ? ` (${otherTeachers.join(', ')})` : '';
                teacherSlot = `${className} - ${slot.subject}${otherTeachersStr}`;
              } else if (typeof slot === 'string' && slot.trim() === teacher.name) {
                teacherSlot = `${className} - 미정`;
              }
            }
          });
          
          row.push(teacherSlot);
        });
        
        worksheetData.push(row);
      }
      
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, `${teacher.name} 시간표`);
    });
  }

  // 통계 시트 생성
  const statsData = [];
  
  // 과목별 통계
  if (data.subjects) {
    statsData.push(['=== 과목별 통계 ===']);
    statsData.push(['과목명', '목표 시수', '실제 시수', '부족 시수']);
    
    data.subjects.forEach(subject => {
      const targetHours = subject.weekly_hours || 1;
      let actualHours = 0;
      
      if (data.schedule) {
        Object.keys(data.schedule).forEach(className => {
          days.forEach(day => {
            if (data.schedule[className][day]) {
              Object.values(data.schedule[className][day]).forEach(slot => {
                if (slot) {
                  if (typeof slot === 'object' && slot.subject === subject.name) {
                    actualHours++;
                  } else if (typeof slot === 'string' && slot.trim() === subject.name) {
                    actualHours++;
                  }
                }
              });
            }
          });
        });
      }
      
      const shortage = Math.max(0, targetHours - actualHours);
      statsData.push([subject.name, targetHours, actualHours, shortage]);
    });
  }
  
  // 교사별 통계
  if (data.teachers) {
    statsData.push([]);
    statsData.push(['=== 교사별 통계 ===']);
    statsData.push(['교사명', '최대 시수', '실제 시수', '초과 시수']);
    
    data.teachers.forEach(teacher => {
      const maxHours = teacher.max_hours_per_week || teacher.maxHours || 25;
      let actualHours = 0;
      
      if (data.schedule) {
        Object.keys(data.schedule).forEach(className => {
          days.forEach(day => {
            if (data.schedule[className][day]) {
              Object.values(data.schedule[className][day]).forEach(slot => {
                if (slot) {
                  if (typeof slot === 'object' && slot.teachers && slot.teachers.includes(teacher.name)) {
                    actualHours++;
                  } else if (typeof slot === 'string' && slot.trim() === teacher.name) {
                    actualHours++;
                  }
                }
              });
            }
          });
        });
      }
      
      const excess = Math.max(0, actualHours - maxHours);
      statsData.push([teacher.name, maxHours, actualHours, excess]);
    });
  }
  
  if (statsData.length > 0) {
    const statsWorksheet = XLSX.utils.aoa_to_sheet(statsData);
    XLSX.utils.book_append_sheet(workbook, statsWorksheet, '통계');
  }

  // 파일 다운로드
  const fileName = `timetable_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

// PDF 형식으로 내보내기 (간단한 텍스트 형식)
export const exportToPDF = (data) => {
  const days = ['월', '화', '수', '목', '금'];
  const periodsPerDay = data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };
  
  let pdfContent = '시간표 보고서\n';
  pdfContent += `생성일: ${new Date().toLocaleDateString()}\n\n`;
  
  // 학급별 시간표
  if (data.schedule) {
    Object.keys(data.schedule).forEach(className => {
      pdfContent += `\n=== ${className} 시간표 ===\n`;
      pdfContent += `교시\t${days.join('\t')}\n`;
      
      const maxPeriods = Math.max(...Object.values(periodsPerDay));
      for (let period = 1; period <= maxPeriods; period++) {
        const row = [period];
        
        days.forEach(day => {
          const slotIndex = period - 1;
          const slot = data.schedule[className][day][slotIndex];
          
          if (slot) {
            if (typeof slot === 'object' && slot.subject) {
              const teachers = slot.teachers ? slot.teachers.join(', ') : '';
              row.push(`${slot.subject} (${teachers})`);
            } else if (typeof slot === 'string' && slot.trim() !== '') {
              row.push(slot.trim());
            } else {
              row.push('');
            }
          } else {
            row.push('');
          }
        });
        
        pdfContent += row.join('\t') + '\n';
      }
    });
  }
  
  // 텍스트 파일로 다운로드 (PDF 대신)
  const blob = new Blob([pdfContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `timetable_${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}; 