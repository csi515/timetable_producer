"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Zap, Shield, BarChart3, Download, ArrowRight } from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const isPaid = localStorage.getItem("paid") === "true";
    if (isPaid) {
      router.push("/editor");
    }
  }, [router]);

  const features = [
    {
      icon: Zap,
      title: "빠른 생성",
      description: "CSP 기반 백트래킹 알고리즘으로 최적의 시간표를 빠르게 생성합니다.",
      color: "text-yellow-500",
    },
    {
      icon: Shield,
      title: "정확한 제약조건",
      description: "15개 하드 제약조건과 4개 소프트 제약조건으로 완벽한 시간표를 만듭니다.",
      color: "text-blue-500",
    },
    {
      icon: BarChart3,
      title: "상세한 리포트",
      description: "생성된 시간표의 제약조건 위반 사항을 상세히 확인할 수 있습니다.",
      color: "text-green-500",
    },
    {
      icon: Download,
      title: "Excel 다운로드",
      description: "완성된 시간표를 Excel 파일로 다운로드하여 바로 사용할 수 있습니다.",
      color: "text-purple-500",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative container mx-auto px-4 py-20 lg:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-full text-sm font-semibold mb-6">
              <CheckCircle2 className="w-4 h-4" />
              중·고등학교 시간표 자동 생성 시스템
            </div>
            <h1 className="text-5xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              최적의 시간표를
              <br />
              <span className="bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
                자동으로 생성
              </span>
            </h1>
            <p className="text-xl lg:text-2xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              CSP 기반 백트래킹 알고리즘으로 복잡한 제약조건을 만족하는
              <br />
              완벽한 시간표를 단 몇 분 만에 생성하세요.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => router.push("/pay")}
                className="text-lg px-8 py-6 h-auto shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all"
              >
                시작하기
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => router.push("/editor")}
                className="text-lg px-8 py-6 h-auto"
              >
                데모 보기
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            강력한 기능들
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            시간표 생성에 필요한 모든 기능을 한 곳에 모았습니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card
                key={index}
                className="border-2 hover:border-primary-300 transition-all hover:shadow-xl transform hover:-translate-y-2"
              >
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mb-4 ${feature.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-20">
        <Card className="bg-gradient-to-r from-primary-600 to-purple-600 border-0 text-white">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl mb-4 text-white">
              지금 바로 시작하세요
            </CardTitle>
            <CardDescription className="text-primary-100 text-lg">
              복잡한 시간표 작성을 이제 자동으로 해결하세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => router.push("/pay")}
              className="text-lg px-8 py-6 h-auto"
            >
              결제하고 시작하기
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
