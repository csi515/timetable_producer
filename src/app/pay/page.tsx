"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PayPage() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async () => {
    setIsProcessing(true);
    
    // 실제 결제 통합은 Toss Payments 또는 이니시스 API를 사용
    // 여기서는 시뮬레이션으로 처리
    setTimeout(() => {
      // 결제 성공 시 세션 토큰 저장
      const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("paid", "true");
      localStorage.setItem("session_token", sessionToken);
      
      router.push("/editor");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            🎓 시간표 자동 생성 시스템
          </h1>
          <p className="text-gray-600 text-lg">
            중·고등학교용 전문 시간표 제작 도구
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
            결제 정보
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">서비스 이용료</span>
              <span className="text-2xl font-bold text-blue-600">₩99,000</span>
            </div>
            <div className="border-t border-gray-300 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-800">총 결제금액</span>
                <span className="text-2xl font-bold text-blue-600">₩99,000</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            포함된 기능
          </h3>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-center">
              <span className="mr-2">✓</span>
              무제한 시간표 생성
            </li>
            <li className="flex items-center">
              <span className="mr-2">✓</span>
              고급 제약조건 설정
            </li>
            <li className="flex items-center">
              <span className="mr-2">✓</span>
              JSON 데이터 저장/불러오기
            </li>
            <li className="flex items-center">
              <span className="mr-2">✓</span>
              전문적인 리포트 생성
            </li>
          </ul>
        </div>

        <button
          onClick={handlePayment}
          disabled={isProcessing}
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 rounded-2xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? "결제 처리 중..." : "결제하기"}
        </button>

        <p className="text-center text-sm text-gray-500 mt-4">
          결제 완료 후 입력 페이지로 이동합니다
        </p>
      </div>
    </div>
  );
}
