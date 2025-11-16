// Excel 및 이미지 내보내기 유틸리티

import { TimetableData, Assignment, Day } from "@/types/timetable";
import ExcelJS from "exceljs";

const DAYS: Day[] = ["월", "화", "수", "목", "금"];

export async function exportToExcel(data: TimetableData) {
  const workbook = new ExcelJS.Workbook();
  
  // 각 학급별로 시트 생성
  for (const classItem of data.classes) {
    const worksheet = workbook.addWorksheet(classItem.name);
    
    const classAssignments = data.assignments.filter(
      (a) => a.classId === classItem.id
    );

    // 헤더 행
    const headerRow = worksheet.addRow(["교시", ...DAYS.filter(day => data.schoolSchedule.days.includes(day))]);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };

    // 시간표 그리드 생성
    const grid: {
      [day in Day]: { [period: number]: Assignment | null };
    } = {
      월: {},
      화: {},
      수: {},
      목: {},
      금: {},
    };

    classAssignments.forEach((assignment) => {
      if (assignment.slot.day in grid) {
        grid[assignment.slot.day][assignment.slot.period] = assignment;
      }
    });

    const maxPeriods = Math.max(
      ...DAYS.map((day) => data.schoolSchedule.periodsPerDay[day])
    );

    // 각 교시별 행 추가
    for (let period = 1; period <= maxPeriods; period++) {
      const row: (string | number)[] = [period];
      
      DAYS.filter(day => data.schoolSchedule.days.includes(day)).forEach((day) => {
        const assignment = grid[day][period];
        const maxPeriodForDay = data.schoolSchedule.periodsPerDay[day];
        
        if (period > maxPeriodForDay) {
          row.push("-");
        } else if (assignment) {
          const subject = data.subjects.find((s) => s.id === assignment.subjectId);
          const teacher = data.teachers.find((t) => t.id === assignment.teacherId);
          row.push(`${subject?.name || ""}\n${teacher?.name || ""}`);
        } else {
          row.push("");
        }
      });
      
      const excelRow = worksheet.addRow(row);
      excelRow.alignment = { horizontal: "center", vertical: "middle" };
      excelRow.height = 40;
    }

    // 열 너비 설정
    worksheet.getColumn(1).width = 10;
    DAYS.filter(day => data.schoolSchedule.days.includes(day)).forEach(() => {
      worksheet.columns.forEach((column) => {
        if (column.number > 1) {
          column.width = 20;
        }
      });
    });
  }

  // 교사별 시트도 생성
  for (const teacher of data.teachers) {
    const worksheet = workbook.addWorksheet(`${teacher.name} 교사`);
    
    const teacherAssignments = data.assignments.filter(
      (a) => a.teacherId === teacher.id
    );

    // 헤더 행
    const headerRow = worksheet.addRow(["교시", ...DAYS.filter(day => data.schoolSchedule.days.includes(day))]);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF7B68EE" },
    };
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };

    // 시간표 그리드 생성
    const grid: {
      [day in Day]: { [period: number]: Assignment | null };
    } = {
      월: {},
      화: {},
      수: {},
      목: {},
      금: {},
    };

    teacherAssignments.forEach((assignment) => {
      if (assignment.slot.day in grid) {
        grid[assignment.slot.day][assignment.slot.period] = assignment;
      }
    });

    const maxPeriods = Math.max(
      ...DAYS.map((day) => data.schoolSchedule.periodsPerDay[day])
    );

    // 각 교시별 행 추가
    for (let period = 1; period <= maxPeriods; period++) {
      const row: (string | number)[] = [period];
      
      DAYS.filter(day => data.schoolSchedule.days.includes(day)).forEach((day) => {
        const assignment = grid[day][period];
        const maxPeriodForDay = data.schoolSchedule.periodsPerDay[day];
        
        if (period > maxPeriodForDay) {
          row.push("-");
        } else if (assignment) {
          const classItem = data.classes.find((c) => c.id === assignment.classId);
          const subject = data.subjects.find((s) => s.id === assignment.subjectId);
          row.push(`${classItem?.name || ""}\n${subject?.name || ""}`);
        } else {
          row.push("");
        }
      });
      
      const excelRow = worksheet.addRow(row);
      excelRow.alignment = { horizontal: "center", vertical: "middle" };
      excelRow.height = 40;
    }

    // 열 너비 설정
    worksheet.getColumn(1).width = 10;
    DAYS.filter(day => data.schoolSchedule.days.includes(day)).forEach(() => {
      worksheet.columns.forEach((column) => {
        if (column.number > 1) {
          column.width = 20;
        }
      });
    });
  }

  // 파일 다운로드
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `시간표_${new Date().toISOString().split("T")[0]}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToImage(classId: string) {
  const element = document.querySelector(`[data-class-id="${classId}"]`);
  if (!element) {
    alert("시간표를 찾을 수 없습니다.");
    return;
  }

  // html2canvas를 사용하여 이미지로 변환
  // 실제 구현 시 html2canvas 라이브러리 필요
  alert("이미지 내보내기 기능은 html2canvas 라이브러리가 필요합니다.");
}
