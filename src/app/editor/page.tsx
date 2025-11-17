"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Step0Start from "@/components/wizard/Step0Start";
import Step1BasicSettings from "@/components/wizard/Step1BasicSettings";
import Step2ClassesSubjects from "@/components/wizard/Step2ClassesSubjects";
import Step3Teachers from "@/components/wizard/Step3Teachers";
import Step4Constraints from "@/components/wizard/Step4Constraints";
import Step5Generate from "@/components/wizard/Step5Generate";
import Step6Review from "@/components/wizard/Step6Review";
import { TimetableData } from "@/types/timetable";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, Upload, CheckCircle2 } from "lucide-react";

const STEPS = [
  { id: 0, name: "시작", component: Step0Start, icon: "🚀" },
  { id: 1, name: "기본 설정", component: Step1BasicSettings, icon: "⚙️" },
  { id: 2, name: "학급/과목", component: Step2ClassesSubjects, icon: "📚" },
  { id: 3, name: "교사 설정", component: Step3Teachers, icon: "👨‍🏫" },
  { id: 4, name: "제약조건", component: Step4Constraints, icon: "🎯" },
  { id: 5, name: "시간표 생성", component: Step5Generate, icon: "🎲" },
  { id: 6, name: "검토/다운로드", component: Step6Review, icon: "📊" },
];

export default function EditorPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<TimetableData>({
    classes: [],
    subjects: [],
    teachers: [],
    schoolSchedule: {
      days: ["월", "화", "수", "목", "금"],
      periodsPerDay: {
        월: 6,
        화: 6,
        수: 6,
        목: 6,
        금: 6,
      },
      lunchPeriod: 4,
    },
    constraints: {
      preventConsecutive3Periods: true,
      preventMorningOverload: true,
      preventDuplicateSubjectPerDay: true,
      ensureEvenDistribution: true,
    },
    assignments: [],
  });

  // 결제 확인
  useEffect(() => {
    const isPaid = localStorage.getItem("paid") === "true";
    if (!isPaid) {
      router.push("/pay");
    }
  }, [router]);

  // 로컬 스토리지에서 데이터 로드
  useEffect(() => {
    const savedData = localStorage.getItem("timetable-data");
    const savedStep = localStorage.getItem("timetable-step");

    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setData(parsedData);
      } catch (error) {
        console.error("저장된 데이터 로드 실패:", error);
      }
    }

    if (savedStep) {
      setCurrentStep(parseInt(savedStep));
    }
  }, []);

  // 데이터 변경 시 로컬 스토리지에 저장
  useEffect(() => {
    localStorage.setItem("timetable-data", JSON.stringify(data));
    localStorage.setItem("timetable-step", currentStep.toString());
  }, [data, currentStep]);

  const updateData = (updates: Partial<TimetableData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step: number) => {
    setCurrentStep(step);
  };

  const exportToJSON = () => {
    const exportData = {
      ...data,
      metadata: {
        exportDate: new Date().toISOString(),
        version: "1.0",
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timetable-config-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importFromJSON = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event: any) => {
          try {
            const jsonData = JSON.parse(event.target.result);
            setData(jsonData);
            alert("설정을 성공적으로 불러왔습니다!");
          } catch (error) {
            console.error("JSON 로드 실패:", error);
            alert("유효하지 않은 JSON 파일입니다.");
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const CurrentStepComponent = STEPS[currentStep].component;
  const progressPercentage = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                🎓 시간표 자동 생성 시스템
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                CSP 기반 백트래킹 알고리즘으로 최적의 시간표 생성
              </p>
            </div>

            {/* JSON Export/Import 버튼 */}
            <div className="flex gap-3">
              <Button
                onClick={exportToJSON}
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                JSON 다운로드
              </Button>
              <Button
                onClick={importFromJSON}
                variant="outline"
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                JSON 업로드
              </Button>
            </div>
          </div>

          {/* 진행률 표시 */}
          {currentStep >= 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 font-medium">진행률</span>
                <span className="text-gray-900 font-semibold">
                  {Math.round(progressPercentage)}%
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          )}
        </div>
      </div>

      {/* 메인 레이아웃 */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 사이드바 */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <span>📋</span>
                  진행 단계
                </h3>

                {/* 단계 표시기 */}
                <div className="space-y-3">
                  {STEPS.map((step) => {
                    const isActive = step.id === currentStep;
                    const isCompleted = step.id < currentStep;
                    const isPending = step.id > currentStep;

                    return (
                      <button
                        key={step.id}
                        onClick={() => step.id <= currentStep && goToStep(step.id)}
                        disabled={step.id > currentStep}
                        className={`
                          w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left
                          ${
                            isActive
                              ? "bg-primary-600 text-white shadow-lg"
                              : isCompleted
                              ? "bg-success-50 text-success-700 border-2 border-success-200 hover:bg-success-100"
                              : "bg-gray-50 text-gray-500 border-2 border-gray-200"
                          }
                          ${step.id <= currentStep ? "cursor-pointer hover:shadow-md" : "cursor-not-allowed"}
                        `}
                      >
                        <div
                          className={`
                            w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0
                            ${
                              isActive
                                ? "bg-white text-primary-600"
                                : isCompleted
                                ? "bg-success-600 text-white"
                                : "bg-gray-300 text-gray-600"
                            }
                          `}
                        >
                          {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : step.id + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{step.name}</div>
                        </div>
                        <span className="text-lg">{step.icon}</span>
                      </button>
                    );
                  })}
                </div>

                {/* 프로젝트 요약 */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span>📊</span>
                    프로젝트 요약
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {data.classes.length}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">학급</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {data.subjects.length}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">과목</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {data.teachers.length}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">교사</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {data.assignments.length}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">배정</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* 메인 콘텐츠 */}
          <div className="lg:col-span-3">
            <Card className="min-h-[600px]">
              <CurrentStepComponent
                data={data}
                updateData={updateData}
                nextStep={nextStep}
                prevStep={prevStep}
                {...(currentStep === 0 ? {} : { goToStep })}
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
