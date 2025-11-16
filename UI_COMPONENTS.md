# UI 컴포넌트 코드 예시

## 1. Stepper Component

```tsx
// src/components/design-system/Stepper.tsx
"use client";

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
      {steps.map((step) => (
        <div
          key={step.id}
          onClick={() => onStepClick?.(step.id)}
          className={`
            flex items-center p-4 rounded-xl transition-all
            ${step.active ? 'bg-blue-600 text-white shadow-lg' : ''}
            ${step.completed ? 'bg-green-100 text-green-800' : ''}
            ${!step.active && !step.completed ? 'bg-gray-100 text-gray-600' : ''}
            ${onStepClick ? 'cursor-pointer hover:shadow-md' : ''}
          `}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center mr-4 bg-white text-blue-600 font-bold">
            {step.completed ? '✓' : step.id}
          </div>
          <div className="flex-1">
            <div className="font-semibold">{step.name}</div>
          </div>
          <div className="text-2xl">{step.icon}</div>
        </div>
      ))}
    </div>
  );
}
```

## 2. Day Selector Component

```tsx
// src/components/design-system/DaySelector.tsx
"use client";

import { Day } from "@/types/timetable";

interface DaySelectorProps {
  days: Day[];
  selectedDays: Day[];
  onToggle: (day: Day) => void;
}

const DAY_LABELS: Record<Day, string> = {
  월: '월요일',
  화: '화요일',
  수: '수요일',
  목: '목요일',
  금: '금요일',
};

export default function DaySelector({ days, selectedDays, onToggle }: DaySelectorProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {days.map((day) => {
        const isSelected = selectedDays.includes(day);
        return (
          <button
            key={day}
            onClick={() => onToggle(day)}
            className={`
              px-6 py-3 rounded-xl font-semibold transition-all
              ${isSelected
                ? 'bg-blue-600 text-white shadow-lg hover:bg-blue-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }
            `}
          >
            {DAY_LABELS[day]}
          </button>
        );
      })}
    </div>
  );
}
```

## 3. Stat Card Component

```tsx
// src/components/design-system/StatCard.tsx
"use client";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  color?: 'blue' | 'green' | 'purple' | 'orange';
}

export default function StatCard({ label, value, icon, color = 'blue' }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600',
    green: 'bg-gradient-to-br from-green-50 to-green-100 text-green-600',
    purple: 'bg-gradient-to-br from-purple-50 to-purple-100 text-purple-600',
    orange: 'bg-gradient-to-br from-orange-50 to-orange-100 text-orange-600',
  };

  return (
    <div className={`p-6 rounded-xl ${colorClasses[color]} shadow-lg`}>
      <div className="text-center">
        {icon && <div className="text-4xl mb-2">{icon}</div>}
        <div className="text-4xl font-bold mb-2">{value}</div>
        <div className="text-gray-700 font-semibold">{label}</div>
      </div>
    </div>
  );
}
```

## 4. Constraint Toggle Component

```tsx
// src/components/design-system/ConstraintToggle.tsx
"use client";

interface ConstraintToggleProps {
  id: string;
  name: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  priority?: 'critical' | 'high' | 'medium' | 'low';
}

export default function ConstraintToggle({
  id,
  name,
  description,
  checked,
  onChange,
  priority = 'medium',
}: ConstraintToggleProps) {
  const priorityColors = {
    critical: 'border-red-200 bg-red-50',
    high: 'border-orange-200 bg-orange-50',
    medium: 'border-yellow-200 bg-yellow-50',
    low: 'border-blue-200 bg-blue-50',
  };

  return (
    <div className={`p-6 rounded-xl border-2 ${priorityColors[priority]}`}>
      <label className="flex items-start gap-4 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-6 h-6 mt-1 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <div className="flex-1">
          <h3 className="text-xl font-semibold mb-2 text-gray-800">{name}</h3>
          <p className="text-gray-600 text-sm">{description}</p>
        </div>
      </label>
    </div>
  );
}
```

## 5. Progress Bar Component

```tsx
// src/components/design-system/ProgressBar.tsx
"use client";

interface ProgressBarProps {
  percentage: number;
  label?: string;
}

export default function ProgressBar({ percentage, label }: ProgressBarProps) {
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-sm mb-2 text-gray-600">
          <span>{label}</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
```

## 6. Log Viewer Component

```tsx
// src/components/design-system/LogViewer.tsx
"use client";

interface LogViewerProps {
  logs: string[];
  isGenerating?: boolean;
}

export default function LogViewer({ logs, isGenerating }: LogViewerProps) {
  return (
    <div className="bg-gray-900 text-green-400 p-6 rounded-xl font-mono text-sm max-h-96 overflow-y-auto">
      <div className="space-y-1">
        {logs.map((log, index) => (
          <div key={index} className="whitespace-pre-wrap">
            {log}
          </div>
        ))}
        {isGenerating && (
          <div className="animate-pulse text-blue-400">
            생성 중...
          </div>
        )}
      </div>
    </div>
  );
}
```

## 7. Form Input Component

```tsx
// src/components/design-system/FormInput.tsx
"use client";

interface FormInputProps {
  label: string;
  type?: string;
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
}

export default function FormInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  error,
}: FormInputProps) {
  return (
    <div className="form-group">
      <label className="block mb-2 font-semibold text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        className={`
          w-full px-4 py-2 border-2 rounded-lg transition-colors
          ${error
            ? 'border-red-300 focus:border-red-500'
            : 'border-gray-300 focus:border-blue-500'
          }
          focus:outline-none focus:ring-2 focus:ring-blue-200
        `}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
```

## 8. Button Component

```tsx
// src/components/design-system/Button.tsx
"use client";

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled,
  icon,
}: ButtonProps) {
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    ghost: 'text-blue-600 hover:bg-blue-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };

  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        rounded-lg font-semibold transition-all
        shadow-sm hover:shadow-md
        disabled:opacity-50 disabled:cursor-not-allowed
        flex items-center gap-2
      `}
    >
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
}
```

## 사용 예시

```tsx
// 페이지에서 컴포넌트 사용
import Stepper from '@/components/design-system/Stepper';
import DaySelector from '@/components/design-system/DaySelector';
import StatCard from '@/components/design-system/StatCard';
import Button from '@/components/design-system/Button';

export default function ExamplePage() {
  return (
    <div className="container mx-auto p-6">
      <Stepper
        steps={[
          { id: 1, name: '기본 설정', icon: '⚙️', completed: true },
          { id: 2, name: '과목 설정', icon: '📚', active: true },
        ]}
      />
      
      <DaySelector
        days={['월', '화', '수', '목', '금']}
        selectedDays={['월', '화', '수']}
        onToggle={(day) => console.log(day)}
      />
      
      <div className="grid grid-cols-3 gap-4 mt-6">
        <StatCard label="학급 수" value={5} icon="🏫" color="blue" />
        <StatCard label="과목 수" value={10} icon="📚" color="green" />
        <StatCard label="교사 수" value={8} icon="👨‍🏫" color="purple" />
      </div>
      
      <div className="mt-6 flex gap-4">
        <Button variant="primary" icon="→">
          다음 단계
        </Button>
        <Button variant="secondary">
          이전
        </Button>
      </div>
    </div>
  );
}
```
