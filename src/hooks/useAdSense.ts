import { useEffect, useState } from 'react';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export const useAdSense = () => {
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState<string | null>(null);

  useEffect(() => {
    // 애드센스 스크립트가 로드되었는지 확인
    if (window.adsbygoogle) {
      setAdLoaded(true);
    }
  }, []);

  const showInterstitial = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      // 개발 환경에서는 광고 건너뛰기
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('[DEV] AdSense 전면 광고 건너뜀');
        resolve();
        return;
      }

      // Pub ID가 설정되지 않은 경우
      const pubId = import.meta.env.VITE_ADSENSE_PUB_ID;
      if (!pubId || pubId === 'ca-pub-YOUR_PUBLISHER_ID') {
        console.warn('[AdSense] Publisher ID가 설정되지 않았습니다.');
        resolve();
        return;
      }

      try {
        // Interstitial 광고 표시 로직
        // Google AdSense Interstitial API 사용
        if (window.adsbygoogle) {
          window.adsbygoogle.push({
            google_ad_client: pubId,
            enable_page_level_ads: true
          });
          resolve();
        } else {
          console.warn('[AdSense] adsbygoogle 스크립트가 로드되지 않았습니다.');
          resolve();
        }
      } catch (error) {
        console.error('[AdSense] 전면 광고 로드 실패:', error);
        setAdError('광고 로드에 실패했습니다.');
        reject(error);
      }
    });
  };

  const loadAnchorAd = () => {
    // 개발 환경에서는 광고 건너뛰기
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('[DEV] AdSense 앵커 광고 건너뜀');
      return;
    }

    // Pub ID가 설정되지 않은 경우
    const pubId = import.meta.env.VITE_ADSENSE_PUB_ID;
    if (!pubId || pubId === 'ca-pub-YOUR_PUBLISHER_ID') {
      console.warn('[AdSense] Publisher ID가 설정되지 않았습니다.');
      return;
    }

    try {
      if (window.adsbygoogle && !adLoaded) {
        // 실제 광고 로드
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        setAdLoaded(true);
        console.log('[AdSense] 앵커 광고 로드 완료');
      }
    } catch (error) {
      console.error('[AdSense] 앵커 광고 로드 실패:', error);
      setAdError('광고 로드에 실패했습니다.');
    }
  };

  return {
    adLoaded,
    adError,
    showInterstitial,
    loadAnchorAd
  };
};

