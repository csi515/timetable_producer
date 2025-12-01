import React from 'react';

interface AdPlaceholderProps {
    type: 'banner' | 'rectangle' | 'interstitial';
    className?: string;
}

export const AdPlaceholder: React.FC<AdPlaceholderProps> = ({ type, className = '' }) => {
    const getDimensions = () => {
        switch (type) {
            case 'banner': return 'h-[90px] w-full max-w-[728px]';
            case 'rectangle': return 'h-[250px] w-[300px]';
            case 'interstitial': return 'h-screen w-screen fixed top-0 left-0 z-50';
            default: return 'h-[90px] w-full';
        }
    };

    if (type === 'interstitial') {
        return (
            <div className={`bg-black/80 flex items-center justify-center ${getDimensions()} ${className}`}>
                <div className="bg-white p-8 rounded-lg max-w-md text-center">
                    <h3 className="text-xl font-bold mb-4">광고 (Interstitial)</h3>
                    <p className="text-gray-600 mb-6">이곳에 전면 광고가 표시됩니다.</p>
                    <button
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        onClick={(e) => {
                            // 부모에서 닫기 처리 필요하지만, 여기선 placeholder라 자체 닫기 로직은 없음
                            // 실제 구현 시에는 props로 onClose 등을 받아야 함
                            const target = e.target as HTMLElement;
                            target.closest('.fixed')?.remove();
                        }}
                    >
                        광고 닫기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 font-medium ${getDimensions()} ${className}`}>
            Google AdSense ({type})
        </div>
    );
};
