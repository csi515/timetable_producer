import React from 'react';
import { StepIndicator } from './StepIndicator';
import { StepNavigation } from './StepNavigation';

interface WizardContainerProps {
  children: React.ReactNode;
}

export const WizardContainer: React.FC<WizardContainerProps> = ({ children }) => {
  return (
    <div className="wizard-container">
      {/* Modern Minimal Header */}
      <div className="wizard-header-minimal">
        <div className="header-content">
          <h1 className="app-title">📅 시간표 생성기</h1>
          <button
            className="template-button-minimal"
            onClick={() => document.dispatchEvent(new CustomEvent('openTemplateManager'))}
            title="템플릿 관리"
          >
            📋 템플릿
          </button>
        </div>
        <StepIndicator />
      </div>

      {/* Main Content */}
      <main className="wizard-main">
        {children}
        <StepNavigation />
      </main>
    </div>
  );
};
