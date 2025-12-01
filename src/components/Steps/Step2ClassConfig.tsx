import React, { useState, useEffect } from 'react';
import { ClassInfo, ScheduleConfig } from '../../types/timetable';
import { useTimetableStore } from '../../store/timetableStore';

export const Step2ClassConfig: React.FC = () => {
  const config = useTimetableStore((state) => state.config);
  const classes = useTimetableStore((state) => state.classes);
  const setClasses = useTimetableStore((state) => state.setClasses);
  const setConfig = useTimetableStore((state) => state.setConfig);
  const setStepValidation = useTimetableStore((state) => state.setStepValidation);

  const [classCounts, setClassCounts] = useState<number[]>(() => {
    if (classes.length > 0) {
      // 기존 학급 정보에서 학년별 학급 수 추출 (항상 3학년)
      const counts: number[] = [];
      for (let i = 1; i <= 3; i++) {
        const count = classes.filter(c => c.grade === i).length;
        counts.push(count || 0);
      }
      return counts;
    }
    // 항상 3학년으로 고정
    return [0, 0, 0];
  });

  const [lunchPeriods, setLunchPeriods] = useState<Record<number, number>>({
    1: 4, 2: 4, 3: 4
  });

  useEffect(() => {
    if (!config) {
      // config가 없으면 기본 설정 생성 (3학년 고정)
      const defaultConfig: ScheduleConfig = {
        grade: 3,
        numberOfClasses: 0,
        days: ['월', '화', '수', '목', '금'],
        maxPeriodsPerDay: 7,
        lunchPeriod: 4
      };
      setConfig(defaultConfig);
    }

    const newClasses: ClassInfo[] = [];
    const totalClasses = classCounts.reduce((sum, count) => sum + count, 0);

    // 항상 1, 2, 3학년 처리
    for (let grade = 1; grade <= 3; grade++) {
      const count = classCounts[grade - 1] || 0;
      for (let classNum = 1; classNum <= count; classNum++) {
        newClasses.push({
          id: `${grade}학년-${classNum}반`,
          grade,
          classNumber: classNum,
          name: `${grade}학년 ${classNum}반`,
          lunchPeriod: lunchPeriods[grade] || 4
        });
      }
    }

    // config의 numberOfClasses 업데이트
    const updatedConfig: ScheduleConfig = {
      ...(config || {
        grade: 3,
        days: ['월', '화', '수', '목', '금'],
        maxPeriodsPerDay: 7,
        lunchPeriod: 4
      }),
      numberOfClasses: totalClasses
    };
    setConfig(updatedConfig);
    setClasses(newClasses);
    // 총 학급 수가 0개가 아니면 유효 (일부 학년은 학급이 없을 수 있음)
    setStepValidation(2, totalClasses > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classCounts, lunchPeriods]); // classCounts와 lunchPeriods 의존성으로 설정

  const handleClassCountChange = (gradeIndex: number, count: number) => {
    const newCounts = [...classCounts];
    newCounts[gradeIndex] = Math.max(0, Math.min(20, count));
    setClassCounts(newCounts);
  };

  const handleLunchPeriodChange = (grade: number, period: number) => {
    setLunchPeriods(prev => ({
      ...prev,
      [grade]: period
    }));
  };

  const totalClasses = classCounts.reduce((sum, count) => sum + count, 0);

  return (
    <div className="step-content modern-step-container">
      <div className="step-header">
        <h2>학년별 반 수 설정</h2>
        <p className="step-description">각 학년별로 몇 반까지 있는지 입력해주세요.</p>
      </div>

      <div className="modern-config-card">
        <div className="config-section">
          <h3 className="section-title">학급 수 입력</h3>
          <div className="grade-inputs">
            {[1, 2, 3].map(grade => (
              <div key={grade} className="modern-input-group">
                <label className="modern-label">{grade}학년</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">학급 수</label>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={classCounts[grade - 1] || 0}
                      onChange={(e) => handleClassCountChange(grade - 1, parseInt(e.target.value) || 0)}
                      className="modern-input w-full"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">점심시간 (교시 후)</label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      defaultValue={4}
                      onChange={(e) => handleLunchPeriodChange(grade, parseInt(e.target.value) || 4)}
                      className="modern-input w-full"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {totalClasses > 0 && (
          <div className="config-section">
            <h3 className="section-title">학급 목록</h3>
            <div className="modern-class-grid">
              {classes.map(classInfo => (
                <div key={classInfo.id} className="modern-class-tag">
                  {classInfo.name}
                </div>
              ))}
            </div>
            <div className="summary-box">
              <strong>총 {totalClasses}개 학급</strong>
            </div>
          </div>
        )}

        {totalClasses === 0 && (
          <div className="empty-state">
            <p>⚠️ 최소 1개 이상의 학급이 필요합니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};

