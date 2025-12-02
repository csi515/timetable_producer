import React from 'react';

interface PrivacyPolicyProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">개인정보처리방침</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                        &times;
                    </button>
                </div>

                <div className="prose prose-sm max-w-none text-gray-600 space-y-4">
                    <p>
                        본 애플리케이션(이하 "앱")은 사용자의 개인정보를 중요시하며, "정보통신망 이용촉진 및 정보보호"에 관한 법률을 준수하고 있습니다.
                    </p>

                    <h3 className="text-lg font-semibold text-gray-800 mt-4">1. 수집하는 개인정보 항목</h3>
                    <p>
                        본 앱은 별도의 회원가입 없이 이용 가능하며, 서비스 이용 과정에서 다음과 같은 정보들이 자동으로 생성되어 수집될 수 있습니다.
                        <ul className="list-disc pl-5 mt-2">
                            <li>쿠키(Cookie), 접속 로그, 서비스 이용 기록</li>
                            <li>Google AdSense를 통한 광고 식별자</li>
                        </ul>
                    </p>

                    <h3 className="text-lg font-semibold text-gray-800 mt-4">2. 개인정보의 수집 및 이용 목적</h3>
                    <p>
                        수집한 개인정보를 다음의 목적을 위해 활용합니다.
                        <ul className="list-disc pl-5 mt-2">
                            <li>서비스 제공 및 기능 개선</li>
                            <li>Google AdSense 광고 게재 (사용자 관심 기반 광고 제공)</li>
                            <li>접속 빈도 파악 및 서비스 이용 통계</li>
                        </ul>
                    </p>

                    <h3 className="text-lg font-semibold text-gray-800 mt-4">3. 쿠키(Cookie)의 운용 및 거부</h3>
                    <p>
                        본 앱은 이용자에게 개별적인 맞춤서비스를 제공하기 위해 이용정보를 저장하고 수시로 불러오는 '쿠키(cookie)'를 사용합니다.
                        <br />
                        이용자는 쿠키 설치에 대한 선택권을 가지고 있으며, 웹브라우저 옵션 설정을 통해 모든 쿠키를 허용하거나, 쿠키가 저장될 때마다 확인을 거치거나, 아니면 모든 쿠키의 저장을 거부할 수도 있습니다.
                    </p>

                    <h3 className="text-lg font-semibold text-gray-800 mt-4">4. 제3자 서비스 제공</h3>
                    <p>
                        본 앱은 수익 창출을 위해 Google AdSense를 사용하고 있습니다. Google은 광고를 제공하기 위해 쿠키를 사용할 수 있으며, 이에 대한 자세한 내용은 <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google 광고 및 개인정보 보호</a> 페이지에서 확인할 수 있습니다.
                    </p>

                    <div className="mt-8 pt-4 border-t border-gray-200">
                        <p className="text-sm text-gray-500">
                            본 방침은 2024년 1월 1일부터 시행됩니다.
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};
