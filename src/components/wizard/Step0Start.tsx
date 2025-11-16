"use client";

import { TimetableData } from "@/types/timetable";

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
    <div className="max-w-4xl mx-auto">
      <div className="feature-card text-center mb-12 bg-gradient-to-br from-white to-blue-50 border-2 border-blue-200">
        <h2 className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6">
          🎓 시간표 자동 생성 시스템
        </h2>
        <p className="text-2xl text-gray-600 mb-4">
          CSP 기반 백트래킹 알고리즘으로 최적의 시간표 생성
        </p>
        <p className="text-lg text-gray-500">
          단계별 가이드를 통해 쉽고 정확한 시간표를 만들어보세요
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        <div className="feature-card bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 hover:border-emerald-400 transition-all duration-300 transform hover:-translate-y-2">
          <div className="text-center">
            <div className="text-8xl mb-8">✨</div>
            <h3 className="text-3xl font-bold text-emerald-700 mb-6">
              새 시간표 만들기
            </h3>
            <p className="text-gray-600 mb-10 leading-relaxed text-lg">
              처음부터 새로운 시간표를<br />
              단계별로 제작합니다.
            </p>
            <button
              className="btn btn-success text-xl px-10 py-5 hover:scale-105 transition-transform shadow-xl"
              onClick={nextStep}
            >
              🚀 새로 시작하기
            </button>
          </div>
        </div>

        <div className="feature-card bg-gradient-to-br from-indigo-50 to-purple-100 border-2 border-indigo-200">
          <div className="text-center mb-8">
            <div className="text-8xl mb-6">💡</div>
            <h3 className="text-3xl font-bold text-indigo-700 mb-6">
              주요 기능
            </h3>
          </div>
          <div className="space-y-6">
            {[
              {
                icon: "⚙️",
                title: "기본 설정",
                desc: "학교 운영 시간표 설정",
              },
              {
                icon: "📚",
                title: "학급/과목 관리",
                desc: "학급 목록 및 과목 설정",
              },
              {
                icon: "👨‍🏫",
                title: "교사 관리",
                desc: "교사별 담당 과목 및 시수",
              },
              {
                icon: "🎯",
                title: "CSP 알고리즘",
                desc: "백트래킹으로 최적화",
              },
              {
                icon: "📊",
                title: "Excel 내보내기",
                desc: "완성된 시간표 저장",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="flex items-center p-6 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                <span className="text-4xl mr-6">{feature.icon}</span>
                <div className="flex-1">
                  <div className="font-bold text-gray-800 text-xl mb-2">
                    {feature.title}
                  </div>
                  <div className="text-gray-600 text-lg">{feature.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {hasExistingData && (
        <div className="alert alert-warning max-w-4xl mx-auto">
          <div className="flex items-center mb-6">
            <span className="text-4xl mr-4">🔍</span>
            <h4 className="text-2xl font-bold">
              진행 중인 작업이 감지되었습니다
            </h4>
          </div>
          <p className="mb-8 text-gray-700 text-lg">
            이전에 작업하던 시간표 데이터가 브라우저에 저장되어 있습니다.
          </p>
          <div className="flex gap-6 justify-center">
            <button
              className="btn btn-primary px-10 py-4 text-lg"
              onClick={nextStep}
            >
              기존 작업 계속하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
