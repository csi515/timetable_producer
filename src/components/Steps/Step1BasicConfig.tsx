import React, { useState, useEffect } from 'react';
import { ScheduleConfig } from '../../types/timetable';
import { useTimetableStore } from '../../store/timetableStore';

export const Step1BasicConfig: React.FC = () => {
  const config = useTimetableStore((state) => state.config);
  const setConfig = useTimetableStore((state) => state.setConfig);
  const setStepValidation = useTimetableStore((state) => state.setStepValidation);

  // 학년은 항상 3학년으로 고정
  const grade = 3;
  const [maxPeriods, setMaxPeriods] = useState(config?.maxPeriodsPerDay || 7);
  const [selectedDays, setSelectedDays] = useState<string[]>(config?.days || ['월', '화', '수', '목', '금']);
  
  // 점심시간은 항상 4교시와 5교시 사이 (4교시 다음)
  const lunchPeriod = 4;

  const days = ['월', '화', '수', '목', '금'];

  useEffect(() => {
    const newConfig: ScheduleConfig = {
      grade: 3, // 항상 3학년으로 고정
      numberOfClasses: 0, // Step2에서 설정
      days: selectedDays,
      maxPeriodsPerDay: maxPeriods,
      lunchPeriod: 4 // 항상 4교시와 5교시 사이
    };
    setConfig(newConfig);
    setStepValidation(1, true);
  }, [maxPeriods, selectedDays, setConfig, setStepValidation]);

  const handleDayToggle = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  return (
    <div className="step-content">
      <h2>1단계: 기본 설정</h2>
      <p className="step-description">시간표의 기본 정보를 입력해주세요.</p>

      <div className="input-form">
        <div className="input-group">
          <label>1일 최대 교시:</label>
          <label>1일 최대 교시:</label>
          <input
            type="number"
            min="5"
            max="10"
            value={maxPeriods}
            onChange={(e) => setMaxPeriods(parseInt(e.target.value) || 7)}
          />
          <span className="input-hint">하루에 진행할 수 있는 최대 교시 수</span>
        </div>

        <div className="input-group">
          <label>요일 선택:</label>
          <div className="day-selector">
            {days.map(day => (
              <label key={day} className="day-checkbox">
                <input
                  type="checkbox"
                  checked={selectedDays.includes(day)}
                  onChange={() => handleDayToggle(day)}
                />
                {day}요일
              </label>
            ))}
          </div>
          <span className="input-hint">시간표에 포함할 요일을 선택하세요</span>
        </div>
      </div>

      <div className="config-summary">
        <h3>설정 요약</h3>
        <ul>
          <li>학년: 3학년 (고정)</li>
          <li>1일 최대 교시: {maxPeriods}교시</li>
          <li>점심 시간: 4교시와 5교시 사이 (고정)</li>
          <li>선택된 요일: {selectedDays.join(', ')}</li>
        </ul>
      </div>
    </div>
  );
};

