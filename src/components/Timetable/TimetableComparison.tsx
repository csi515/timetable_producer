import React, { useState } from 'react';
import { MultipleScheduleResult, ScheduleResult } from '../../types/timetable';
import { TimetableView } from './TimetableView';

interface TimetableComparisonProps {
  multipleResults: MultipleScheduleResult;
}

export const TimetableComparison: React.FC<TimetableComparisonProps> = ({ multipleResults }) => {
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  const handleToggleComparison = () => {
    setComparisonMode(!comparisonMode);
    if (!comparisonMode) {
      setSelectedIndices([0, 1].filter(i => i < multipleResults.results.length));
    } else {
      setSelectedIndices([]);
    }
  };

  const handleToggleSelection = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter(i => i !== index));
    } else {
      if (selectedIndices.length < 3) {
        setSelectedIndices([...selectedIndices, index]);
      }
    }
  };

  if (!comparisonMode) {
    const selectedIndex = multipleResults.selectedIndex ?? 0;
    const selectedResult = multipleResults.results[selectedIndex];
    
    if (!selectedResult) return null;

    return (
      <div className="timetable-comparison">
        <div className="comparison-controls">
          <button onClick={handleToggleComparison}>비교 모드</button>
        </div>
        <TimetableView result={selectedResult} viewMode="class" />
      </div>
    );
  }

  return (
    <div className="timetable-comparison">
      <div className="comparison-controls">
        <button onClick={handleToggleComparison}>단일 보기</button>
        <p>비교할 시간표를 선택하세요 (최대 3개)</p>
      </div>
      
      <div className="comparison-selector">
        {multipleResults.results.map((result, index) => {
          const isSelected = selectedIndices.includes(index);
          return (
            <label key={index} className="comparison-checkbox">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggleSelection(index)}
                disabled={!isSelected && selectedIndices.length >= 3}
              />
              시간표 {index + 1} (점수: {result.score.toFixed(2)})
            </label>
          );
        })}
      </div>

      <div className="comparison-grid">
        {selectedIndices.map(index => {
          const result = multipleResults.results[index];
          return (
            <div key={index} className="comparison-item">
              <h3>시간표 {index + 1}</h3>
              <TimetableView result={result} viewMode="class" />
            </div>
          );
        })}
      </div>
    </div>
  );
};

