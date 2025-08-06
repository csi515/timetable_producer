import { useState } from 'react';
import { TimetableData, Schedule, TeacherHoursTracker, GenerationLog } from '../types';
import { generateTimetable } from '../core/scheduler';
import { generateOptimizedTimetable } from '../core/optimizedScheduler';
import { autoGenerateTimetable, AutoGenerationConfig } from '../core/autoGenerator';
import { calculateScheduleStats } from '../utils/statistics';
import { createLogMessage } from '../utils/helpers';

export const useTimetableGeneration = (data: TimetableData, updateData: (key: string, value: any) => void) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [isMultiGenerating, setIsMultiGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationLog, setGenerationLog] = useState<GenerationLog[]>([]);
  const [generationResults, setGenerationResults] = useState<any>(null);
  const [autoGenerationCount, setAutoGenerationCount] = useState(0);
  const [multiGenerationCount, setMultiGenerationCount] = useState(0);
  const [bestFillRate, setBestFillRate] = useState(0);
  const [bestSchedule, setBestSchedule] = useState<Schedule | null>(null);
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [totalAttempts] = useState(10);

  // 로그 추가 함수
  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const logEntry: GenerationLog = {
      message,
      type,
      timestamp: new Date()
    };
    setGenerationLog(prev => [...prev, logEntry]);
  };

  // 로그 초기화
  const clearLog = () => {
    setGenerationLog([]);
  };

  // 수동 시간표 생성 (최적화된 버전)
  const handleGenerateTimetable = async () => {
    setIsGenerating(true);
    clearLog();
    setGenerationProgress(0);

    try {
      const result = await generateOptimizedTimetable(data, addLog as (message: string, type?: string) => void, setGenerationProgress);
      
      setGenerationResults({
        schedule: result.schedule,
        teacherHours: result.teacherHours,
        stats: result.stats,
        validationReport: result.validationReport
      });
      
      updateData('schedule', result.schedule);
      updateData('teacherHours', result.teacherHours);
      
      if (result.validationReport) {
        const { summary } = result.validationReport;
        addLog(`✅ 최적화된 시간표 생성이 완료되었습니다!`, 'success');
        addLog(`📊 제약조건 검증 결과:`, 'info');
        addLog(`   - 치명적 위반: ${summary.criticalViolations}건`, summary.criticalViolations > 0 ? 'error' : 'success');
        addLog(`   - 높은 위반: ${summary.highViolations}건`, summary.highViolations > 0 ? 'error' : 'success');
        addLog(`   - 중간 위반: ${summary.mediumViolations}건`, summary.mediumViolations > 0 ? 'warning' : 'success');
        addLog(`   - 낮은 위반: ${summary.lowViolations}건`, summary.lowViolations > 0 ? 'warning' : 'success');
      } else {
        addLog('✅ 시간표 생성이 완료되었습니다!', 'success');
      }
    } catch (error) {
      addLog(`❌ 시간표 생성 중 오류가 발생했습니다: ${error}`, 'error');
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  // 다중 시도 시간표 생성 (10회 시도 후 최적 결과 선택)
  const handleMultiGenerateTimetable = async () => {
    setIsMultiGenerating(true);
    clearLog();
    setGenerationProgress(0);
    setMultiGenerationCount(0);
    setBestFillRate(0);
    setCurrentAttempt(0);
    setBestSchedule(null);

    addLog('🚀 다중 시도 시간표 생성 시작 (10회 시도)', 'info');
    addLog('📊 각 시도마다 채움률을 계산하여 최적의 결과를 선택합니다.', 'info');

    const attempts: Array<{
      schedule: Schedule;
      teacherHours: TeacherHoursTracker;
      stats: any;
      fillRate: number;
      attempt: number;
    }> = [];

    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
      setCurrentAttempt(attempt);
      addLog(`🔄 ${attempt}번째 시도 중... (${Math.round((attempt / totalAttempts) * 100)}%)`, 'info');
      
      try {
        const result = await generateTimetable(
          data, 
          (message: string, type?: string) => {
            // 개별 시도 중에는 로그를 줄여서 표시
            if (message.includes('완료') || message.includes('오류')) {
              addLog(`시도 ${attempt}: ${message}`, type as any);
            }
          }, 
          (progress) => {
            // 전체 진행률 계산: (이전 시도들 + 현재 시도 진행률) / 전체 시도 수
            const totalProgress = ((attempt - 1) * 100 + progress) / totalAttempts;
            setGenerationProgress(Math.round(totalProgress));
          }
        );

        // 채움률 계산
        const stats = calculateScheduleStats(result.schedule, data);
        const fillRate = stats.fillRate || 0;

        attempts.push({
          schedule: result.schedule,
          teacherHours: result.teacherHours,
          stats: result.stats,
          fillRate,
          attempt
        });

        addLog(`✅ ${attempt}번째 시도 완료 - 채움률: ${fillRate.toFixed(1)}%`, 'success');

        // 최고 채움률 업데이트
        if (fillRate > bestFillRate) {
          setBestFillRate(fillRate);
          setBestSchedule(result.schedule);
          addLog(`🏆 새로운 최고 기록! 채움률: ${fillRate.toFixed(1)}%`, 'success');
        }

        setMultiGenerationCount(attempt);

      } catch (error) {
        addLog(`❌ ${attempt}번째 시도 실패: ${error}`, 'error');
        attempts.push({
          schedule: {},
          teacherHours: {},
          stats: { fillRate: 0 },
          fillRate: 0,
          attempt
        });
      }

      // 시도 간 짧은 대기 (UI 업데이트를 위해)
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 최적의 결과 선택
    const bestAttempt = attempts.reduce((best, current) => 
      current.fillRate > best.fillRate ? current : best
    );

    if (bestAttempt.fillRate > 0) {
      setGenerationResults({
        schedule: bestAttempt.schedule,
        teacherHours: bestAttempt.teacherHours,
        stats: bestAttempt.stats
      });
      
      updateData('schedule', bestAttempt.schedule);
      updateData('teacherHours', bestAttempt.teacherHours);
      
      addLog('🎉 다중 시도 완료!', 'success');
      addLog(`🏆 최종 선택: ${bestAttempt.attempt}번째 시도 결과`, 'success');
      addLog(`📊 최고 채움률: ${bestAttempt.fillRate.toFixed(1)}%`, 'success');
      
      // 모든 시도 결과 요약
      const avgFillRate = attempts.reduce((sum, attempt) => sum + attempt.fillRate, 0) / attempts.length;
      addLog(`📈 평균 채움률: ${avgFillRate.toFixed(1)}%`, 'info');
      
      const successfulAttempts = attempts.filter(attempt => attempt.fillRate > 0).length;
      addLog(`✅ 성공한 시도: ${successfulAttempts}/${totalAttempts}회`, 'info');
    } else {
      addLog('❌ 모든 시도가 실패했습니다. 설정을 확인해주세요.', 'error');
    }

    setIsMultiGenerating(false);
    setGenerationProgress(100);
  };

  // 자동 시간표 생성
  const handleAutoGenerateTimetable = async () => {
    setIsAutoGenerating(true);
    clearLog();
    setGenerationProgress(0);
    setAutoGenerationCount(0);
    setBestFillRate(0);

    const config: AutoGenerationConfig = {
      maxAttempts: 200,
      targetFillRate: 100,
      stopOnTarget: true
    };

    try {
      const result = await autoGenerateTimetable(
        data,
        config,
        addLog as (message: string, type?: string) => void,
        setGenerationProgress,
        (attempt, fillRate) => {
          setAutoGenerationCount(attempt);
          if (fillRate > bestFillRate) {
            setBestFillRate(fillRate);
          }
        }
      );

      if (result.success) {
        setBestSchedule(result.schedule);
        setGenerationResults({
          schedule: result.schedule,
          teacherHours: result.teacherHours,
          stats: result.stats
        });
        
        updateData('schedule', result.schedule);
        updateData('teacherHours', result.teacherHours);
        
        addLog(`✅ 자동 생성 완료! 최고 채움률: ${result.bestFillRate}%`, 'success');
      } else {
        addLog(`❌ 자동 생성 실패. 최고 채움률: ${result.bestFillRate}%`, 'error');
      }
    } catch (error) {
      addLog(`❌ 자동 생성 중 오류가 발생했습니다: ${error}`, 'error');
    } finally {
      setIsAutoGenerating(false);
      setGenerationProgress(0);
    }
  };

  const handleStopAutoGeneration = () => {
    setIsAutoGenerating(false);
    addLog('⏹️ 자동 생성이 중단되었습니다.', 'warning');
  };

  const handleEmergencyMode = async () => {
    setIsGenerating(true);
    clearLog();
    setGenerationProgress(0);

    addLog('🚨 응급모드 시작 - 100% 채움률 강제 시도', 'warning');

    try {
      const result = await generateTimetable(
        data, 
        addLog as (message: string, type?: string) => void, 
        setGenerationProgress,
        true // 응급모드 플래그
      );
      
      setGenerationResults({
        schedule: result.schedule,
        teacherHours: result.teacherHours,
        stats: result.stats
      });
      
      updateData('schedule', result.schedule);
      updateData('teacherHours', result.teacherHours);
      
      addLog('✅ 응급모드 완료!', 'success');
    } catch (error) {
      addLog(`❌ 응급모드 실패: ${error}`, 'error');
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const handleClearSchedule = () => {
    setGenerationResults(null);
    setBestSchedule(null);
    setBestFillRate(0);
    clearLog();
    updateData('schedule', {});
    updateData('teacherHours', {});
    addLog('🗑️ 시간표가 초기화되었습니다.', 'info');
  };

  return {
    isGenerating,
    isAutoGenerating,
    isMultiGenerating,
    generationProgress,
    generationLog,
    generationResults,
    autoGenerationCount,
    multiGenerationCount,
    bestFillRate,
    bestSchedule,
    currentAttempt,
    totalAttempts,
    addLog,
    clearLog,
    handleGenerateTimetable,
    handleMultiGenerateTimetable,
    handleAutoGenerateTimetable,
    handleStopAutoGeneration,
    handleEmergencyMode,
    handleClearSchedule
  };
}; 