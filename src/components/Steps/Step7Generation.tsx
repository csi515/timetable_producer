import React, { useState, useEffect } from 'react';
import { useTimetableStore } from '../../store/timetableStore';
import { useTimetable } from '../../hooks/useTimetable';
import { useAdSense } from '../../hooks/useAdSense';

export const Step7Generation: React.FC = () => {
  const config = useTimetableStore((state) => state.config);
  const subjects = useTimetableStore((state) => state.subjects);
  const teachers = useTimetableStore((state) => state.teachers);
  const classes = useTimetableStore((state) => state.classes);
  const isLoading = useTimetableStore((state) => state.isLoading);
  const multipleResults = useTimetableStore((state) => state.multipleResults);
  const { generateMultiple } = useTimetable();
  const { showInterstitial } = useAdSense();
  const [generationCount, setGenerationCount] = useState(3);

  const canGenerate = config && subjects.length > 0 && teachers.length > 0 && classes.length > 0;

  const handleGenerate = async () => {
    if (!canGenerate) {
      alert('필수 정보가 입력되지 않았습니다.');
      return;
    }

    // 광고 표시
    await showInterstitial();

    // 시간표 생성
    await generateMultiple(generationCount);
  };

  return (
    <div className="step-content modern-step-container">
      <div className="step-header">
        <h2>시간표 생성</h2>
        <p className="step-description">모든 설정이 완료되었습니다. 시간표를 생성하세요.</p>
      </div>

      {!canGenerate && (
        <div className="generation-error">
          <p>⚠️ 시간표 생성을 위해 다음 정보가 필요합니다:</p>
          <ul>
            {!config && <li>기본 설정 (1단계)</li>}
            {classes.length === 0 && <li>학급 설정 (2단계)</li>}
            {subjects.length === 0 && <li>과목 설정 (3단계)</li>}
            {teachers.length === 0 && <li>교사 설정 (4단계)</li>}
          </ul>
        </div>
      )}

      {canGenerate && (
        <>
          <div className="generation-settings">
            <div className="modern-input-group">
              <label className="modern-label">생성할 시간표 개수:</label>
              <input
                type="number"
                min="1"
                max="10"
                value={generationCount}
                onChange={(e) => setGenerationCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 3)))}
                className="modern-input"
              />
              <span className="input-hint-modern">1개 이상 10개 이하</span>
            </div>
          </div>

          <div className="generate-button-container">
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="generate-button"
            >
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  시간표 생성 중...
                </>
              ) : (
                <>
                  🎲 시간표 {generationCount}개 생성하기
                  <small>(광고 시청 후 생성됩니다)</small>
                </>
              )}
            </button>
          </div>

          {multipleResults && multipleResults.results.length > 0 && (
            <div className="generation-success">
              <h3>✅ 시간표 생성 완료!</h3>
              <p>{multipleResults.results.length}개의 시간표가 생성되었습니다.</p>
              <p className="hint">결과 탭에서 생성된 시간표를 확인할 수 있습니다.</p>
            </div>
          )}

          {multipleResults && multipleResults.results.length === 0 && (
            <div className="generation-error">
              <h3>⚠️ 시간표 생성 실패</h3>
              <p>제약조건이 너무 엄격하여 시간표를 생성할 수 없습니다.</p>
              <p className="hint">제약조건을 완화하거나 설정을 조정해주세요.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

