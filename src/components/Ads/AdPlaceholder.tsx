import React, { useEffect } from 'react';

interface AdPlaceholderProps {
    type: 'banner' | 'rectangle' | 'interstitial';
    className?: string;
    slot?: string; // AdSense 광고 슬롯 ID
}

declare global {
    interface Window {
        adsbygoogle: any[];
    }
}

export const AdPlaceholder: React.FC<AdPlaceholderProps> = ({ type, className = '', slot }) => {
    const pubId = import.meta.env.VITE_ADSENSE_PUB_ID || 'ca-pub-YOUR_PUBLISHER_ID';
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    useEffect(() => {
        // 개발 환경이거나 Pub ID가 설정되지 않은 경우 광고 로드하지 않음
        if (isDev || !pubId || pubId === 'ca-pub-YOUR_PUBLISHER_ID') {
            return;
        }

        try {
            // 광고 로드
            if (window.adsbygoogle && type !== 'interstitial') {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            }
        } catch (error) {
            console.error('[AdSense] 광고 로드 실패:', error);
        }
    }, [isDev, pubId, type]);

    const getDimensions = () => {
        switch (type) {
            case 'banner':
                return {
                    minHeight: '90px',
                    width: '100%',
                    maxWidth: '728px',
                    adFormat: 'auto',
                    adStyle: 'display:block'
                };
            case 'rectangle':
                return {
                    minHeight: '250px',
                    width: '300px',
                    adFormat: 'rectangle',
                    adStyle: 'display:inline-block;width:300px;height:250px'
                };
            case 'interstitial':
                return {
                    minHeight: '100vh',
                    width: '100vw',
                    adFormat: 'fluid',
                    adStyle: 'display:block'
                };
            default:
                return {
                    minHeight: '90px',
                    width: '100%',
                    adFormat: 'auto',
                    adStyle: 'display:block'
                };
        }
    };

    const dimensions = getDimensions();

    if (type === 'interstitial') {
        return (
            <div
                className={`bg-gray-800/70 flex items-center justify-center fixed top-0 left-0 z-50 ${className}`}
                style={{ minHeight: dimensions.minHeight, width: dimensions.width }}
            >
                <div className="bg-white p-8 rounded-lg max-w-md text-center">
                    <h3 className="text-xl font-bold mb-4">광고 (Interstitial)</h3>
                    <p className="text-gray-600 mb-6">이곳에 전면 광고가 표시됩니다.</p>
                    <button
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        onClick={(e) => {
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

    // 개발 환경이거나 설정이 안된 경우 플레이스홀더 표시
    if (isDev || !pubId || pubId === 'ca-pub-YOUR_PUBLISHER_ID') {
        return (
            <div
                className={`bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 font-medium ${className}`}
                style={{ minHeight: dimensions.minHeight, width: dimensions.width, maxWidth: dimensions.maxWidth }}
            >
                Google AdSense ({type})
            </div>
        );
    }

    // 실제 AdSense 광고 유닛
    return (
        <div
            className={className}
            style={{ minHeight: dimensions.minHeight, width: dimensions.width, maxWidth: dimensions.maxWidth }}
        >
            <ins
                className="adsbygoogle"
                style={{ display: 'block', minHeight: dimensions.minHeight }}
                data-ad-client={pubId}
                data-ad-slot={slot || ''}
                data-ad-format={dimensions.adFormat}
                data-full-width-responsive="true"
            />
        </div>
    );
};
