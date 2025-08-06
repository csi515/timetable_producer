// 성능 모니터링 유틸리티

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.startTimes = new Map();
    this.isEnabled = process.env.NODE_ENV === 'development';
  }

  // 성능 측정 시작
  startTimer(operationName) {
    if (!this.isEnabled) return;
    
    this.startTimes.set(operationName, performance.now());
  }

  // 성능 측정 종료
  endTimer(operationName) {
    if (!this.isEnabled) return;
    
    const startTime = this.startTimes.get(operationName);
    if (!startTime) return;
    
    const duration = performance.now() - startTime;
    
    if (!this.metrics.has(operationName)) {
      this.metrics.set(operationName, []);
    }
    
    this.metrics.get(operationName).push(duration);
    this.startTimes.delete(operationName);
    
    // 성능 경고 (1초 이상)
    if (duration > 1000) {
      console.warn(`⚠️ 성능 경고: ${operationName}이 ${duration.toFixed(2)}ms 소요되었습니다.`);
    }
    
    return duration;
  }

  // 평균 성능 계산
  getAverageTime(operationName) {
    const times = this.metrics.get(operationName);
    if (!times || times.length === 0) return 0;
    
    const sum = times.reduce((acc, time) => acc + time, 0);
    return sum / times.length;
  }

  // 성능 리포트 생성
  generateReport() {
    if (!this.isEnabled) return null;
    
    const report = {
      timestamp: new Date().toISOString(),
      operations: {}
    };
    
    for (const [operationName, times] of this.metrics) {
      const avgTime = this.getAverageTime(operationName);
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const count = times.length;
      
      report.operations[operationName] = {
        average: avgTime.toFixed(2),
        minimum: minTime.toFixed(2),
        maximum: maxTime.toFixed(2),
        count,
        total: times.reduce((acc, time) => acc + time, 0).toFixed(2)
      };
    }
    
    return report;
  }

  // 메모리 사용량 확인
  getMemoryUsage() {
    if (typeof performance !== 'undefined' && performance.memory) {
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      };
    }
    return null;
  }

  // 성능 데이터 초기화
  clear() {
    this.metrics.clear();
    this.startTimes.clear();
  }
}

// 싱글톤 인스턴스
const performanceMonitor = new PerformanceMonitor();

// 편의 함수들
export const startTimer = (operationName) => performanceMonitor.startTimer(operationName);
export const endTimer = (operationName) => performanceMonitor.endTimer(operationName);
export const getPerformanceReport = () => performanceMonitor.generateReport();
export const getMemoryUsage = () => performanceMonitor.getMemoryUsage();
export const clearPerformanceData = () => performanceMonitor.clear();

// 성능 측정 데코레이터
export const measurePerformance = (operationName) => {
  return (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (...args) {
      startTimer(operationName);
      try {
        const result = originalMethod.apply(this, args);
        endTimer(operationName);
        return result;
      } catch (error) {
        endTimer(operationName);
        throw error;
      }
    };
    
    return descriptor;
  };
};

// 비동기 함수 성능 측정 래퍼
export const measureAsyncPerformance = (operationName) => {
  return (asyncFn) => {
    return async (...args) => {
      startTimer(operationName);
      try {
        const result = await asyncFn(...args);
        endTimer(operationName);
        return result;
      } catch (error) {
        endTimer(operationName);
        throw error;
      }
    };
  };
};

export default performanceMonitor; 