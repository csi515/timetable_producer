"use client";

import { useState } from "react";
import { TimetableData, Assignment } from "@/types/timetable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { BacktrackSolver } from "@/core/csp/backtrackSolver";
import { BacktrackResult } from "@/core/csp/types";
import { Play, RotateCcw, CheckCircle2, XCircle, Loader2, BarChart3 } from "lucide-react";

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
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <CardTitle className="text-3xl font-bold mb-2 flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-primary-600" />
          시간표 생성
        </CardTitle>
        <CardDescription className="text-lg mt-2">
          CSP 기반 백트래킹 알고리즘을 사용하여 시간표를 생성합니다.
        </CardDescription>
      </div>

      {/* 생성 버튼 */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              size="lg"
              className="gap-2 text-lg px-8"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  시간표 생성 시작
                </>
              )}
            </Button>
            <Button
              onClick={handleClear}
              disabled={isGenerating || data.assignments.length === 0}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 결과 표시 */}
      {result && (
        <Card className={`mb-6 border-2 ${
          result.success
            ? "border-success-200 bg-success-50"
            : "border-error-200 bg-error-50"
        }`}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${
              result.success ? "text-success-700" : "text-error-700"
            }`}>
              {result.success ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <XCircle className="w-6 h-6" />
              )}
              {result.success ? "생성 완료!" : "생성 실패"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {result.iterations.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 mt-1">반복 횟수</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {result.backtracks.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 mt-1">백트래킹</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {result.assignments.length}
                </div>
                <div className="text-sm text-gray-600 mt-1">배정된 수업</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {result.violations.length}
                </div>
                <div className="text-sm text-gray-600 mt-1">위반 사항</div>
              </div>
            </div>

            {result.violations.length > 0 && (
              <Alert variant="destructive" className="mt-4">
                <AlertTitle>위반 사항</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    {result.violations.map((violation, index) => (
                      <li key={index} className="text-sm">{violation}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* 로그 표시 */}
      {(isGenerating || logs.length > 0) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">생성 로그</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-900 text-green-400 p-6 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="whitespace-pre-wrap">{log}</div>
                ))}
                {isGenerating && (
                  <div className="animate-pulse text-blue-400 flex items-center gap-2">
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
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            데이터 검증
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{data.classes.length}</div>
              <div className="text-sm text-gray-600 mt-1">학급 수</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{data.subjects.length}</div>
              <div className="text-sm text-gray-600 mt-1">과목 수</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{data.teachers.length}</div>
              <div className="text-sm text-gray-600 mt-1">교사 수</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {data.teachers.reduce((sum, t) => sum + t.weeklyHours, 0)}
              </div>
              <div className="text-sm text-gray-600 mt-1">총 필요 시수</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">
                {data.schoolSchedule.days.reduce(
                  (sum, day) => sum + data.schoolSchedule.periodsPerDay[day],
                  0
                ) * data.classes.length}
              </div>
              <div className="text-sm text-gray-600 mt-1">사용 가능 슬롯</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 네비게이션 */}
      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <Button variant="outline" onClick={prevStep} size="lg">
          이전
        </Button>
        <Button
          onClick={nextStep}
          disabled={!result?.success || data.assignments.length === 0}
          size="lg"
          className="px-8"
        >
          결과 확인
        </Button>
      </div>
    </div>
  );
}
