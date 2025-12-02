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
  const [isGuideExpanded, setIsGuideExpanded] = useState<boolean>(false);

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
    setGradeConfigs(prev => {
      const currentMaxPeriod = prev[grade].dailyMaxPeriods[day] || 7;
      // 이미 선택된 교시를 다시 클릭하면 이전 교시로 변경 (토글)
      const newMaxPeriod = currentMaxPeriod === period ? Math.max(1, period - 1) : period;
      
      return {
        ...prev,
        [grade]: {
          ...prev[grade],
          dailyMaxPeriods: {
            ...prev[grade].dailyMaxPeriods,
            [day]: newMaxPeriod
          }
        }
      };
    });
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

      {/* 사용 가이드 섹션 - AdSense 가치 있는 인벤토리 정책 준수 */}
      <div className="modern-config-card mt-8">
        <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsGuideExpanded(!isGuideExpanded)}>
          <h3 className="section-title mb-0">📖 시간표 생성기 사용 가이드</h3>
          <span className="text-text-secondary text-lg">{isGuideExpanded ? '▼' : '▶'}</span>
        </div>

        {isGuideExpanded && (
          <>
            <div className="config-section">
              <h4 className="text-lg font-semibold mb-3">프로그램 사용 방법</h4>
              <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                <div className="flex gap-3">
                  <span className="font-bold text-blue-500 shrink-0">1단계:</span>
                  <p>학년별 수업 요일과 최대 교시를 설정합니다. 각 학년마다 다른 시간표 구조를 설정할 수 있습니다.</p>
                </div>
                <div className="flex gap-3">
                  <span className="font-bold text-blue-500 shrink-0">2단계:</span>
                  <p>학급 정보를 입력합니다. 학년과 반 번호를 지정하여 학급을 생성합니다.</p>
                </div>
                <div className="flex gap-3">
                  <span className="font-bold text-blue-500 shrink-0">3단계:</span>
                  <p>과목을 추가하고 주간 시수, 블록 수업 여부, 특별실 사용 여부 등을 설정합니다.</p>
                </div>
                <div className="flex gap-3">
                  <span className="font-bold text-blue-500 shrink-0">4단계:</span>
                  <p>교사 정보를 입력하고 담당 과목, 불가능한 시간, 하루 최대 수업 시수 등을 설정합니다.</p>
                </div>
                <div className="flex gap-3">
                  <span className="font-bold text-blue-500 shrink-0">5단계:</span>
                  <p>제약조건(교사 중복 방지, 특별실 충돌 방지, 연속 수업 제한 등)을 검토하고 시간표를 생성합니다.</p>
                </div>
                <div className="flex gap-3">
                  <span className="font-bold text-blue-500 shrink-0">6단계:</span>
                  <p>생성된 시간표를 확인하고, 필요시 드래그 앤 드롭으로 수정하거나 엑셀/PDF로 내보냅니다.</p>
                </div>
              </div>
            </div>

            <div className="config-section mt-6">
              <h4 className="text-lg font-semibold mb-3">🧠 CSP 알고리즘 원리</h4>
              <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                <p>
                  <strong className="text-blue-600">제약 충족 문제(Constraint Satisfaction Problem, CSP)</strong>는
                  주어진 제약조건을 모두 만족하는 해를 찾는 알고리즘입니다. 시간표 생성은 대표적인 CSP 문제로,
                  다음과 같은 복잡한 제약조건들을 동시에 만족해야 합니다.
                </p>

                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <p className="font-semibold mb-2">주요 제약조건:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>Critical:</strong> 교사 중복 방지, 특별실 충돌 방지, 교사 불가능 시간 회피</li>
                    <li><strong>High:</strong> 주간 시수 충족, 교사 하루 최대 시수 준수</li>
                    <li><strong>Medium:</strong> 연속 3교시 이상 금지, 점심 전 수업 분산</li>
                    <li><strong>Low:</strong> 선호 패턴 반영, 교실 이동 최소화</li>
                  </ul>
                </div>

                <p>
                  <strong className="text-blue-600">백트래킹(Backtracking)</strong> 기법을 사용하여
                  각 수업을 배치할 때마다 제약조건을 검증하고, 위반 시 이전 단계로 되돌아가 다른 선택을 시도합니다.
                  이를 통해 가능한 모든 경우의 수를 효율적으로 탐색합니다.
                </p>

                <p>
                  <strong className="text-blue-600">제약조건 완화(Constraint Relaxation)</strong>:
                  해를 찾지 못할 경우, 우선순위가 낮은 제약조건을 점진적으로 완화하여
                  실용적인 시간표를 생성합니다. Critical 제약은 절대 완화하지 않으며,
                  Low → Medium → High 순서로 완화를 시도합니다.
                </p>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="font-semibold text-blue-800 dark:text-blue-300 mb-2">💡 최적화 전략</p>
                  <p>
                    복잡한 학교 현장의 요구사항을 반영하기 위해 소프트 제약조건(Soft Constraints)을 사용합니다.
                    각 제약조건에 가중치를 부여하여 완벽한 해가 없을 때도 가장 좋은 해를 찾아냅니다.
                    예: 교실 이동 최소화(1.0), 연속 수업 방지(2.0), 점심 전 분산(1.5)
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
