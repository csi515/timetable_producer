import React, { useState } from 'react';
import { ScheduleConfig } from '../../types/timetable';
import { useTimetableStore } from '../../store/timetableStore';

export const ScheduleConfigInput: React.FC = () => {
  const setConfig = useTimetableStore((state) => state.setConfig);
  const [grade, setGrade] = useState(1);
  const [numberOfClasses, setNumberOfClasses] = useState(4);
  const [maxPeriods, setMaxPeriods] = useState(7);
  const [lunchPeriod, setLunchPeriod] = useState(5);
  const [selectedDays, setSelectedDays] = useState<string[]>(['월', '화', '수', '목', '금']);

  const days = ['월', '화', '수', '목', '금'];

  const handleDayToggle = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSave = () => {
    const config: ScheduleConfig = {
      grade,
      numberOfClasses,
      days: selectedDays,
      maxPeriodsPerDay: maxPeriods,
      lunchPeriod
    };
    setConfig(config);
    alert('설정이 저장되었습니다.');
  };

  return (
    <div className="config-input">
      <h2>시간표 기본 설정</h2>
      <div className="input-group">
        <label>학년:</label>
        <input
          type="number"
          min="1"
          max="3"
          value={grade}
          onChange={(e) => setGrade(parseInt(e.target.value))}
        />
      </div>
      <div className="input-group">
        <label>학급 수:</label>
        <input
          type="number"
          min="1"
          max="20"
          value={numberOfClasses}
          onChange={(e) => setNumberOfClasses(parseInt(e.target.value))}
        />
      </div>
      <div className="input-group">
        <label>1일 최대 교시:</label>
        <input
          type="number"
          min="5"
          max="10"
          value={maxPeriods}
          onChange={(e) => setMaxPeriods(parseInt(e.target.value))}
        />
      </div>
      <div className="input-group">
        <label>점심 시간 교시:</label>
        <input
          type="number"
          min="4"
          max="7"
          value={lunchPeriod}
          onChange={(e) => setLunchPeriod(parseInt(e.target.value))}
        />
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
              {day}
            </label>
          ))}
        </div>
      </div>
      <button onClick={handleSave}>설정 저장</button>
    </div>
  );
};

