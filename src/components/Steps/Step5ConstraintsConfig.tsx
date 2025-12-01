import React, { useEffect } from 'react';
import { useTimetableStore } from '../../store/timetableStore';

export const Step5ConstraintsConfig: React.FC = () => {
  const subjects = useTimetableStore((state) => state.subjects);
  const teachers = useTimetableStore((state) => state.teachers);
  const setStepValidation = useTimetableStore((state) => state.setStepValidation);

  useEffect(() => {
    // 제약조건은 선택사항이므로 항상 통과
    setStepValidation(5, true);
  }, [setStepValidation]);

  // 공동수업 과목과 교사 매칭 정보 표시
  const coTeachingSubjects = subjects.filter(s => s.isCoTeaching);
  const externalInstructors = teachers.filter(t => t.isExternal);
  const blockClasses = subjects.filter(s => s.isBlockClass);

  return (
    <div className="step-content modern-step-container">
      <div className="step-header">
        <h2>제약조건 확인</h2>
        <p className="step-description">설정된 제약조건을 확인하고 필요시 수정하세요.</p>
      </div>

      <div className="constraints-summary">
        {coTeachingSubjects.length > 0 && (
          <div className="constraint-section">
            <h3>공동수업 과목</h3>
            <div className="constraint-list">
              {coTeachingSubjects.map(subject => (
                <div key={subject.id} className="constraint-item">
                  <strong>{subject.name}</strong>
                  <span className="modern-badge">공동수업</span>
                </div>
              ))}
            </div>
            <p className="constraint-note">
              공동수업은 여러 교사가 동시에 필요한 수업입니다. 시간표 생성 시 동일 시간에 배치됩니다.
            </p>
          </div>
        )}

        {blockClasses.length > 0 && (
          <div className="constraint-section">
            <h3>블록 수업</h3>
            <div className="constraint-list">
              {blockClasses.map(subject => (
                <div key={subject.id} className="constraint-item">
                  <strong>{subject.name}</strong>
                  <span className="modern-badge">블록: {subject.blockHours}교시 연속</span>
                </div>
              ))}
            </div>
            <p className="constraint-note">
              블록 수업은 연속된 교시에 배치됩니다. 충분한 연속 시간이 확보되어야 합니다.
            </p>
          </div>
        )}

        {externalInstructors.length > 0 && (
          <div className="constraint-section">
            <h3>외부 강사</h3>
            <div className="constraint-list">
              {externalInstructors.map(teacher => (
                <div key={teacher.id} className="constraint-item">
                  <strong>{teacher.name}</strong>
                  <span className="modern-badge">외부 강사</span>
                  {subjects.find(s => s.id === teacher.subjects[0])?.preferConcentrated && (
                    <span className="modern-badge">하루 몰아넣기</span>
                  )}
                </div>
              ))}
            </div>
            <p className="constraint-note">
              외부 강사의 경우 하루에 몰아서 배치하는 것을 선호합니다.
            </p>
          </div>
        )}

        {coTeachingSubjects.length === 0 && blockClasses.length === 0 && externalInstructors.length === 0 && (
          <div className="no-constraints">
            <p>특별한 제약조건이 설정되지 않았습니다.</p>
            <p className="hint">공동수업, 블록 수업, 외부 강사 등의 제약조건은 각 단계에서 설정할 수 있습니다.</p>
          </div>
        )}

        <div className="constraint-info">
          <h3>제약조건 우선순위</h3>
          <ol>
            <li><strong>Critical:</strong> 교사 중복 방지, 교사 불가능 시간, 특별실 충돌, 블록 수업 연속 시간</li>
            <li><strong>High:</strong> 시수 충족, 우선 배치 교사 일정, 외부 강사 하루 몰아넣기</li>
            <li><strong>Medium:</strong> 연속 3교시 이상 금지, 점심 전 몰빵 방지</li>
            <li><strong>Low:</strong> 선호 패턴 반영, 이동 최소화</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

