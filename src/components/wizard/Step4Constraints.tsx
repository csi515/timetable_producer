"use client";

import { useState } from "react";
import { TimetableData } from "@/types/timetable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, AlertTriangle, Info } from "lucide-react";

interface Step4ConstraintsProps {
  data: TimetableData;
  updateData: (updates: Partial<TimetableData>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

export default function Step4Constraints({
  data,
  updateData,
  nextStep,
  prevStep,
}: Step4ConstraintsProps) {
  const [constraints, setConstraints] = useState(data.constraints);

  const handleSave = () => {
    updateData({ constraints });
    nextStep();
  };

  const constraintOptions = [
    {
      id: "preventConsecutive3Periods",
      title: "연속 3교시 금지",
      description: "같은 교사가 같은 반에서 연속으로 3교시 이상 수업하는 것을 방지합니다.",
      priority: "high" as const,
    },
    {
      id: "preventMorningOverload",
      title: "점심 전 편중 방지",
      description: `점심 시간 전 교시에 한 교사에게 수업이 편중되지 않도록 배치합니다. (점심 시간: ${data.schoolSchedule.lunchPeriod}교시까지)`,
      priority: "high" as const,
    },
    {
      id: "preventDuplicateSubjectPerDay",
      title: "하루 2회 배정 금지",
      description: "같은 과목이 같은 반에서 하루에 2회 이상 배정되는 것을 방지합니다. (연강 필요한 과목 제외)",
      priority: "medium" as const,
    },
    {
      id: "ensureEvenDistribution",
      title: "고르게 분포",
      description: "각 반에 모든 과목이 주간에 고르게 분포되도록 휴리스틱을 적용합니다.",
      priority: "low" as const,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <CardTitle className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary-600" />
          제약조건 설정
        </CardTitle>
        <CardDescription className="text-lg mt-2">
          시간표 생성 시 적용할 제약조건을 설정하세요. 각 옵션을 켜고 끌 수 있습니다.
        </CardDescription>
      </div>

      <div className="space-y-4 mb-8">
        {constraintOptions.map((option) => {
          const isEnabled = constraints[option.id as keyof typeof constraints] as boolean;
          const priorityColors = {
            high: "border-orange-200 bg-orange-50",
            medium: "border-yellow-200 bg-yellow-50",
            low: "border-blue-200 bg-blue-50",
          };

          return (
            <Card
              key={option.id}
              className={`border-2 transition-all hover:shadow-lg ${priorityColors[option.priority]}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Switch
                    id={option.id}
                    checked={isEnabled}
                    onCheckedChange={(checked) =>
                      setConstraints({
                        ...constraints,
                        [option.id]: checked,
                      })
                    }
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Label
                        htmlFor={option.id}
                        className="text-xl font-semibold text-gray-900 cursor-pointer"
                      >
                        {option.title}
                      </Label>
                      <span
                        className={`
                          px-2 py-1 rounded text-xs font-semibold
                          ${
                            option.priority === "high"
                              ? "bg-orange-100 text-orange-700"
                              : option.priority === "medium"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-blue-100 text-blue-700"
                          }
                        `}
                      >
                        {option.priority === "high"
                          ? "높음"
                          : option.priority === "medium"
                          ? "중간"
                          : "낮음"}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {option.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 필수 제약조건 안내 */}
      <Alert variant="info" className="mb-8">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle className="text-lg font-semibold mb-2">
          항상 적용되는 제약조건
        </AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
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
      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <Button variant="outline" onClick={prevStep} size="lg">
          이전
        </Button>
        <Button onClick={handleSave} size="lg" className="px-8">
          다음 단계
        </Button>
      </div>
    </div>
  );
}
