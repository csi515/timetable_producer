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

// Excel 형식으로 내보내기 (지연 로딩)
export const exportToExcel = async (schedule, teacherHours, data) => {
  try {
    // ExcelJS를 동적으로 import
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    
    // 1. 학급별 시간표 시트 생성
    Object.keys(schedule).forEach(className => {
      const worksheetData = [];
      
      // 헤더 행
      const headerRow = ['교시', '월', '화', '수', '목', '금'];
      worksheetData.push(headerRow);
      
      // 각 교시별 데이터
      const maxPeriods = Math.max(...Object.values(data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 }));
      
      for (let period = 1; period <= maxPeriods; period++) {
        const row = [period];
        
        ['월', '화', '수', '목', '금'].forEach(day => {
          const slotIndex = period - 1;
          const slot = schedule[className]?.[day]?.[slotIndex];
          
          if (slot && typeof slot === 'object' && slot.subject) {
            const teachers = slot.teachers ? slot.teachers.join(', ') : '';
            const subjectInfo = slot.isCoTeaching ? `${slot.subject} (공동수업)` : slot.subject;
            row.push(`${subjectInfo} - ${teachers}`);
          } else if (typeof slot === 'string' && slot.trim() !== '') {
            row.push(slot);
          } else {
            row.push('');
          }
        });
        
        worksheetData.push(row);
      }
      
      const worksheet = workbook.addWorksheet(className);
      worksheetData.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          const cellRef = worksheet.getCell(rowIndex + 1, colIndex + 1);
          cellRef.value = cell;
          
          // 헤더 스타일링
          if (rowIndex === 0) {
            cellRef.font = { bold: true };
            cellRef.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE0E0E0' }
            };
          }
        });
      });
      
      // 열 너비 자동 조정
      worksheet.columns.forEach(column => {
        column.width = 15;
      });
    });
    
    // 2. 교사별 시간표 시트 생성
    const teachers = data.teachers || [];
    teachers.forEach(teacher => {
      const worksheetData = [];
      
      // 헤더 행
      const headerRow = ['교시', '월', '화', '수', '목', '금'];
      worksheetData.push(headerRow);
      
      // 각 교시별 데이터
      const maxPeriods = Math.max(...Object.values(data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 }));
      
      for (let period = 1; period <= maxPeriods; period++) {
        const row = [period];
        
        ['월', '화', '수', '목', '금'].forEach(day => {
          const slotIndex = period - 1;
          let teacherSlot = '';
          
          // 모든 학급에서 해당 교사의 수업 찾기
          Object.keys(schedule).forEach(className => {
            const slot = schedule[className]?.[day]?.[slotIndex];
            if (slot && typeof slot === 'object' && slot.teachers && slot.teachers.includes(teacher.name)) {
              teacherSlot = `${className} - ${slot.subject}`;
            }
          });
          
          row.push(teacherSlot);
        });
        
        worksheetData.push(row);
      }
      
      const worksheet = workbook.addWorksheet(`${teacher.name} 시간표`);
      worksheetData.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          const cellRef = worksheet.getCell(rowIndex + 1, colIndex + 1);
          cellRef.value = cell;
          
          // 헤더 스타일링
          if (rowIndex === 0) {
            cellRef.font = { bold: true };
            cellRef.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE0E0E0' }
            };
          }
        });
      });
      
      // 열 너비 자동 조정
      worksheet.columns.forEach(column => {
        column.width = 15;
      });
    });
    
    // 3. 통계 시트 생성
    const statsData = [
      ['교사명', '현재 시수', '최대 시수', '시수 차이'],
      ...teachers.map(teacher => {
        const currentHours = teacherHours[teacher.name]?.actual || 0;
        const maxHours = teacher.max_hours_per_week || teacher.maxHours || 22;
        return [teacher.name, currentHours, maxHours, maxHours - currentHours];
      })
    ];
    
    const statsWorksheet = workbook.addWorksheet('통계');
    statsData.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const cellRef = statsWorksheet.getCell(rowIndex + 1, colIndex + 1);
        cellRef.value = cell;
        
        // 헤더 스타일링
        if (rowIndex === 0) {
          cellRef.font = { bold: true };
          cellRef.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
          };
        }
      });
    });
    
    // 열 너비 자동 조정
    statsWorksheet.columns.forEach(column => {
      column.width = 15;
    });
    
    // 파일 다운로드
    const fileName = `timetable_${new Date().toISOString().split('T')[0]}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Excel 내보내기 중 오류 발생:', error);
    alert('Excel 파일 내보내기에 실패했습니다. 다시 시도해주세요.');
  }
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