import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { ScheduleResult, TimetableEntry } from '../types/timetable';
import { Subject } from '../types/subject';
import { Teacher } from '../types/teacher';

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

export const exportToExcel = async (result: ScheduleResult) => {
  const workbook = new ExcelJS.Workbook();
  const { entries, classes, subjects, teachers } = result;
  const days = result.days || ['월', '화', '수', '목', '금'];
  const maxPeriods = 7;

  // 스타일 정의
  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A90E2' } },
    alignment: { vertical: 'middle', horizontal: 'center' },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  };

  const cellStyle: Partial<ExcelJS.Style> = {
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  };

  // 1. 학급별 시트 생성
  for (const classInfo of classes) {
    const sheet = workbook.addWorksheet(classInfo.name);

    // 컬럼 너비 설정
    sheet.columns = [
      { header: '교시', key: 'period', width: 10 },
      ...days.map(day => ({ header: day, key: day, width: 20 }))
    ];

    // 헤더 스타일 적용
    sheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // 데이터 채우기
    for (let period = 1; period <= maxPeriods; period++) {
      const rowValues: any = { period: `${period}교시` };

      days.forEach(day => {
        const entry = entries.find(
          e => e.classId === classInfo.id && e.day === day && e.period === period
        );

        if (entry) {
          const subject = subjects.find(s => s.id === entry.subjectId);
          const teacher = teachers.find(t => t.id === entry.teacherId);
          const teacherName = entry.teacherIds
            ? entry.teacherIds.map(id => teachers.find(t => t.id === id)?.name).join(', ')
            : (teacher?.name || '');

          rowValues[day] = `${subject?.name || ''}\n(${teacherName})`;
        } else {
          rowValues[day] = '';
        }
      });

      const row = sheet.addRow(rowValues);
      row.height = 40; // 행 높이 설정
      row.eachCell((cell) => {
        cell.style = cellStyle;
      });
    }

    // 블록 수업 병합 처리
    // 세로 병합 (같은 요일, 연속 교시, 같은 과목)
    days.forEach((day, dayIndex) => {
      const colIndex = dayIndex + 2; // 1-based index, 1 is period
      let startRow = 2;
      let currentSubjectId: string | null = null;
      let mergeCount = 0;

      for (let period = 1; period <= maxPeriods + 1; period++) {
        const entry = entries.find(
          e => e.classId === classInfo.id && e.day === day && e.period === period
        );

        const subjectId = entry?.subjectId || null;

        if (subjectId !== currentSubjectId) {
          if (mergeCount > 1 && currentSubjectId) {
            // 병합 실행
            // startRow는 이전 블록의 시작 (header가 1행이므로 period+1)
            // period는 현재 행 (다르니까 끊김)
            // 병합 범위: startRow ~ (startRow + mergeCount - 1)
            const fromRow = startRow;
            const toRow = startRow + mergeCount - 1;
            sheet.mergeCells(fromRow, colIndex, toRow, colIndex);
          }
          currentSubjectId = subjectId;
          startRow = period + 1;
          mergeCount = 1;
        } else {
          if (subjectId) mergeCount++;
        }
      }
    });
  }

  // 2. 교사별 전체 시간표 (Master Sheet)
  const teacherSheet = workbook.addWorksheet('교사별 전체 시간표');

  // 헤더: 교사명 | 월1 | 월2 ... | 금7
  const timeHeaders: string[] = [];
  days.forEach(day => {
    for (let p = 1; p <= maxPeriods; p++) {
      timeHeaders.push(`${day}${p}`);
    }
  });

  teacherSheet.columns = [
    { header: '교사명', key: 'teacher', width: 15 },
    ...timeHeaders.map(th => ({ header: th, key: th, width: 12 }))
  ];

  teacherSheet.getRow(1).eachCell((cell) => {
    cell.style = headerStyle;
  });

  teachers.forEach(teacher => {
    const rowValues: any = { teacher: teacher.name };

    days.forEach(day => {
      for (let p = 1; p <= maxPeriods; p++) {
        const key = `${day}${p}`;
        // 해당 교사가 해당 시간에 수업하는지 찾기
        const entry = entries.find(e =>
          e.day === day &&
          e.period === p &&
          (e.teacherIds ? e.teacherIds.includes(teacher.id) : e.teacherId === teacher.id)
        );

        if (entry) {
          const classInfo = classes.find(c => c.id === entry.classId);
          const subject = subjects.find(s => s.id === entry.subjectId);
          rowValues[key] = `${classInfo?.name || ''}\n${subject?.name || ''}`;
        } else {
          rowValues[key] = '';
        }
      }
    });

    const row = teacherSheet.addRow(rowValues);
    row.height = 30;
    row.eachCell((cell) => {
      cell.style = cellStyle;
    });
  });

  // 3. 특별실 시간표
  const specialRoomSheet = workbook.addWorksheet('특별실 시간표');

  // 특별실 목록 추출
  const specialRooms = Array.from(new Set(subjects
    .filter(s => s.requiresSpecialRoom && s.specialRoomType)
    .map(s => s.specialRoomType!)
  ));

  if (specialRooms.length > 0) {
    specialRoomSheet.columns = [
      { header: '특별실', key: 'room', width: 15 },
      ...timeHeaders.map(th => ({ header: th, key: th, width: 12 }))
    ];

    specialRoomSheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    specialRooms.forEach(room => {
      const rowValues: any = { room: room };

      days.forEach(day => {
        for (let p = 1; p <= maxPeriods; p++) {
          const key = `${day}${p}`;
          const entry = entries.find(e =>
            e.day === day &&
            e.period === p &&
            e.roomId === room
          );

          if (entry) {
            const classInfo = classes.find(c => c.id === entry.classId);
            const teacher = teachers.find(t => t.id === entry.teacherId);
            rowValues[key] = `${classInfo?.name || ''}\n${teacher?.name || ''}`;
          } else {
            rowValues[key] = '';
          }
        }
      });

      const row = specialRoomSheet.addRow(rowValues);
      row.height = 30;
      row.eachCell((cell) => {
        cell.style = cellStyle;
      });
    });
  }

  // 파일 저장
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `전체시간표-${new Date().toISOString().split('T')[0]}.xlsx`);
};

