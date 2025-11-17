"use client";

import { useState } from "react";
import { TimetableData, Assignment } from "@/types/timetable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { BacktrackSolver } from "@/core/csp/backtrackSolver";
import { BacktrackResult } from "@/core/csp/types";
import { Zap, RotateCcw, CheckCircle2, XCircle, Loader2, BarChart3 } from "lucide-react";

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
  const [progress, setProgress] = useState(0);

  const handleGenerate = () => {
    setIsGenerating(true);
    setLogs([]);
    setResult(null);
    setProgress(0);

    // 진행률 시뮬레이션
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    // 실제 생성 (비동기)
    setTimeout(() => {
      try {
        const solver = new BacktrackSolver(data, 100000, 10000);
        const generationResult = solver.solve();

        clearInterval(progressInterval);
        setProgress(100);
        setResult(generationResult);
        setLogs(generationResult.logs);

        if (generationResult.success) {
          updateData({ assignments: generationResult.assignments });
        }
      } catch (error) {
        clearInterval(progressInterval);
        setLogs([
          ...logs,
          `❌ 오류 발생: ${error instanceof Error ? error.message : String(error)}`,
        ]);
      } finally {
        setIsGenerating(false);
      }
    }, 2000);
  };

  const handleClear = () => {
    updateData({ assignments: [] });
    setResult(null);
    setLogs([]);
    setProgress(0);
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">시간표 생성</h2>
            <p className="text-gray-600 mt-1">
              CSP 기반 백트래킹 알고리즘을 사용하여 시간표를 생성합니다
            </p>
          </div>
        </div>
      </div>

      {/* 생성 버튼 */}
      <Card className="border-2">
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              size="lg"
              className="text-lg px-8 py-6 h-auto shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <Zap className="mr-2 w-5 h-5" />
                  🚀 시간표 생성 시작
                </>
              )}
            </Button>
            <Button
              onClick={handleClear}
              disabled={isGenerating || data.assignments.length === 0}
              variant="outline"
              size="lg"
              className="text-lg px-8 py-6 h-auto"
            >
              <RotateCcw className="mr-2 w-5 h-5" />
              초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 진행률 표시 */}
      {isGenerating && (
        <Card className="border-2 border-primary-200 bg-primary-50">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">생성 진행률</span>
                <span className="text-sm font-bold text-primary-700">{progress}%</span>
              </div>
              <Progress value={progress} className="h-3" />
              <p className="text-sm text-gray-600 text-center">
                제약조건을 만족하는 최적의 시간표를 찾고 있습니다...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 결과 표시 */}
      {result && (
        <Alert
          variant={result.success ? "success" : "destructive"}
          className={`
            border-2
            ${result.success
              ? "border-success-200 bg-success-50"
              : "border-error-200 bg-error-50"
            }
          `}
        >
          {result.success ? (
            <CheckCircle2 className="w-5 h-5 text-success-600" />
          ) : (
            <XCircle className="w-5 h-5 text-error-600" />
          )}
          <AlertTitle className={result.success ? "text-success-900" : "text-error-900"}>
            {result.success ? "✅ 생성 완료!" : "❌ 생성 실패"}
          </AlertTitle>
          <AlertDescription className={result.success ? "text-success-800" : "text-error-800"}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div>
                <div className="text-xs text-gray-600 mb-1">반복 횟수</div>
                <div className="text-lg font-bold">{result.iterations.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">백트래킹</div>
                <div className="text-lg font-bold">{result.backtracks.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">배정된 수업</div>
                <div className="text-lg font-bold">{result.assignments.length}개</div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">위반 사항</div>
                <div className="text-lg font-bold">{result.violations.length}개</div>
              </div>
            </div>

            {result.violations.length > 0 && (
              <div className="mt-4">
                <div className="font-semibold mb-2">위반 사항:</div>
                <ul className="list-disc list-inside text-sm space-y-1 max-h-32 overflow-y-auto">
                  {result.violations.map((violation, index) => (
                    <li key={index}>{violation}</li>
                  ))}
                </ul>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* 로그 표시 */}
      {(isGenerating || logs.length > 0) && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              생성 로그
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-900 text-green-400 p-6 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="whitespace-pre-wrap">
                    {log}
                  </div>
                ))}
                {isGenerating && (
                  <div className="text-blue-400 animate-pulse flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    생성 중...
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 데이터 검증 */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            📊 데이터 검증
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg p-4 text-center shadow-sm">
              <div className="text-2xl font-bold text-primary-600 mb-1">
                {data.classes.length}
              </div>
              <div className="text-xs font-semibold text-gray-600">학급 수</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center shadow-sm">
              <div className="text-2xl font-bold text-success-600 mb-1">
                {data.subjects.length}
              </div>
              <div className="text-xs font-semibold text-gray-600">과목 수</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center shadow-sm">
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {data.teachers.length}
              </div>
              <div className="text-xs font-semibold text-gray-600">교사 수</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center shadow-sm">
              <div className="text-2xl font-bold text-orange-600 mb-1">
                {data.teachers.reduce((sum, t) => sum + t.weeklyHours, 0)}
              </div>
              <div className="text-xs font-semibold text-gray-600">총 필요 시수</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center shadow-sm">
              <div className="text-2xl font-bold text-indigo-600 mb-1">
                {data.schoolSchedule.days.reduce(
                  (sum, day) => sum + data.schoolSchedule.periodsPerDay[day],
                  0
                ) * data.classes.length}
              </div>
              <div className="text-xs font-semibold text-gray-600">사용 가능 슬롯</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 네비게이션 */}
      <div className="flex justify-between items-center pt-6 border-t-2 border-gray-200">
        <Button variant="outline" onClick={prevStep} size="lg" className="px-8">
          ← 이전
        </Button>
        <Button
          onClick={nextStep}
          size="lg"
          className="px-8 shadow-lg hover:shadow-xl"
          disabled={!result?.success || data.assignments.length === 0}
        >
          결과 확인 →
        </Button>
      </div>
    </div>
  );
}
