"use client";

import { useState } from "react";
import { TimetableData } from "@/types/timetable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle, Shield, AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Step4ConstraintsProps {
  data: TimetableData;
  updateData: (updates: Partial<TimetableData>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

const constraintOptions = [
  {
    id: "preventConsecutive3Periods",
    name: "연속 3교시 금지",
    description: "같은 교사가 같은 반에서 연속으로 3교시 이상 수업하는 것을 방지합니다.",
    priority: "high" as const,
    icon: AlertTriangle,
    color: "text-warning-600",
  },
  {
    id: "preventMorningOverload",
    name: "점심 전 편중 방지",
    description: `점심 시간 전(${4}교시까지)에 한 교사에게 수업이 편중되지 않도록 배치합니다.`,
    priority: "high" as const,
    icon: AlertCircle,
    color: "text-error-600",
  },
  {
    id: "preventDuplicateSubjectPerDay",
    name: "하루 2회 배정 금지",
    description: "같은 과목이 같은 반에서 하루에 2회 이상 배정되는 것을 방지합니다. (연강 필요한 과목 제외)",
    priority: "medium" as const,
    icon: Info,
    color: "text-blue-600",
  },
  {
    id: "ensureEvenDistribution",
    name: "고르게 분포",
    description: "각 반에 모든 과목이 주간에 고르게 분포되도록 휴리스틱을 적용합니다.",
    priority: "low" as const,
    icon: Shield,
    color: "text-success-600",
  },
];

export default function Step4Constraints({
  data,
  updateData,
  nextStep,
  prevStep,
}: Step4ConstraintsProps) {
  const [constraints, setConstraints] = useState(data.constraints);

  const toggleConstraint = (key: keyof typeof constraints) => {
    setConstraints({
      ...constraints,
      [key]: !constraints[key],
    });
  };

  const handleSave = () => {
    updateData({ constraints });
    nextStep();
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
            <Shield className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">제약조건 설정</h2>
            <p className="text-gray-600 mt-1">
              시간표 생성 시 적용할 제약조건을 설정하세요
            </p>
          </div>
        </div>
      </div>

      {/* 제약조건 옵션 */}
      <div className="space-y-4">
        {constraintOptions.map((option) => {
          const Icon = option.icon;
          const isEnabled = constraints[option.id as keyof typeof constraints] as boolean;
          
          return (
            <Card
              key={option.id}
              className={`
                border-2 transition-all hover:shadow-lg
                ${isEnabled
                  ? "border-primary-300 bg-primary-50"
                  : "border-gray-200 bg-white"
                }
              `}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`
                    w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0
                    ${isEnabled ? "bg-primary-100" : "bg-gray-100"}
                  `}>
                    <Icon className={`w-6 h-6 ${isEnabled ? option.color : "text-gray-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-1">
                          {option.name}
                        </h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {option.description}
                        </p>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() =>
                          toggleConstraint(option.id as keyof typeof constraints)
                        }
                        className="flex-shrink-0"
                      />
                    </div>
                    <div className="mt-3">
                      <span className={`
                        inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold
                        ${
                          option.priority === "high"
                            ? "bg-error-100 text-error-700"
                            : option.priority === "medium"
                            ? "bg-warning-100 text-warning-700"
                            : "bg-success-100 text-success-700"
                        }
                      `}>
                        {option.priority === "high" ? "높은 우선순위" : option.priority === "medium" ? "중간 우선순위" : "낮은 우선순위"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 필수 제약조건 안내 */}
      <Alert variant="info" className="border-primary-200 bg-primary-50">
        <Shield className="w-5 h-5 text-primary-600" />
        <AlertTitle className="text-primary-900 font-semibold">
          항상 적용되는 제약조건
        </AlertTitle>
        <AlertDescription className="text-primary-800 mt-2">
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>교사는 동일 시간대에 두 반을 수업할 수 없습니다.</li>
            <li>한 반도 동일 시간대에 두 과목 수업 불가합니다.</li>
            <li>교사별 주당 시수는 정확히 충족되어야 합니다.</li>
            <li>교사별 불가능 시간은 반영됩니다.</li>
            <li>연강이 필요한 과목은 2교시 연속으로 배치됩니다.</li>
            <li>특별실은 중복 배정되지 않습니다.</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* 네비게이션 */}
      <div className="flex justify-between items-center pt-6 border-t-2 border-gray-200">
        <Button variant="outline" onClick={prevStep} size="lg" className="px-8">
          ← 이전
        </Button>
        <Button onClick={handleSave} size="lg" className="px-8 shadow-lg hover:shadow-xl">
          다음 단계 →
        </Button>
      </div>
    </div>
  );
}
