import React, { useState, useEffect } from 'react';
import { useTimetableStore } from './store/timetableStore';
import { useTimetable } from './hooks/useTimetable';
import { WizardContainer } from './components/Wizard/WizardContainer';
import { Step1BasicConfig } from './components/Steps/Step1BasicConfig';
import { Step2ClassConfig } from './components/Steps/Step2ClassConfig';
import { Step3SubjectConfig } from './components/Steps/Step3SubjectConfig';
import { Step4TeacherConfig } from './components/Steps/Step4TeacherConfig';
import { Step5ConstraintsConfig } from './components/Steps/Step5ConstraintsConfig';
import { Step6Review } from './components/Steps/Step6Review';
import { Step7Generation } from './components/Steps/Step7Generation';
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
  const currentStep = useTimetableStore((state) => state.currentStep);
  const config = useTimetableStore((state) => state.config);
  const { generateClasses } = useTimetable();
  const { loadAnchorAd } = useAdSense();
  const [activeTab, setActiveTab] = useState<'wizard' | 'result'>('wizard');

  // 디버깅용
  useEffect(() => {
    console.log('App rendered:', { currentStep, activeTab, config: !!config });
  }, [currentStep, activeTab, config]);

  useEffect(() => {
    loadAnchorAd();
    // Step2에서 학급을 직접 설정하므로 generateClasses는 호출하지 않음
  }, [loadAnchorAd]);

  // 시간표 생성 완료 시 결과 탭으로 이동
  useEffect(() => {
    if (multipleResults && multipleResults.results.length > 0) {
      setActiveTab('result');
    }
  }, [multipleResults]);

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1BasicConfig />;
      case 2:
        return <Step2ClassConfig />;
      case 3:
        return <Step3SubjectConfig />;
      case 4:
        return <Step4TeacherConfig />;
      case 5:
        return <Step5ConstraintsConfig />;
      case 6:
        return <Step6Review />;
      case 7:
        return <Step7Generation />;
      default:
        return <Step1BasicConfig />;
    }
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
            className={activeTab === 'wizard' ? 'active' : ''}
            onClick={() => setActiveTab('wizard')}
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

        {activeTab === 'wizard' && (
          <WizardContainer>
            {renderStep()}
          </WizardContainer>
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

