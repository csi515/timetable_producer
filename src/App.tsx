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
import { StatisticsDisplay } from './components/Common/StatisticsDisplay';
import { calculateTeacherWorkload, calculateClassDistribution } from './utils/statistics';
import { ExportButtons } from './components/Export/ExportButtons';
import { useAdSense } from './hooks/useAdSense';
import { TemplateManager } from './components/Templates/TemplateManager';


import { PrivacyPolicy } from './components/Common/PrivacyPolicy';

function App() {
  const result = useTimetableStore((state) => state.result);
  const multipleResults = useTimetableStore((state) => state.multipleResults);
  const teachers = useTimetableStore((state) => state.teachers);
  const classes = useTimetableStore((state) => state.classes);
  const currentStep = useTimetableStore((state) => state.currentStep);
  const config = useTimetableStore((state) => state.config);
  const { generateClasses } = useTimetable();
  const { loadAnchorAd } = useAdSense();
  const [activeTab, setActiveTab] = useState<'wizard' | 'result'>('wizard');
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);


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

  // 템플릿 관리 모달 열기 이벤트 리스너
  useEffect(() => {
    const handleOpenTemplateManager = () => setShowTemplateManager(true);
    document.addEventListener('openTemplateManager', handleOpenTemplateManager);
    return () => document.removeEventListener('openTemplateManager', handleOpenTemplateManager);
  }, []);

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
      {/* 헤더 제거됨 (WizardContainer 사이드바로 이동) */}

      <main>
        {/* 탭 네비게이션은 결과 화면에서만 필요하거나, 상단에 작게 배치 */}
        {activeTab === 'result' && (
          <div className="tabs" style={{ padding: '1rem 2rem' }}>
            <button onClick={() => setActiveTab('wizard')}>← 설정으로 돌아가기</button>
            <button className="active">결과 확인</button>
          </div>
        )}

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
                    {/* 통계 표시 */}
                    <StatisticsDisplay
                      teacherWorkload={calculateTeacherWorkload(result.entries, teachers)}
                      classDistribution={calculateClassDistribution(result.entries, classes)}
                    />
                    <ConstraintViolations violations={result.violations} />
                    <ExportButtons result={result} />
                  </>
                )}
              </>
            ) : result ? (
              <>
                <TimetableView result={result} viewMode="class" />
                {/* 통계 표시 */}
                <StatisticsDisplay
                  teacherWorkload={calculateTeacherWorkload(result.entries, teachers)}
                  classDistribution={calculateClassDistribution(result.entries, classes)}
                />
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

      {/* Footer with Privacy Policy Link */}
      <footer className="py-4 text-center text-sm text-gray-500">
        <button
          onClick={() => setShowPrivacyPolicy(true)}
          className="hover:underline hover:text-gray-700"
        >
          개인정보처리방침
        </button>
      </footer>

      {/* 템플릿 관리 모달 */}
      <TemplateManager
        isOpen={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
      />

      {/* 개인정보처리방침 모달 */}
      <PrivacyPolicy
        isOpen={showPrivacyPolicy}
        onClose={() => setShowPrivacyPolicy(false)}
      />
    </div>
  );
}

export default App;

