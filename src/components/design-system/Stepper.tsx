"use client";

import { Day } from "@/types/timetable";

interface StepperProps {
  steps: Array<{
    id: number;
    name: string;
    icon: string;
    completed?: boolean;
    active?: boolean;
  }>;
  onStepClick?: (stepId: number) => void;
}

export default function Stepper({ steps, onStepClick }: StepperProps) {
  return (
    <div className="space-y-4">
      <div className="card-header">
        <h3 className="card-title">
          <span className="card-icon">📋</span>
          진행 단계
        </h3>
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => {
          const isActive = step.active;
          const isCompleted = step.completed;
          const isPending = !isActive && !isCompleted;

          return (
            <div
              key={step.id}
              onClick={() => onStepClick && onStepClick(step.id)}
              className={`
                progress-step
                ${isActive ? "active" : ""}
                ${isCompleted ? "completed" : ""}
                ${isPending ? "pending" : ""}
                ${onStepClick ? "cursor-pointer" : ""}
              `}
            >
              <div className="progress-number">
                {isCompleted ? "✓" : step.id}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-lg">{step.name}</div>
              </div>
              <div className="text-2xl">{step.icon}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
