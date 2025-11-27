import React from 'react';
import { TimetableData } from '../types';
import { useTimetableGeneration } from '../hooks/useTimetableGeneration';

interface TimetableGenerationProps {
  data: TimetableData;
  updateData: (key: string, value: any) => void;
  nextStep: () => void;
  prevStep: () => void;
}

const TimetableGeneration: React.FC<TimetableGenerationProps> = ({ 
  data, 
  updateData, 
  nextStep, 
  prevStep 
}) => {
  const {
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
  } = useTimetableGeneration(data, updateData);

  const handleNextStep = () => {
    if (generationResults && generationResults.schedule) {
      nextStep();
    } else {
      addLog('⚠️ 먼저 시간표를 생성해주세요.', 'warning');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">시간표 생성</h2>
        
        {/* 생성 버튼들 */}
        <div className="flex flex-wrap gap-4 mb-6">
          <button
            onClick={handleGenerateTimetable}
            disabled={isGenerating || isAutoGenerating}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? '최적화 생성 중...' : '최적화 시간표 생성'}
          </button>
          
          <button
            onClick={handleAutoGenerateTimetable}
            disabled={isGenerating || isAutoGenerating}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAutoGenerating ? '자동 생성 중...' : '자동 생성 (100% 목표)'}
          </button>
          
          {isAutoGenerating && (
            <button
              onClick={handleStopAutoGeneration}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              중단
            </button>
          )}
          
          {generationResults && generationResults.schedule && (
            <button
              onClick={handleEmergencyMode}
              disabled={isGenerating || isAutoGenerating}
              className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
            >
              🚨 응급모드 (100% 강제)
            </button>
          )}
          
          <button
            onClick={handleClearSchedule}
            disabled={isGenerating || isAutoGenerating}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            초기화
          </button>
        </div>

        {/* 진행률 표시 */}
        {(isGenerating || isAutoGenerating) && (
          <div className="mb-6">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">진행률</span>
              <span className="text-sm font-medium text-gray-700">{generationProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${generationProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* 자동 생성 정보 */}
        {isAutoGenerating && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">시도 횟수: {autoGenerationCount}</span>
              <span className="text-sm font-medium text-gray-700">최고 채움률: {typeof bestFillRate === 'number' ? bestFillRate.toFixed(1) : '0.0'}%</span>
            </div>
          </div>
        )}

        {/* 생성 결과 */}
        {generationResults && (
          <div className="mb-6 p-4 bg-green-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-2 text-green-800">생성 결과</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {generationResults.stats?.fillRate || '0'}%
                </div>
                <div className="text-sm text-gray-600">채움률</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {generationResults.stats?.filledSlots || 0}
                </div>
                <div className="text-sm text-gray-600">배치된 수업</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {generationResults.stats?.emptySlots || 0}
                </div>
                <div className="text-sm text-gray-600">빈 슬롯</div>
              </div>
            </div>
          </div>
        )}

        {/* 응급모드 설명 */}
        {generationResults && generationResults.schedule && typeof generationResults.stats?.fillRate === 'number' && generationResults.stats.fillRate < 100 && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <h3 className="text-lg font-semibold mb-2 text-orange-800 flex items-center">
              <span className="mr-2">🚨</span>
              응급모드 안내
            </h3>
            <div className="text-sm text-orange-700 space-y-2">
              <p><strong>현재 채움률:</strong> {typeof generationResults.stats?.fillRate === 'number' ? generationResults.stats.fillRate.toFixed(1) : '0.0'}%</p>
              <p><strong>응급모드 기능:</strong> 모든 제약조건을 완화하여 빈 슬롯을 강제로 채워 100% 채움률을 달성합니다.</p>
              <div className="mt-3 p-2 bg-orange-100 rounded">
                <p className="font-semibold text-orange-800">⚠️ 주의사항:</p>
                <ul className="list-disc list-inside text-xs space-y-1 mt-1">
                  <li>교사 수업 불가 시간이 무시될 수 있습니다</li>
                  <li>학급별 시수 제한이 초과될 수 있습니다</li>
                  <li>교사 중복 배정만 방지됩니다</li>
                  <li>응급모드는 최후의 수단으로만 사용하세요</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* 생성 로그 */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-gray-800">생성 로그</h3>
            <button
              onClick={clearLog}
              className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              로그 지우기
            </button>
          </div>
          <div className="bg-gray-100 rounded-lg p-4 h-64 overflow-y-auto">
            {generationLog.length === 0 ? (
              <p className="text-gray-500 text-center">로그가 없습니다.</p>
            ) : (
              <div className="space-y-1">
                {generationLog.map((log, index) => (
                  <div key={index} className="text-sm">
                    <span className="text-gray-500">
                      {log.timestamp?.toLocaleTimeString()}
                    </span>
                    <span className={`ml-2 ${
                      log.type === 'error' ? 'text-red-600' :
                      log.type === 'warning' ? 'text-yellow-600' :
                      log.type === 'success' ? 'text-green-600' :
                      'text-gray-700'
                    }`}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 네비게이션 버튼 */}
        <div className="flex justify-between">
          <button
            onClick={prevStep}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            이전
          </button>
          <button
            onClick={handleNextStep}
            disabled={!generationResults || !generationResults.schedule}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimetableGeneration; 