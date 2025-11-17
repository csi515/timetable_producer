"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, CreditCard, Shield, Zap, Check } from "lucide-react";

export default function PayPage() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handlePayment = async () => {
    setIsProcessing(true);
    
    // 결제 시뮬레이션
    setTimeout(() => {
      const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("paid", "true");
      localStorage.setItem("session_token", sessionToken);
      
      setIsProcessing(false);
      setIsSuccess(true);
      
      setTimeout(() => {
        router.push("/editor");
      }, 2000);
    }, 1500);
  };

  const benefits = [
    "무제한 시간표 생성",
    "고급 제약조건 설정",
    "JSON 데이터 저장/불러오기",
    "Excel 다운로드",
    "상세한 리포트 생성",
    "전문 고객 지원",
  ];

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-2 border-success-200 shadow-2xl">
          <CardHeader className="text-center">
            <div className="w-20 h-20 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-12 h-12 text-success-600" />
            </div>
            <CardTitle className="text-3xl text-success-700">결제 완료!</CardTitle>
            <CardDescription className="text-lg mt-2">
              결제가 성공적으로 완료되었습니다.
              <br />
              잠시 후 입력 페이지로 이동합니다.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 결제 정보 카드 */}
        <Card className="shadow-2xl border-2">
          <CardHeader className="bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-t-xl">
            <CardTitle className="text-2xl flex items-center gap-2">
              <CreditCard className="w-6 h-6" />
              결제 정보
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-600 text-lg">서비스 이용료</span>
                  <span className="text-3xl font-bold text-primary-600">₩99,000</span>
                </div>
                <div className="border-t border-gray-300 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-semibold text-gray-800">총 결제금액</span>
                    <span className="text-3xl font-bold text-primary-600">₩99,000</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary-600" />
                  포함된 기능
                </h3>
                <ul className="space-y-3">
                  {benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center gap-3 text-gray-700">
                      <div className="w-6 h-6 rounded-full bg-success-100 flex items-center justify-center flex-shrink-0">
                        <Check className="w-4 h-4 text-success-600" />
                      </div>
                      <span className="text-base">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Alert variant="info" className="border-primary-200 bg-primary-50">
                <AlertTitle className="text-primary-900">안전한 결제</AlertTitle>
                <AlertDescription className="text-primary-800">
                  모든 결제 정보는 암호화되어 안전하게 처리됩니다.
                </AlertDescription>
              </Alert>

              <Button
                onClick={handlePayment}
                disabled={isProcessing}
                size="lg"
                className="w-full text-lg py-6 h-auto shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all"
              >
                {isProcessing ? (
                  <>
                    <Zap className="mr-2 w-5 h-5 animate-spin" />
                    결제 처리 중...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 w-5 h-5" />
                    결제하기
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 서비스 소개 카드 */}
        <div className="space-y-6">
          <Card className="shadow-xl border-2">
            <CardHeader>
              <CardTitle className="text-2xl">왜 이 서비스를 선택해야 할까요?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">빠른 생성</h4>
                  <p className="text-gray-600 text-sm">
                    복잡한 시간표를 몇 분 만에 자동으로 생성합니다.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-success-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-success-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">정확한 결과</h4>
                  <p className="text-gray-600 text-sm">
                    15개 하드 제약조건을 모두 만족하는 시간표를 생성합니다.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">안전한 저장</h4>
                  <p className="text-gray-600 text-sm">
                    JSON 파일로 저장하여 언제든지 불러올 수 있습니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary-50 to-purple-50 border-2 border-primary-200">
            <CardContent className="p-6">
              <h3 className="font-semibold text-gray-900 mb-3">💡 사용 팁</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-primary-600">•</span>
                  <span>결제 후 입력 페이지에서 단계별로 데이터를 입력하세요.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600">•</span>
                  <span>중간에 JSON 파일로 저장하여 나중에 이어서 작업할 수 있습니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600">•</span>
                  <span>생성된 시간표는 Excel 파일로 다운로드할 수 있습니다.</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
