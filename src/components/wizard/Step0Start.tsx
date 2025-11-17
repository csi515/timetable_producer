"use client";

import { TimetableData } from "@/types/timetable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Settings, BookOpen, User, Target, FileSpreadsheet, AlertCircle } from "lucide-react";

interface Step0StartProps {
  data: TimetableData;
  nextStep: () => void;
}

export default function Step0Start({ data, nextStep }: Step0StartProps) {
  const hasExistingData =
    data.classes.length > 0 ||
    data.subjects.length > 0 ||
    data.teachers.length > 0;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
            🎓 시간표 자동 생성 시스템
          </h2>
        </div>
        <p className="text-xl text-gray-600 mb-2">
          CSP 기반 백트래킹 알고리즘으로 최적의 시간표 생성
        </p>
        <p className="text-lg text-gray-500">
          단계별 가이드를 통해 쉽고 정확한 시간표를 만들어보세요
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 새 시간표 만들기 */}
        <Card className="border-2 border-success-200 bg-gradient-to-br from-success-50 to-emerald-50 hover:border-success-400 transition-all duration-300 transform hover:-translate-y-1">
          <CardContent className="p-8 text-center">
            <div className="text-7xl mb-6">✨</div>
            <CardTitle className="text-3xl font-bold text-success-700 mb-4">
              새 시간표 만들기
            </CardTitle>
            <CardDescription className="text-lg mb-8 text-gray-700">
              처음부터 새로운 시간표를<br />
              단계별로 제작합니다.
            </CardDescription>
            <Button
              onClick={nextStep}
              size="lg"
              className="text-xl px-10 py-6 h-auto shadow-lg hover:shadow-xl transform hover:scale-105 transition-all bg-success-600 hover:bg-success-700"
            >
              🚀 새로 시작하기
            </Button>
          </CardContent>
        </Card>

        {/* 주요 기능 */}
        <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-indigo-700 flex items-center gap-2">
              <Sparkles className="w-6 h-6" />
              주요 기능
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  icon: Settings,
                  title: "기본 설정",
                  desc: "학교 운영 시간표 설정",
                  color: "text-blue-600",
                },
                {
                  icon: BookOpen,
                  title: "학급/과목 관리",
                  desc: "학급 목록 및 과목 설정",
                  color: "text-green-600",
                },
                {
                  icon: User,
                  title: "교사 관리",
                  desc: "교사별 담당 과목 및 시수",
                  color: "text-purple-600",
                },
                {
                  icon: Target,
                  title: "CSP 알고리즘",
                  desc: "백트래킹으로 최적화",
                  color: "text-orange-600",
                },
                {
                  icon: FileSpreadsheet,
                  title: "Excel 내보내기",
                  desc: "완성된 시간표 저장",
                  color: "text-indigo-600",
                },
              ].map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={index}
                    className="flex items-center p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
                  >
                    <div className={`w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mr-4 ${feature.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-gray-800 text-lg mb-1">
                        {feature.title}
                      </div>
                      <div className="text-gray-600">{feature.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 진행 중인 작업 알림 */}
      {hasExistingData && (
        <Card className="border-2 border-warning-200 bg-warning-50">
          <CardContent className="p-8">
            <div className="flex items-center mb-4">
              <AlertCircle className="w-8 h-8 text-warning-600 mr-4" />
              <CardTitle className="text-2xl font-bold text-warning-900">
                진행 중인 작업이 감지되었습니다
              </CardTitle>
            </div>
            <CardDescription className="text-lg text-gray-700 mb-6">
              이전에 작업하던 시간표 데이터가 브라우저에 저장되어 있습니다.
            </CardDescription>
            <div className="flex justify-center">
              <Button
                onClick={nextStep}
                size="lg"
                className="px-10 py-6 h-auto text-lg"
              >
                기존 작업 계속하기
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
