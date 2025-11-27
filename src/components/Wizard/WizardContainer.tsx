import React from 'react';
import { StepIndicator } from './StepIndicator';
import { StepNavigation } from './StepNavigation';

interface WizardContainerProps {
  children: React.ReactNode;
}

export const WizardContainer: React.FC<WizardContainerProps> = ({ children }) => {
  return (
    <div className="wizard-container">
      <StepIndicator />
      <div className="wizard-content">
        {children}
      </div>
      <StepNavigation />
    </div>
  );
};

