import React from 'react';

// 시간표 생성 UI 컴포넌트
export const TimetableGenerationUI = ({
  isGenerating,
  isAutoGenerating,
  generationProgress,
  generationLog,
  generationResults,
  autoGenerationCount,
  bestFillRate,
  stats,
  hasSchedule,
  generateTimetable,
  autoGenerateTimetable,
  clearSchedule,
  nextStep,
  prevStep
}) => {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">시간표 생성</h2>

        {/* 진행률 표시 */}
        {(isGenerating || isAutoGenerating) && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                {isAutoGenerating ? '자동 생성 진행률' : '생성 진행률'}
              </span>
              <span className="text-sm text-gray-500">{generationProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${generationProgress}%` }}
              ></div>
            </div>
            {isAutoGenerating && (
              <div className="mt-2 text-sm text-gray-600">
                시도 횟수: {autoGenerationCount} | 최고 채움률: {bestFillRate}%
              </div>
            )}
          </div>
        )}

        {/* 로그 표시 */}
        {generationLog.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">생성 로그</h3>
            <div className="bg-gray-50 p-4 rounded-lg max-h-64 overflow-y-auto">
              {generationLog.map((log, index) => (
                <div
                  key={index}
                  className={`text-sm mb-1 ${
                    log.type === 'error' ? 'text-red-600' :
                    log.type === 'warning' ? 'text-yellow-600' :
                    log.type === 'success' ? 'text-green-600' :
                    'text-gray-700'
                  }`}
                >
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 결과 통계 */}
        {generationResults && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">생성 결과</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.totalSlots}</div>
                <div className="text-sm text-gray-600">전체 슬롯</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.filledSlots}</div>
                <div className="text-sm text-gray-600">배치된 슬롯</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{stats.emptySlots}</div>
                <div className="text-sm text-gray-600">빈 슬롯</div>
              </div>
              <div className={`p-4 rounded-lg ${generationResults?.hasErrors ? 'bg-red-50' : 'bg-purple-50'}`}>
                <div className={`text-2xl font-bold ${generationResults?.hasErrors ? 'text-red-600' : 'text-purple-600'}`}>
                  {stats.fillRate}%
                </div>
                <div className="text-sm text-gray-600">
                  {generationResults?.hasErrors ? '채움률 (오류 있음)' : '채움률'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 버튼 그룹 */}
        <div className="flex flex-wrap gap-4">
          <button
            onClick={generateTimetable}
            disabled={isGenerating || isAutoGenerating}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              isGenerating || isAutoGenerating
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isGenerating ? '생성 중...' : '시간표 생성'}
          </button>

          <button
            onClick={autoGenerateTimetable}
            disabled={isGenerating || isAutoGenerating}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              isGenerating || isAutoGenerating
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isAutoGenerating ? '자동 생성 중...' : '자동 생성 (100%까지)'}
          </button>

          {isAutoGenerating && (
            <button
              onClick={() => {
                window.stopAutoGeneration = true;
              }}
              className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              자동 생성 중지
            </button>
          )}

          {hasSchedule() && (
            <>
              <button
                onClick={clearSchedule}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                시간표 초기화
              </button>
              
              <button
                onClick={nextStep}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                다음 단계
              </button>
            </>
          )}

          <button
            onClick={prevStep}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            이전 단계
          </button>
        </div>
      </div>
    </div>
  );
}; 