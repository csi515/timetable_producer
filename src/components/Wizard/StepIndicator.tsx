import React from 'react';
import { useTimetableStore } from '../../store/timetableStore';

const steps = [
  { id: 1, title: '기본 설정', icon: '⚙️' },
  { id: 2, title: '학급 설정', icon: '🏫' },
  { id: 3, title: '과목 설정', icon: '📚' },
  { id: 4, title: '교사 설정', icon: '👨‍🏫' },
  { id: 5, title: '제약조건', icon: '🎯' },
  { id: 6, title: '최종 확인', icon: '✅' },
  { id: 7, title: '생성', icon: '🎲' }
];

export const StepIndicator: React.FC = () => {
  const currentStep = useTimetableStore((state) => state.currentStep);
  const setCurrentStep = useTimetableStore((state) => state.setCurrentStep);
  const validateStep = useTimetableStore((state) => state.validateStep);

  const handleStepClick = (stepId: number) => {
    if (stepId <= currentStep || validateStep(stepId - 1)) {
      setCurrentStep(stepId);
    }
  };

  return (
    <div className="step-indicator-modern">
      <div className="step-progress-bar">
        <div
          className="step-progress-fill"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />
      </div>
      <div className="steps-wrapper">
        {steps.map((step) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          const isAccessible = step.id <= currentStep || validateStep(step.id - 1);

          return (
            <div
              key={step.id}
              className={`step-item-modern ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${!isAccessible ? 'disabled' : ''}`}
              onClick={() => isAccessible && handleStepClick(step.id)}
            >
              <div className="step-circle">
                {isCompleted ? '✓' : step.id}
              </div>
              <span className="step-label">{step.title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
