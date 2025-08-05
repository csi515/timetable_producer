import { Schedule, TimetableData, TeacherHoursTracker } from '../types';
import { generateTimetable } from './scheduler';
import { calculateScheduleStats } from '../utils/statistics';

// 자동 생성 설정
export interface AutoGenerationConfig {
  maxAttempts: number;
  targetFillRate: number;
  stopOnTarget: boolean;
}

// 자동 생성 결과
export interface AutoGenerationResult {
  schedule: Schedule;
  teacherHours: TeacherHoursTracker;
  stats: any;
  attempts: number;
  bestFillRate: number;
  success: boolean;
}

// 자동 시간표 생성
export const autoGenerateTimetable = async (
  data: TimetableData,
  config: AutoGenerationConfig,
  addLog: (message: string, type?: string) => void,
  setProgress?: (progress: number) => void,
  onProgress?: (attempt: number, fillRate: number) => void
): Promise<AutoGenerationResult> => {
  addLog('🚀 자동 시간표 생성을 시작합니다. 채움률 100%까지 반복 생성합니다.', 'info');
  
  let bestSchedule: Schedule | null = null;
  let bestTeacherHours: TeacherHoursTracker | null = null;
  let bestStats: any = null;
  let bestFillRate = 0;
  let attempts = 0;
  
  const startTime = Date.now();
  
  while (attempts < config.maxAttempts) {
    attempts++;
    
    try {
      // 시간표 생성
      const result = await generateTimetable(data, addLog, setProgress);
      const fillRate = parseFloat(result.stats.fillRate);
      
      // 진행상황 콜백
      onProgress?.(attempts, fillRate);
      
      // 최고 채움률 업데이트
      if (fillRate > bestFillRate) {
        bestFillRate = fillRate;
        bestSchedule = JSON.parse(JSON.stringify(result.schedule));
        bestTeacherHours = JSON.parse(JSON.stringify(result.teacherHours));
        bestStats = JSON.parse(JSON.stringify(result.stats));
        
        addLog(`🎯 새로운 최고 채움률 달성: ${fillRate}% (시도 ${attempts}회)`, 'success');
      }
      
      // 목표 채움률 달성 시 중단
      if (config.stopOnTarget && fillRate >= config.targetFillRate) {
        addLog(`🎉 목표 채움률 ${config.targetFillRate}% 달성! 자동 생성을 종료합니다.`, 'success');
        break;
      }
      
      // 100% 달성 시 즉시 중단
      if (fillRate >= 100) {
        addLog(`🎉 100% 채움률 달성! 자동 생성을 종료합니다.`, 'success');
        break;
      }
      
      // 98% 이상이면 더 많은 시도 (최대 500회까지)
      if (fillRate >= 98 && attempts < 500) {
        // 계속 시도
      }
      // 95% 이상이면 300회까지 시도
      else if (fillRate >= 95 && attempts < 300) {
        // 계속 시도
      }
      // 90% 이상이면 250회까지 시도
      else if (fillRate >= 90 && attempts < 250) {
        // 계속 시도
      }
      // 85% 이상이면 200회까지 시도
      else if (fillRate >= 85 && attempts < 200) {
        // 계속 시도
      }
      
      // 진행상황 로그 (10회마다)
      if (attempts % 10 === 0) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        addLog(`📊 진행상황: ${attempts}회 시도, 최고 채움률: ${bestFillRate}%, 경과시간: ${elapsed}초`, 'info');
      }
      
    } catch (error) {
      addLog(`❌ ${attempts}회째 시도 중 오류 발생: ${error}`, 'error');
    }
  }
  
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  
  if (bestSchedule && bestTeacherHours && bestStats) {
    addLog(`✅ 자동 생성 완료: ${attempts}회 시도, 최고 채움률: ${bestFillRate}%, 총 소요시간: ${elapsed}초`, 'success');
    
    return {
      schedule: bestSchedule,
      teacherHours: bestTeacherHours,
      stats: bestStats,
      attempts,
      bestFillRate,
      success: true
    };
  } else {
    addLog(`❌ 자동 생성 실패: ${attempts}회 시도 후에도 유효한 시간표를 생성하지 못했습니다.`, 'error');
    
    return {
      schedule: {},
      teacherHours: {},
      stats: { fillRate: '0.0' },
      attempts,
      bestFillRate: 0,
      success: false
    };
  }
};

// 자동 생성 중단 플래그
let shouldStopAutoGeneration = false;

export const stopAutoGeneration = () => {
  shouldStopAutoGeneration = true;
};

export const resetAutoGeneration = () => {
  shouldStopAutoGeneration = false;
};

export const isAutoGenerationStopped = () => {
  return shouldStopAutoGeneration;
}; 