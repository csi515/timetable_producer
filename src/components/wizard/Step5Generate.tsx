"use client";

import { useState } from "react";
import { TimetableData, Assignment } from "@/types/timetable";
import { BacktrackSolver } from "@/core/csp/backtrackSolver";
import { BacktrackResult } from "@/core/csp/types";

interface Step5GenerateProps {
  data: TimetableData;
  updateData: (updates: Partial<TimetableData>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

export default function Step5Generate({
  data,
  updateData,
  nextStep,
  prevStep,
}: Step5GenerateProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<BacktrackResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const handleGenerate = () => {
    setIsGenerating(true);
    setLogs([]);
    setResult(null);

    // UI 업데이트를 위한 약간의 지연
    setTimeout(() => {
      try {
        const solver = new BacktrackSolver(data, 100000, 10000);
        const generationResult = solver.solve();

        setResult(generationResult);
        setLogs(generationResult.logs);

        if (generationResult.success) {
          updateData({ assignments: generationResult.assignments });
        }
      } catch (error) {
        setLogs([
          ...logs,
          `❌ 오류 발생: ${error instanceof Error ? error.message : String(error)}`,
        ]);
      } finally {
        setIsGenerating(false);
      }
    }, 100);
  };

  const handleClear = () => {
    updateData({ assignments: [] });
    setResult(null);
    setLogs([]);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="card">
        <h2 className="text-3xl font-bold mb-6">시간표 생성</h2>
        <p className="text-gray-600 mb-8">
          CSP 기반 백트래킹 알고리즘을 사용하여 시간표를 생성합니다.
        </p>

        {/* 생성 버튼 */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="btn btn-primary text-lg px-8 py-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? "생성 중..." : "🚀 시간표 생성 시작"}
          </button>
          <button
            onClick={handleClear}
            disabled={isGenerating || data.assignments.length === 0}
            className="btn btn-secondary text-lg px-8 py-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            초기화
          </button>
        </div>

        {/* 결과 표시 */}
        {result && (
          <div
            className={`p-6 rounded-xl border-2 mb-6 ${
              result.success
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <h3
              className={`text-2xl font-bold mb-4 ${
                result.success ? "text-green-800" : "text-red-800"
              }`}
            >
              {result.success ? "✅ 생성 완료!" : "❌ 생성 실패"}
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold">반복 횟수:</span>{" "}
                {result.iterations.toLocaleString()}
              </div>
              <div>
                <span className="font-semibold">백트래킹 횟수:</span>{" "}
                {result.backtracks.toLocaleString()}
              </div>
              <div>
                <span className="font-semibold">배정된 수업:</span>{" "}
                {result.assignments.length}개
              </div>
              <div>
                <span className="font-semibold">위반 사항:</span>{" "}
                {result.violations.length}개
              </div>
            </div>

            {result.violations.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold text-red-800 mb-2">
                  위반 사항:
                </h4>
                <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                  {result.violations.map((violation, index) => (
                    <li key={index}>{violation}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 로그 표시 */}
        {(isGenerating || logs.length > 0) && (
          <div className="bg-gray-900 text-green-400 p-6 rounded-xl font-mono text-sm max-h-96 overflow-y-auto">
            <div className="space-y-1">
              {logs.map((log, index) => (
                <div key={index}>{log}</div>
              ))}
              {isGenerating && (
                <div className="animate-pulse">생성 중...</div>
              )}
            </div>
          </div>
        )}

        {/* 데이터 검증 */}
        <div className="mt-8 p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">
            📊 데이터 검증
          </h3>
          <div className="space-y-2 text-sm text-blue-700">
            <div>
              학급 수: <strong>{data.classes.length}개</strong>
            </div>
            <div>
              과목 수: <strong>{data.subjects.length}개</strong>
            </div>
            <div>
              교사 수: <strong>{data.teachers.length}개</strong>
            </div>
            <div>
              총 필요 시수:{" "}
              <strong>
                {data.teachers.reduce((sum, t) => sum + t.weeklyHours, 0)}시간
              </strong>
            </div>
            <div>
              사용 가능한 슬롯:{" "}
              <strong>
                {data.schoolSchedule.days.reduce(
                  (sum, day) =>
                    sum + data.schoolSchedule.periodsPerDay[day],
                  0
                ) * data.classes.length}
                개
              </strong>
            </div>
          </div>
        </div>

        {/* 네비게이션 */}
        <div className="navigation">
          <button className="btn btn-secondary" onClick={prevStep}>
            이전
          </button>
          <button
            className="btn btn-primary"
            onClick={nextStep}
            disabled={!result?.success || data.assignments.length === 0}
          >
            결과 확인
          </button>
        </div>
      </div>
    </div>
  );
}
