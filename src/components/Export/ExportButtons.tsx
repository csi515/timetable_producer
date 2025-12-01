import React from 'react';
import { ScheduleResult } from '../../types/timetable';
import { exportToPDF } from '../../utils/export';
import { exportToExcel } from '../../utils/export';

interface ExportButtonsProps {
  result: ScheduleResult | null;
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({ result }) => {
  const handleExportPDF = () => {
    if (!result) {
      alert('내보낼 시간표가 없습니다.');
      return;
    }
    exportToPDF(result);
  };

  const handleExportExcel = () => {
    if (!result) {
      alert('내보낼 시간표가 없습니다.');
      return;
    }
    exportToExcel(result);
  };

  return (
    <div className="export-buttons">
      <button onClick={handleExportPDF} disabled={!result}>
        PDF로 내보내기
      </button>
      <button onClick={handleExportExcel} disabled={!result}>
        Excel로 내보내기
      </button>
    </div>
  );
};

