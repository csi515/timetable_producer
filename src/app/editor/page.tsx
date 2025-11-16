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
import { Download, Upload } from "lucide-react";

const STEPS = [
  { id: 0, name: "시작", component: Step0Start },
  { id: 1, name: "기본 설정", component: Step1BasicSettings },
  { id: 2, name: "학급/과목 설정", component: Step2ClassesSubjects },
  { id: 3, name: "교사 설정", component: Step3Teachers },
  { id: 4, name: "제약조건 설정", component: Step4Constraints },
  { id: 5, name: "시간표 생성", component: Step5Generate },
  { id: 6, name: "검토/다운로드", component: Step6Review },
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
      <div className="header">
        <h1>🎓 시간표 자동 생성 시스템</h1>
        <p className="text-lg opacity-90">
          CSP 기반 백트래킹 알고리즘으로 최적의 시간표 생성
        </p>

        {/* JSON Export/Import 버튼 */}
        <div className="mt-6 flex justify-center gap-4">
          <button
            onClick={exportToJSON}
            className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            JSON 다운로드
          </button>
          <button
            onClick={importFromJSON}
            className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 flex items-center gap-2"
          >
            <Upload className="w-5 h-5" />
            JSON 업로드
          </button>
        </div>

        {/* 진행률 표시 */}
        {currentStep >= 0 && (
          <div className="mt-6 max-w-2xl mx-auto">
            <div className="flex justify-between text-sm mb-2">
              <span>진행률</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <div className="w-full bg-white bg-opacity-30 rounded-full h-3">
              <div
                className="bg-white h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* 메인 레이아웃 */}
      <div className="container">
        <div className="desktop-layout">
          {/* 사이드바 */}
          <div className="sidebar">
            <div className="card-header">
              <h3 className="card-title">
                <span className="card-icon">📋</span>
                진행 단계
              </h3>
            </div>

            {/* 단계 표시기 */}
            <div className="space-y-4 mb-8">
              {STEPS.map((step) => {
                const isActive = step.id === currentStep;
                const isCompleted = step.id < currentStep;
                const isPending = step.id > currentStep;

                return (
                  <div
                    key={step.id}
                    className={`progress-step ${
                      isActive
                        ? "active"
                        : isCompleted
                        ? "completed"
                        : "pending"
                    }`}
                    onClick={() => step.id <= currentStep && goToStep(step.id)}
                    style={{
                      cursor: step.id <= currentStep ? "pointer" : "default",
                    }}
                  >
                    <div className="progress-number">
                      {isCompleted ? "✓" : step.id + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-lg">{step.name}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 프로젝트 요약 정보 */}
            <div className="section-card">
              <div className="card-header">
                <h4 className="card-title">
                  <span className="card-icon">📊</span>
                  프로젝트 요약
                </h4>
              </div>
              <div className="space-y-4">
                <div className="stat-card">
                  <div className="stat-number">{data.classes.length}</div>
                  <div className="stat-label">학급 수</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{data.subjects.length}</div>
                  <div className="stat-label">과목 수</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{data.teachers.length}</div>
                  <div className="stat-label">교사 수</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{data.assignments.length}</div>
                  <div className="stat-label">배정된 수업</div>
                </div>
              </div>
            </div>
          </div>

          {/* 메인 콘텐츠 */}
          <div className="main-content">
            <CurrentStepComponent
              data={data}
              updateData={updateData}
              nextStep={nextStep}
              prevStep={prevStep}
              goToStep={goToStep}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
