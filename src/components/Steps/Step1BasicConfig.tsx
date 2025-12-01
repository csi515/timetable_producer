import React, { useEffect, useState } from 'react';
import { useTimetableStore } from '../../store/timetableStore';
import { ScheduleConfig, DailyScheduleConfig } from '../../types/timetable';

const DAYS = ['월', '화', '수', '목', '금'];
const MAX_PERIODS = 8;
const GRADES = [1, 2, 3];

export const Step1BasicConfig: React.FC = () => {
  const config = useTimetableStore((state) => state.config);
  const setConfig = useTimetableStore((state) => state.setConfig);
  const setStepValidation = useTimetableStore((state) => state.setStepValidation);

  const [activeGrade, setActiveGrade] = useState<number>(1);

  // 학년별 설정 상태 관리
  const [gradeConfigs, setGradeConfigs] = useState<{ [grade: number]: DailyScheduleConfig }>({
    1: { days: [...DAYS], dailyMaxPeriods: { '월': 7, '화': 7, '수': 6, '목': 7, '금': 7 } },
    2: { days: [...DAYS], dailyMaxPeriods: { '월': 7, '화': 7, '수': 6, '목': 7, '금': 7 } },
    3: { days: [...DAYS], dailyMaxPeriods: { '월': 7, '화': 7, '수': 6, '목': 7, '금': 7 } }
  });

  // 초기 로드 시 기존 설정 불러오기
  useEffect(() => {
    if (config?.gradeConfigs) {
      setGradeConfigs(config.gradeConfigs);
    } else if (config) {
      // 기존 단일 설정이 있다면 1,2,3학년에 동일하게 적용 (마이그레이션)
      const initialConfig = {
        days: config.days || [...DAYS],
        dailyMaxPeriods: config.dailyMaxPeriods ||
          DAYS.reduce((acc, day) => ({ ...acc, [day]: config.maxPeriodsPerDay || 7 }), {})
      };
      setGradeConfigs({
        1: { ...initialConfig },
        2: { ...initialConfig },
        3: { ...initialConfig }
      });
    }
  }, []);

  // 설정 변경 시 스토어 업데이트
  useEffect(() => {
    // 대표 설정(1학년 기준)과 전체 설정을 함께 저장
    const currentGradeConfig = gradeConfigs[1];

    const newConfig: ScheduleConfig = {
      grade: 1, // 대표값
      numberOfClasses: config?.numberOfClasses || 0, // 기존 값 유지
      days: currentGradeConfig.days,
      maxPeriodsPerDay: 7, // 대표값
      dailyMaxPeriods: currentGradeConfig.dailyMaxPeriods,
      lunchPeriod: 4,
      gradeConfigs: gradeConfigs
    };

    setConfig(newConfig);
    setStepValidation(1, true);
  }, [gradeConfigs, setConfig, setStepValidation]);

  const handleDayToggle = (grade: number, day: string) => {
    setGradeConfigs(prev => {
      const currentDays = prev[grade].days;
      const newDays = currentDays.includes(day)
        ? currentDays.filter(d => d !== day)
        : [...DAYS].filter(d => [...currentDays, day].includes(d)); // 순서 유지

      return {
        ...prev,
        [grade]: { ...prev[grade], days: newDays }
      };
    });
  };

  const handlePeriodClick = (grade: number, day: string, period: number) => {
    setGradeConfigs(prev => ({
      ...prev,
      [grade]: {
        ...prev[grade],
        dailyMaxPeriods: {
          ...prev[grade].dailyMaxPeriods,
          [day]: period
        }
      }
    }));
  };

  return (
    <div className="step-content modern-step-container">
      <div className="step-header">
        <div className="flex justify-between items-center">
          <div>
            <h2>기본 설정</h2>
            <p className="step-description">학년별 수업 요일과 최대 교시를 설정하세요.</p>
          </div>
          <div>
            <input
              type="file"
              id="config-import"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                  try {
                    const data = JSON.parse(event.target?.result as string);
                    if (data.config && data.classes && data.subjects && data.teachers) {
                      useTimetableStore.getState().setConfig(data.config);
                      useTimetableStore.getState().setClasses(data.classes);
                      useTimetableStore.getState().setSubjects(data.subjects);
                      useTimetableStore.getState().setTeachers(data.teachers);

                      // 로컬 상태 업데이트
                      if (data.config.gradeConfigs) {
                        setGradeConfigs(data.config.gradeConfigs);
                      }

                      alert('설정을 성공적으로 불러왔습니다.');
                    } else {
                      alert('올바르지 않은 설정 파일입니다.');
                    }
                  } catch (err) {
                    console.error(err);
                    alert('파일을 읽는 중 오류가 발생했습니다.');
                  }
                };
                reader.readAsText(file);
                // Reset input
                e.target.value = '';
              }}
            />
            <button
              className="modern-button secondary"
              onClick={() => document.getElementById('config-import')?.click()}
            >
              📂 설정 불러오기
            </button>
          </div>
        </div>
      </div>

      {/* Modern Grade Tabs */}
      <div className="modern-tabs">
        {GRADES.map(grade => (
          <button
            key={grade}
            className={`modern-tab ${activeGrade === grade ? 'active' : ''}`}
            onClick={() => setActiveGrade(grade)}
          >
            {grade}학년
          </button>
        ))}
      </div>

      {/* Configuration Area */}
      <div className="modern-config-card">

        {/* Day Selection */}
        <div className="config-section">
          <h3 className="section-title">수업 요일</h3>
          <div className="day-toggles">
            {DAYS.map(day => (
              <label key={day} className={`day-toggle ${gradeConfigs[activeGrade].days.includes(day) ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={gradeConfigs[activeGrade].days.includes(day)}
                  onChange={() => handleDayToggle(activeGrade, day)}
                  hidden
                />
                <span className="toggle-label">{day}요일</span>
              </label>
            ))}
          </div>
        </div>

        {/* Transposed Grid: Rows = Days, Cols = Periods */}
        <div className="config-section">
          <h3 className="section-title">요일별 교시 설정</h3>
          <p className="section-hint">각 요일의 마지막 교시를 클릭하여 설정하세요.</p>

          <div className="modern-grid-container">
            <table className="modern-grid">
              <thead>
                <tr>
                  <th className="row-header">요일</th>
                  {Array.from({ length: MAX_PERIODS }, (_, i) => i + 1).map(period => (
                    <th key={period} className="col-header">{period}교시</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gradeConfigs[activeGrade].days.map(day => (
                  <tr key={day}>
                    <td className="row-label">{day}요일</td>
                    {Array.from({ length: MAX_PERIODS }, (_, i) => i + 1).map(period => {
                      const maxPeriod = gradeConfigs[activeGrade].dailyMaxPeriods[day] || 7;
                      const isActive = period <= maxPeriod;

                      return (
                        <td key={`${day}-${period}`} onClick={() => handlePeriodClick(activeGrade, day, period)}>
                          <div className={`modern-cell ${isActive ? 'active' : ''}`}>
                            {isActive && <span className="cell-indicator"></span>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
