import React from 'react';
import { MultipleScheduleResult } from '../../types/timetable';
import { RelaxationSuggestion } from '../../types/relaxation';
import { ConstraintRelaxer } from '../../core/constraintRelaxer';
import { useTimetableStore } from '../../store/timetableStore';

interface RelaxationGuideProps {
  multipleResults: MultipleScheduleResult;
}

export const RelaxationGuide: React.FC<RelaxationGuideProps> = ({ multipleResults }) => {
  const subjects = useTimetableStore((state) => state.subjects);
  const teachers = useTimetableStore((state) => state.teachers);

  if (multipleResults.results.length > 0) {
    // 성공적으로 생성된 경우
    if (multipleResults.canRelax && multipleResults.relaxationAttempts > 0) {
      return (
        <div className="relaxation-guide success">
          <h3>✅ 시간표 생성 완료</h3>
          <p>
            {multipleResults.relaxationAttempts}개의 제약조건을 완화하여 시간표를 생성했습니다.
          </p>
        </div>
      );
    }
    return null;
  }

  // 생성 실패한 경우
  const relaxer = new ConstraintRelaxer(subjects, teachers);
  const lastResult = multipleResults.results[multipleResults.results.length - 1];
  const suggestions: RelaxationSuggestion[] = lastResult
    ? relaxer.generateSuggestions(lastResult.violations)
    : [];

  return (
    <div className="relaxation-guide error">
      <h3>⚠️ 제약조건이 너무 엄격합니다</h3>
      <p>시간표 생성이 불가능합니다. 다음 제약조건을 완화해주세요:</p>
      
      {suggestions.length > 0 ? (
        <div className="suggestions-list">
          {suggestions.map((suggestion, index) => (
            <div key={index} className="suggestion-item">
              <div className={`suggestion-level ${suggestion.level}`}>
                {suggestion.level === 'critical' ? 'CRITICAL' : 
                 suggestion.level === 'high' ? 'HIGH' :
                 suggestion.level === 'medium' ? 'MEDIUM' : 'LOW'}
              </div>
              <div className="suggestion-content">
                <strong>{suggestion.message}</strong>
                <p>{suggestion.suggestion}</p>
                <div className="affected-constraints">
                  영향받는 제약조건: {suggestion.affectedConstraints.join(', ')}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>제약조건을 수동으로 조정해주세요.</p>
      )}

      <div className="relaxation-help">
        <h4>완화 방법:</h4>
        <ul>
          <li>과목의 주간 시수 줄이기</li>
          <li>교사의 불가능 시간 줄이기</li>
          <li>블록 수업 요구사항 완화</li>
          <li>외부 강사의 하루 몰아넣기 요구사항 완화</li>
        </ul>
      </div>
    </div>
  );
};

