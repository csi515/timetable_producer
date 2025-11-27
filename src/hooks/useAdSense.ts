import { useEffect, useState } from 'react';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export const useAdSense = () => {
  const [adLoaded, setAdLoaded] = useState(false);

  useEffect(() => {
    // 애드센스 스크립트가 로드되었는지 확인
    if (window.adsbygoogle) {
      setAdLoaded(true);
    }
  }, []);

  const showInterstitial = (): Promise<void> => {
    return new Promise((resolve) => {
      // Interstitial 광고 표시 로직
      // 실제 구현은 Google AdSense API 사용
      // 여기서는 간단히 시뮬레이션
      setTimeout(() => {
        resolve();
      }, 1000);
    });
  };

  const loadAnchorAd = () => {
    if (window.adsbygoogle && !adLoaded) {
      window.adsbygoogle.push({});
      setAdLoaded(true);
    }
  };

  return {
    adLoaded,
    showInterstitial,
    loadAnchorAd
  };
};

