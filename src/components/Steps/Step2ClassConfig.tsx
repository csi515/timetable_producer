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
          name: `${grade}학년 ${classNum}반`
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
  }, [classCounts, config, setConfig, setClasses, setStepValidation]);

  const handleClassCountChange = (gradeIndex: number, count: number) => {
    const newCounts = [...classCounts];
    newCounts[gradeIndex] = Math.max(0, Math.min(20, count));
    setClassCounts(newCounts);
  };

  const totalClasses = classCounts.reduce((sum, count) => sum + count, 0);

  return (
    <div className="step-content">
      <h2>2단계: 학년별 반 수 설정</h2>
      <p className="step-description">각 학년별로 몇 반까지 있는지 입력해주세요. (중고등학교는 모두 3학년까지 있습니다)</p>

      <div className="input-form">
        {[1, 2, 3].map(grade => (
          <div key={grade} className="input-group">
            <label>{grade}학년 학급 수:</label>
            <input
              type="number"
              min="0"
              max="20"
              value={classCounts[grade - 1] || 0}
              onChange={(e) => handleClassCountChange(grade - 1, parseInt(e.target.value) || 0)}
            />
            <span className="input-hint">0개 이상 20개 이하</span>
          </div>
        ))}
      </div>

      <div className="class-summary">
        <h3>학급 목록</h3>
        {totalClasses === 0 ? (
          <p className="empty-message">⚠️ 최소 1개 이상의 학급이 필요합니다. 시간표 생성을 위해 학급을 설정해주세요.</p>
        ) : (
          <>
            <div className="grade-summary">
              {[1, 2, 3].map(grade => {
                const gradeCount = classCounts[grade - 1] || 0;
                return (
                  <div key={grade} className="grade-summary-item">
                    <span className="grade-label">{grade}학년:</span>
                    <span className="grade-count">{gradeCount}개 반</span>
                    {gradeCount === 0 && <span className="no-class-note">(학급 없음)</span>}
                  </div>
                );
              })}
            </div>
            <div className="class-list">
              {classes.map(classInfo => (
                <div key={classInfo.id} className="class-item">
                  {classInfo.name}
                </div>
              ))}
            </div>
          </>
        )}
        <div className="total-summary">
          <strong>총 학급 수: {totalClasses}개</strong>
          {totalClasses === 0 && (
            <p className="warning-message">시간표 생성을 위해 최소 1개 이상의 학급이 필요합니다.</p>
          )}
        </div>
      </div>
    </div>
  );
};

