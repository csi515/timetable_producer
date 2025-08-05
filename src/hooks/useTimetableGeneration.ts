import { useState } from 'react';
import { TimetableData, Schedule, TeacherHoursTracker, GenerationLog } from '../types';
import { generateTimetable } from '../core/scheduler';
import { autoGenerateTimetable, AutoGenerationConfig } from '../core/autoGenerator';
import { calculateScheduleStats } from '../utils/statistics';
import { createLogMessage } from '../utils/helpers';

export const useTimetableGeneration = (data: TimetableData, updateData: (key: string, value: any) => void) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationLog, setGenerationLog] = useState<GenerationLog[]>([]);
  const [generationResults, setGenerationResults] = useState<any>(null);
  const [autoGenerationCount, setAutoGenerationCount] = useState(0);
  const [bestFillRate, setBestFillRate] = useState(0);
  const [bestSchedule, setBestSchedule] = useState<Schedule | null>(null);

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

  // 수동 시간표 생성
  const handleGenerateTimetable = async () => {
    setIsGenerating(true);
    clearLog();
    setGenerationProgress(0);

    try {
      const result = await generateTimetable(data, addLog as (message: string, type?: string) => void, setGenerationProgress);
      
      setGenerationResults({
        schedule: result.schedule,
        teacherHours: result.teacherHours,
        stats: result.stats,
        failureAnalysis: result.failureAnalysis
      });
      
      updateData('schedule', result.schedule);
      updateData('teacherHours', result.teacherHours);
      updateData('failureAnalysis', result.failureAnalysis);
      
      addLog('✅ 시간표 생성이 완료되었습니다!', 'success');
    } catch (error) {
      addLog(`❌ 시간표 생성 중 오류가 발생했습니다: ${error}`, 'error');
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
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
          stats: result.stats,
          failureAnalysis: result.failureAnalysis
        });
        
        updateData('schedule', result.schedule);
        updateData('teacherHours', result.teacherHours);
        updateData('failureAnalysis', result.failureAnalysis);
        
        addLog(`✅ 자동 생성 완료! 최고 채움률: ${result.bestFillRate}%`, 'success');
      } else {
        addLog(`⚠️ 자동 생성이 중단되었습니다. 최고 채움률: ${result.bestFillRate}%`, 'warning');
      }
    } catch (error) {
      addLog(`❌ 자동 생성 중 오류가 발생했습니다: ${error}`, 'error');
    } finally {
      setIsAutoGenerating(false);
      setGenerationProgress(0);
    }
  };

  // 자동 생성 중단
  const handleStopAutoGeneration = () => {
    setIsAutoGenerating(false);
    addLog('⏹️ 자동 생성이 중단되었습니다.', 'info');
  };

  // 스케줄 초기화
  // 응급모드: 100% 채움률 강제 달성
  const handleEmergencyMode = async () => {
    if (!generationResults || !generationResults.schedule) {
      addLog('⚠️ 먼저 시간표를 생성해주세요.', 'warning');
      return;
    }

    setIsGenerating(true);
    addLog('🚨 응급모드 시작: 100% 채움률 강제 달성을 시도합니다.', 'info');
    setGenerationProgress(0);

    try {
      // 현재 스케줄 복사
      const currentSchedule = JSON.parse(JSON.stringify(generationResults.schedule));
      const currentTeacherHours = JSON.parse(JSON.stringify(generationResults.teacherHours));
      
      addLog('🔥 응급모드: 모든 제약조건을 완화하여 빈 슬롯을 강제로 채웁니다.', 'warning');
      setGenerationProgress(30);
      
      // 응급모드 채우기 로직 실행
      const { emergencyFillAllSlots } = await import('../core/emergencyMode');
      const emergencyFilledSlots = await emergencyFillAllSlots(currentSchedule, data, currentTeacherHours, addLog as (message: string, type?: string) => void);
      
      setGenerationProgress(70);
      
      // 통계 재계산
      const stats = calculateScheduleStats(currentSchedule, currentTeacherHours);
      
      setGenerationProgress(90);
      
      // 결과 업데이트
      const updatedResults = {
        schedule: currentSchedule,
        teacherHours: currentTeacherHours,
        stats: stats,
        failureAnalysis: null // 응급모드에서는 실패 분석 없음
      };
      
      setGenerationResults(updatedResults);
      updateData('schedule', currentSchedule);
      updateData('teacherHours', currentTeacherHours);
      updateData('failureAnalysis', null);
      
      setGenerationProgress(100);
      
      addLog(`🎉 응급모드 완료! ${emergencyFilledSlots}개 슬롯 추가 배치`, 'success');
      addLog(`📊 채움률: ${parseFloat(stats.fillRate).toFixed(1)}%`, 'success');
      
    } catch (error) {
      addLog(`❌ 응급모드 실행 중 오류가 발생했습니다: ${error}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearSchedule = () => {
    setGenerationResults(null);
    setBestSchedule(null);
    setBestFillRate(0);
    setAutoGenerationCount(0);
    clearLog();
    updateData('schedule', {});
    updateData('teacherHours', {});
    updateData('failureAnalysis', null);
    addLog('🗑️ 스케줄이 초기화되었습니다.', 'info');
  };

  return {
    isGenerating,
    isAutoGenerating,
    generationProgress,
    generationLog,
    generationResults,
    autoGenerationCount,
    bestFillRate,
    bestSchedule,
    addLog,
    clearLog,
    handleGenerateTimetable,
    handleAutoGenerateTimetable,
    handleStopAutoGeneration,
    handleEmergencyMode,
    handleClearSchedule
  };
}; 