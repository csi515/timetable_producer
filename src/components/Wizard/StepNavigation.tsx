import React from 'react';
import { useTimetableStore } from '../../store/timetableStore';

export const StepNavigation: React.FC = () => {
  const currentStep = useTimetableStore((state) => state.currentStep);
  const maxStep = useTimetableStore((state) => state.maxStep);
  const nextStep = useTimetableStore((state) => state.nextStep);
  const prevStep = useTimetableStore((state) => state.prevStep);
  const validateStep = useTimetableStore((state) => state.validateStep);

  const canGoNext = validateStep(currentStep);
  const canGoPrev = currentStep > 1;

  return (
    <div className="step-navigation">
      <button
        className="nav-button prev-button"
        onClick={prevStep}
        disabled={!canGoPrev}
      >
        ← 이전
      </button>
      <div className="step-info">
        {currentStep} / {maxStep}
      </div>
      <button
        className="nav-button next-button"
        onClick={nextStep}
        disabled={!canGoNext}
      >
        다음 →
      </button>
    </div>
  );
};

