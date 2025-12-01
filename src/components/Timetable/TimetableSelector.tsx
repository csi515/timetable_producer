import React from 'react';
import { MultipleScheduleResult } from '../../types/timetable';
import { useTimetableStore } from '../../store/timetableStore';

interface TimetableSelectorProps {
  multipleResults: MultipleScheduleResult;
}

export const TimetableSelector: React.FC<TimetableSelectorProps> = ({ multipleResults }) => {
  const selectedIndex = useTimetableStore((state) => state.selectedResultIndex);
  const setSelectedResultIndex = useTimetableStore((state) => state.setSelectedResultIndex);

  const handleSelect = (index: number) => {
    setSelectedResultIndex(index);
  };

  return (
    <div className="timetable-selector">
      <h2>생성된 시간표 ({multipleResults.results.length}개)</h2>
      <div className="timetable-cards">
        {multipleResults.results.map((result, index) => {
          const criticalCount = result.violations.filter(v => v.type === 'critical').length;
          const highCount = result.violations.filter(v => v.type === 'high').length;
          const mediumCount = result.violations.filter(v => v.type === 'medium').length;
          const isSelected = selectedIndex === index;

          return (
            <div
              key={index}
              className={`timetable-card ${isSelected ? 'selected' : ''}`}
              onClick={() => handleSelect(index)}
            >
              <div className="card-header">
                <h3>시간표 {index + 1}</h3>
                {index === 0 && <span className="best-badge">최적</span>}
              </div>
              <div className="card-stats">
                <div className="stat">
                  <span className="stat-label">점수:</span>
                  <span className="stat-value">{result.score.toFixed(2)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Critical:</span>
                  <span className={`stat-value ${criticalCount > 0 ? 'error' : 'success'}`}>
                    {criticalCount}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">High:</span>
                  <span className={`stat-value ${highCount > 0 ? 'warning' : 'success'}`}>
                    {highCount}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">Medium:</span>
                  <span className="stat-value">{mediumCount}</span>
                </div>
              </div>
              <button className="select-button">선택</button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

