import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ScheduleResult } from '../types/timetable';

export const exportToPDF = (result: ScheduleResult) => {
  const doc = new jsPDF();
  const { entries, classes, subjects, teachers } = result;
  const days = result.days || ['월', '화', '수', '목', '금'];
  const maxPeriods = 7;

  // 각 학급별로 페이지 생성
  classes.forEach((classInfo, index) => {
    if (index > 0) {
      doc.addPage();
    }

    doc.setFontSize(16);
    doc.text(`${classInfo.name} 시간표`, 14, 20);

    // 시간표 데이터 준비
    const tableData: string[][] = [];
    const days = ['월', '화', '수', '목', '금'];

    // 헤더
    const headers = ['교시', ...days];

    // 각 교시별 데이터
    for (let period = 1; period <= maxPeriods; period++) {
      const row: string[] = [period.toString()];
      days.forEach(day => {
        const entry = entries.find(
          e => e.classId === classInfo.id && e.day === day && e.period === period
        );
        if (entry) {
          const subject = subjects.find(s => s.id === entry.subjectId);
          const teacher = teachers.find(t => t.id === entry.teacherId);
          row.push(subject?.name || entry.subjectId);
        } else {
          row.push('');
        }
      });
      tableData.push(row);
    }

    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [102, 126, 234] }
    });
  });

  doc.save(`시간표-${new Date().toISOString().split('T')[0]}.pdf`);
};

export const exportToExcel = (result: ScheduleResult) => {
  const workbook = XLSX.utils.book_new();
  const { entries, classes, subjects, teachers } = result;
  const days = result.days || ['월', '화', '수', '목', '금'];
  const maxPeriods = 7;

  // 각 학급별로 시트 생성
  classes.forEach(classInfo => {
    const worksheetData: any[][] = [];
    
    // 헤더
    const headers = ['교시', ...days];
    worksheetData.push(headers);

    // 각 교시별 데이터
    for (let period = 1; period <= maxPeriods; period++) {
      const row: any[] = [period];
      days.forEach(day => {
        const entry = entries.find(
          e => e.classId === classInfo.id && e.day === day && e.period === period
        );
        if (entry) {
          const subject = subjects.find(s => s.id === entry.subjectId);
          const teacher = teachers.find(t => t.id === entry.teacherId);
          row.push(subject?.name || entry.subjectId);
        } else {
          row.push('');
        }
      });
      worksheetData.push(row);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, classInfo.name);
  });

  // 교사별 시트도 추가 (선택사항)
  // ...

  XLSX.writeFile(workbook, `시간표-${new Date().toISOString().split('T')[0]}.xlsx`);
};

