import React from 'react';
import { TimetableQualityScore } from '../types';

interface TimetableQualityAnalysisProps {
  qualityScore: TimetableQualityScore;
  data: any;
}

const TimetableQualityAnalysis: React.FC<TimetableQualityAnalysisProps> = ({ qualityScore, data }) => {
  const getTeacherName = (teacherId: string) => {
    const teacher = data.teachers?.find((t: any) => t.id === teacherId);
    return teacher?.name || teacherId;
  };

  const getQualityLevel = (score: number) => {
    if (score >= 90) return { level: '우수', color: 'text-green-600', bgColor: 'bg-green-50' };
    if (score >= 80) return { level: '양호', color: 'text-blue-600', bgColor: 'bg-blue-50' };
    if (score >= 70) return { level: '보통', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    if (score >= 60) return { level: '미흡', color: 'text-orange-600', bgColor: 'bg-orange-50' };
    return { level: '불량', color: 'text-red-600', bgColor: 'bg-red-50' };
  };

  const qualityLevel = getQualityLevel(qualityScore.totalScore);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">🎯 시간표 품질 분석</h3>
      
      {/* 전체 품질 점수 */}
      <div className={`${qualityLevel.bgColor} p-6 rounded-lg mb-6`}>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-semibold text-gray-700">전체 품질 점수</h4>
            <p className="text-sm text-gray-600">연속 수업 제한 등을 고려한 종합 평가</p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${qualityLevel.color}`}>
              {qualityScore.totalScore}/100
            </div>
            <div className={`text-lg font-semibold ${qualityLevel.color}`}>
              {qualityLevel.level}
            </div>
          </div>
        </div>
      </div>

      {/* 연속 수업 위반 분석 */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold text-gray-700 mb-3">📚 연속 수업 위반 분석</h4>
        
        {qualityScore.consecutiveTeachingViolations.length === 0 ? (
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <span className="text-green-600 text-xl mr-2">✅</span>
              <span className="text-green-800 font-medium">모든 교사의 연속 수업이 제한 내에서 배정되었습니다.</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-center mb-2">
                <span className="text-red-600 text-xl mr-2">⚠️</span>
                <span className="text-red-800 font-medium">
                  {qualityScore.consecutiveTeachingViolations.length}건의 연속 수업 위반이 발견되었습니다.
                </span>
              </div>
              <p className="text-red-700 text-sm">
                연속 수업 제한: 최대 2시간 (권장사항)
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">교사</th>
                    <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">요일</th>
                    <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">연속 시간</th>
                    <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">제한</th>
                    <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">페널티</th>
                  </tr>
                </thead>
                <tbody>
                  {qualityScore.consecutiveTeachingViolations.map((violation, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border-b text-sm text-gray-700">
                        {getTeacherName(violation.teacherId)}
                      </td>
                      <td className="px-4 py-2 border-b text-sm text-gray-700">
                        {violation.day}요일
                      </td>
                      <td className="px-4 py-2 border-b text-sm text-gray-700">
                        <span className="font-semibold text-red-600">
                          {violation.consecutiveHours}시간
                        </span>
                      </td>
                      <td className="px-4 py-2 border-b text-sm text-gray-700">
                        {violation.maxAllowed}시간
                      </td>
                      <td className="px-4 py-2 border-b text-sm text-gray-700">
                        <span className="font-semibold text-red-600">
                          -{violation.penalty}점
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 품질 개선 권장사항 */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="text-lg font-semibold text-blue-800 mb-2">💡 품질 개선 권장사항</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          {qualityScore.consecutiveTeachingViolations.length > 0 ? (
            <>
              <li>• 연속 수업 위반이 있는 교사들의 수업 시간을 재배치하세요.</li>
              <li>• 연속 수업 사이에 공강 시간을 배치하여 교사의 피로도를 줄이세요.</li>
              <li>• 오전과 오후에 수업을 분산 배치하여 연속 수업을 최소화하세요.</li>
            </>
          ) : (
            <li>• 현재 시간표는 연속 수업 제한을 잘 준수하고 있습니다. 유지하세요.</li>
          )}
          <li>• 시간표 품질 점수가 80점 이상이면 양호한 수준입니다.</li>
          <li>• 90점 이상을 목표로 하여 교사들의 업무 효율성을 극대화하세요.</li>
        </ul>
      </div>

      {/* 품질 점수 상세 분석 */}
      <div className="mt-6">
        <h4 className="text-lg font-semibold text-gray-700 mb-3">📊 품질 점수 상세 분석</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">연속 수업 점수</div>
            <div className="text-2xl font-bold text-gray-800">
              {100 - qualityScore.consecutiveTeachingScore}/100
            </div>
            <div className="text-xs text-gray-500">
              (기본 100점 - 연속 수업 위반 페널티)
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">연속 수업 위반</div>
            <div className="text-2xl font-bold text-red-600">
              -{qualityScore.consecutiveTeachingScore}점
            </div>
            <div className="text-xs text-gray-500">
              총 {qualityScore.consecutiveTeachingViolations.length}건
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimetableQualityAnalysis;