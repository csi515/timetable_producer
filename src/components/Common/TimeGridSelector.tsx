import React, { useState } from 'react';

interface TimeGridSelectorProps {
  days: string[];
  maxPeriods: number;
  selectedTimes: { day: string; period: number }[];
  onSelectionChange: (selected: { day: string; period: number }[]) => void;
  mode?: 'available' | 'unavailable'; // 가능한 시간 / 불가능한 시간
}

export const TimeGridSelector: React.FC<TimeGridSelectorProps> = ({
  days,
  maxPeriods,
  selectedTimes,
  onSelectionChange,
  mode = 'available'
}) => {
  const [selectMode, setSelectMode] = useState<'single' | 'range'>('single');

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
    
    onSelectionChange(newSelected);
  };

  const handleSelectAll = () => {
    const all: { day: string; period: number }[] = [];
    days.forEach(day => {
      for (let period = 1; period <= maxPeriods; period++) {
        all.push({ day, period });
      }
    });
    onSelectionChange(all);
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  const handleSelectTimeRange = (startPeriod: number, endPeriod: number) => {
    const range: { day: string; period: number }[] = [];
    days.forEach(day => {
      for (let period = startPeriod; period <= endPeriod; period++) {
        range.push({ day, period });
      }
    });
    onSelectionChange([...selectedTimes, ...range]);
  };

  return (
    <div className="time-grid-selector">
      <div className="grid-controls">
        <button type="button" onClick={handleSelectAll}>전체 선택</button>
        <button type="button" onClick={handleClearAll}>전체 해제</button>
        <div className="time-range-buttons">
          <span>시간대 선택:</span>
          <button type="button" onClick={() => handleSelectTimeRange(1, 3)}>1-3교시</button>
          <button type="button" onClick={() => handleSelectTimeRange(4, 6)}>4-6교시</button>
          <button type="button" onClick={() => handleSelectTimeRange(7, maxPeriods)}>7교시 이상</button>
        </div>
      </div>
      <div className="time-grid">
        <table>
          <thead>
            <tr>
              <th>요일/교시</th>
              {days.map(day => (
                <th key={day}>{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxPeriods }, (_, i) => i + 1).map(period => (
              <tr key={period}>
                <td className="period-label">{period}교시</td>
                {days.map(day => (
                  <td
                    key={`${day}-${period}`}
                    className={`time-cell ${isSelected(day, period) ? 'selected' : ''}`}
                    onClick={() => handleCellClick(day, period)}
                  >
                    {isSelected(day, period) ? '✓' : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="selection-summary">
        선택된 시간: {selectedTimes.length}개
      </div>
    </div>
  );
};

