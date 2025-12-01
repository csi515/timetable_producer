import React from 'react';

interface TimeGridSelectorProps {
  days: string[];
  maxPeriods: number;
  selectedTimes: { day: string; period: number }[];
  onSelectedChange: (times: { day: string; period: number }[]) => void;
  type?: 'unavailable' | 'fixed'; // unavailable: 불가능한 시간(빨강), fixed: 고정된 시간(파랑/초록)
  labels?: {
    selected: string;
    unselected: string;
    clearAll: string;
    selectAll: string;
  };
}

export const TimeGridSelector: React.FC<TimeGridSelectorProps> = ({
  days,
  maxPeriods,
  selectedTimes,
  onSelectedChange,
  type = 'unavailable',
  labels = {
    selected: '선택됨',
    unselected: '선택 안됨',
    clearAll: '전체 해제',
    selectAll: '전체 선택'
  }
}) => {
  const isSelected = (day: string, period: number) => {
    return selectedTimes.some(t => t.day === day && t.period === period);
  };

  const handleCellClick = (day: string, period: number) => {
    const newSelected = [...selectedTimes];
    const index = newSelected.findIndex(t => t.day === day && t.period === period);

    if (index >= 0) {
      newSelected.splice(index, 1);
    } else {
      newSelected.push({ day, period });
    }

    onSelectedChange(newSelected);
  };

  const handleClearAll = () => {
    onSelectedChange([]);
  };

  const handleSelectAll = () => {
    const all: { day: string; period: number }[] = [];
    days.forEach(day => {
      for (let period = 1; period <= maxPeriods; period++) {
        all.push({ day, period });
      }
    });
    onSelectedChange(all);
  };

  const availableCount = (days.length * maxPeriods) - selectedTimes.length;

  return (
    <div className="time-grid-selector-modern">
      <div className="grid-controls-modern">
        <button type="button" onClick={handleClearAll} className="control-button">
          {labels.clearAll}
        </button>
        <button type="button" onClick={handleSelectAll} className="control-button">
          {labels.selectAll}
        </button>
        <span className="time-summary">
          선택됨: <strong>{selectedTimes.length}</strong>개
        </span>
      </div>

      <div className="modern-timetable">
        <table className="timetable-grid">
          <thead>
            <tr>
              <th className="corner-cell">교시 \ 요일</th>
              {days.map(day => (
                <th key={day} className="day-header">{day}요일</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxPeriods }, (_, i) => i + 1).map(period => (
              <tr key={period}>
                <td className="period-header">{period}교시</td>
                {days.map(day => {
                  const selected = isSelected(day, period);
                  const cellClass = selected
                    ? (type === 'unavailable' ? 'unavailable' : 'fixed-time')
                    : 'available';

                  return (
                    <td
                      key={`${day}-${period}`}
                      className={`timetable-cell ${cellClass}`}
                      onClick={() => handleCellClick(day, period)}
                    >
                      {selected ? '✓' : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid-legend">
        <div className="legend-item">
          <div className="legend-box available"></div>
          <span>{labels.unselected}</span>
        </div>
        <div className="legend-item">
          <div className={`legend-box ${type === 'unavailable' ? 'unavailable' : 'fixed-time'}`}></div>
          <span>{labels.selected}</span>
        </div>
      </div>
    </div>
  );
};

