import React, { useState, useEffect } from 'react';
import { useTimetableStore } from './store/timetableStore';
import { useTimetable } from './hooks/useTimetable';
import { ScheduleConfigInput } from './components/Input/ScheduleConfigInput';
import { SubjectInput } from './components/Input/SubjectInput';
import { TeacherInput } from './components/Input/TeacherInput';
import { TimetableView } from './components/Timetable/TimetableView';
import { TimetableSelector } from './components/Timetable/TimetableSelector';
import { TimetableComparison } from './components/Timetable/TimetableComparison';
import { ConstraintViolations } from './components/Constraints/ConstraintViolations';
import { RelaxationGuide } from './components/Constraints/RelaxationGuide';
import { ExportButtons } from './components/Export/ExportButtons';
import { useAdSense } from './hooks/useAdSense';

function App() {
  const result = useTimetableStore((state) => state.result);
  const multipleResults = useTimetableStore((state) => state.multipleResults);
  const isLoading = useTimetableStore((state) => state.isLoading);
  const config = useTimetableStore((state) => state.config);
  const { generate, generateMultiple, generateClasses } = useTimetable();
  const { loadAnchorAd } = useAdSense();
  const [activeTab, setActiveTab] = useState<'input' | 'result'>('input');

  useEffect(() => {
    loadAnchorAd();
    if (config) {
      generateClasses();
    }
  }, [config, loadAnchorAd, generateClasses]);

  const handleGenerate = async () => {
    await generateMultiple(3);
    setActiveTab('result');
  };

  return (
    <div className="app">
      <header>
        <h1>📅 시간표 생성기</h1>
        <p>중고등학교 교사를 위한 시간표 자동 생성 도구</p>
      </header>
      <main>
        <div className="tabs">
          <button
            className={activeTab === 'input' ? 'active' : ''}
            onClick={() => setActiveTab('input')}
          >
            입력
          </button>
          <button
            className={activeTab === 'result' ? 'active' : ''}
            onClick={() => setActiveTab('result')}
            disabled={!multipleResults && !result}
          >
            결과
          </button>
        </div>

        {activeTab === 'input' && (
          <div className="input-section">
            <ScheduleConfigInput />
            <SubjectInput />
            <TeacherInput />
            <div className="generate-section">
              <button
                onClick={handleGenerate}
                disabled={isLoading || !config}
                className="generate-button"
              >
                {isLoading ? '생성 중...' : '랜덤 시간표 3개 생성 (광고 시청 후)'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'result' && (
          <div className="result-section">
            {multipleResults ? (
              <>
                <RelaxationGuide multipleResults={multipleResults} />
                <TimetableSelector multipleResults={multipleResults} />
                <TimetableComparison multipleResults={multipleResults} />
                {result && (
                  <>
                    <ConstraintViolations violations={result.violations} />
                    <ExportButtons result={result} />
                  </>
                )}
              </>
            ) : result ? (
              <>
                <TimetableView result={result} viewMode="class" />
                <ConstraintViolations violations={result.violations} />
                <ExportButtons result={result} />
              </>
            ) : (
              <div className="no-result">
                <p>생성된 시간표가 없습니다.</p>
              </div>
            )}
          </div>
        )}

        {/* Anchor 광고 */}
        <div className="ad-container anchor-ad">
          <ins
            className="adsbygoogle"
            style={{ display: 'block' }}
            data-ad-client="ca-pub-YOUR_PUBLISHER_ID"
            data-ad-slot="YOUR_AD_SLOT_ID"
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </main>
    </div>
  );
}

export default App;

