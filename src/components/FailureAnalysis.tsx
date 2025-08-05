import React from 'react';
import { FailureAnalysis as FailureAnalysisType } from '../types';

interface FailureAnalysisProps {
  failureAnalysis: FailureAnalysisType;
  data: any;
}

const FailureAnalysis: React.FC<FailureAnalysisProps> = ({ failureAnalysis, data }) => {
  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getSubjectName = (subjectId: string) => {
    const subject = data.subjects?.find((s: any) => s.id === subjectId);
    return subject?.name || subjectId;
  };

  const getClassName = (classId: string) => {
    const classData = data.classes?.find((c: any) => c.id === classId);
    return classData?.name || classId;
  };

  const getViolationReasonText = (reason: string) => {
    switch (reason) {
      case 'no_available_slots':
        return '사용 가능한 슬롯 없음';
      case 'constraint_conflict':
        return '제약조건 충돌';
      case 'teacher_unavailable':
        return '교사 불가능 시간';
      case 'time_conflict':
        return '시간 충돌';
      default:
        return reason;
    }
  };

  const getTopFailureReasons = () => {
    const violationCounts = new Map<string, { count: number; reasons: Set<string> }>();
    
    failureAnalysis.constraintViolations.forEach(violation => {
      const key = `${violation.subjectId}-${violation.classId}`;
      if (!violationCounts.has(key)) {
        violationCounts.set(key, { count: 0, reasons: new Set() });
      }
      const entry = violationCounts.get(key)!;
      entry.count++;
      entry.reasons.add(violation.reason);
    });

    return Array.from(violationCounts.entries())
      .map(([key, data]) => {
        const [subjectId, classId] = key.split('-');
        return {
          subjectId,
          classId,
          failureCount: data.count,
          reasons: Array.from(data.reasons)
        };
      })
      .sort((a, b) => b.failureCount - a.failureCount)
      .slice(0, 10);
  };

  const topFailures = getTopFailureReasons();

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">🔍 실패 원인 분석</h3>
      
      {/* 성능 메트릭 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{failureAnalysis.totalAttempts}</div>
          <div className="text-sm text-blue-700">총 시도 횟수</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{failureAnalysis.successfulPlacements}</div>
          <div className="text-sm text-green-700">성공한 배치</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{failureAnalysis.failedPlacements}</div>
          <div className="text-sm text-red-700">실패한 배치</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">{failureAnalysis.backtrackCount}</div>
          <div className="text-sm text-yellow-700">백트래킹 횟수</div>
        </div>
      </div>

      {/* 성능 통계 */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold text-gray-700 mb-3">📊 성능 통계</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-600">총 실행 시간</div>
            <div className="text-lg font-semibold">{formatTime(failureAnalysis.performanceMetrics.totalPlacementTime)}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-600">평균 배치 시간</div>
            <div className="text-lg font-semibold">{formatTime(failureAnalysis.performanceMetrics.averagePlacementTime)}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-600">성공률</div>
            <div className="text-lg font-semibold">
              {failureAnalysis.totalAttempts > 0 
                ? `${((failureAnalysis.successfulPlacements / failureAnalysis.totalAttempts) * 100).toFixed(1)}%`
                : '0%'
              }
            </div>
          </div>
        </div>
      </div>

      {/* 제약조건 위반 통계 */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold text-gray-700 mb-3">🚨 제약조건 위반 통계</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">위반 유형</th>
                <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">횟수</th>
                <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">비율</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const reasonCounts = new Map<string, number>();
                failureAnalysis.constraintViolations.forEach(v => {
                  reasonCounts.set(v.reason, (reasonCounts.get(v.reason) || 0) + 1);
                });
                
                return Array.from(reasonCounts.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([reason, count]) => (
                    <tr key={reason} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border-b text-sm text-gray-700">
                        {getViolationReasonText(reason)}
                      </td>
                      <td className="px-4 py-2 border-b text-sm text-gray-700">{count}</td>
                      <td className="px-4 py-2 border-b text-sm text-gray-700">
                        {((count / failureAnalysis.constraintViolations.length) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* 가장 많이 실패한 과목-학급 조합 */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold text-gray-700 mb-3">📈 가장 많이 실패한 과목-학급 조합</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">순위</th>
                <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">학급</th>
                <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">과목</th>
                <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">실패 횟수</th>
                <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">주요 원인</th>
              </tr>
            </thead>
            <tbody>
              {topFailures.map((failure, index) => (
                <tr key={`${failure.subjectId}-${failure.classId}`} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border-b text-sm text-gray-700">{index + 1}</td>
                  <td className="px-4 py-2 border-b text-sm text-gray-700">
                    {getClassName(failure.classId)}
                  </td>
                  <td className="px-4 py-2 border-b text-sm text-gray-700">
                    {getSubjectName(failure.subjectId)}
                  </td>
                  <td className="px-4 py-2 border-b text-sm text-gray-700">{failure.failureCount}</td>
                  <td className="px-4 py-2 border-b text-sm text-gray-700">
                    {failure.reasons.map(r => getViolationReasonText(r)).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 개선 제안 */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="text-lg font-semibold text-blue-800 mb-2">💡 개선 제안</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          {topFailures.length > 0 && (
            <li>• 가장 많이 실패한 과목들의 교사 배정을 재검토하세요.</li>
          )}
          {failureAnalysis.constraintViolations.filter(v => v.reason === 'no_available_slots').length > 0 && (
            <li>• 교사별 수업 가능 시간을 확장하거나 교사 수를 늘려보세요.</li>
          )}
          {failureAnalysis.constraintViolations.filter(v => v.reason === 'constraint_conflict').length > 0 && (
            <li>• 제약조건이 너무 엄격할 수 있습니다. 일부 제약을 완화해보세요.</li>
          )}
          {failureAnalysis.backtrackCount > failureAnalysis.totalAttempts * 0.5 && (
            <li>• 백트래킹이 많이 발생하고 있습니다. 우선순위 설정을 재검토하세요.</li>
          )}
          <li>• 블록제 과목이나 공동수업이 많은 경우, 이를 먼저 배정해보세요.</li>
        </ul>
      </div>
    </div>
  );
};

export default FailureAnalysis;