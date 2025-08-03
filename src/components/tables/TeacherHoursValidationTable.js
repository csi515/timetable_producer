import React from 'react';
import { DEFAULT_VALUES } from '../../constants/reviewConstants';

/**
 * 교사 시수 검증 테이블
 * @param {Object} props
 * @param {Object} props.validationResult - validateTeacherHoursAlignment 함수의 결과
 * @param {Object} props.data - 전체 데이터
 */
const TeacherHoursValidationTable = ({ validationResult, data }) => {
  if (!validationResult || !data) {
    return null;
  }

  const { isValid, issues = [], teacherDetails = {} } = validationResult;

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <span className="mr-2">🔍</span>
        교사 시수 일치 검증 (공동수업 고려)
      </h3>
      
      {/* 전체 상태 표시 */}
      <div className={`p-4 rounded-lg mb-6 ${isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <div className="flex items-center">
          <span className={`text-2xl mr-3 ${isValid ? 'text-green-600' : 'text-red-600'}`}>
            {isValid ? '✅' : '❌'}
          </span>
          <div>
            <h4 className={`font-semibold ${isValid ? 'text-green-800' : 'text-red-800'}`}>
              {isValid ? '모든 교사의 시수가 학급별 요구사항과 일치합니다!' : `${issues.length}건의 시수 불일치 문제가 발견되었습니다.`}
            </h4>
            <p className={`text-sm ${isValid ? 'text-green-700' : 'text-red-700'}`}>
              {isValid 
                ? '공동수업을 고려한 교사별 시수와 학급별 요구시수가 모두 정확히 일치합니다.'
                : '아래 상세 분석을 확인하여 문제를 해결하세요.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* 교사별 상세 분석 */}
      {teacherDetails && Object.keys(teacherDetails).length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold mb-3 text-gray-800">👨‍🏫 교사별 상세 분석</h4>
          <div className="space-y-4">
            {Object.entries(teacherDetails).map(([teacherName, details]) => {
              // details가 유효한 객체인지 확인
              if (!details || typeof details !== 'object') {
                return null;
              }
              return (
                <div key={teacherName} className="border rounded-lg p-4 bg-gray-50">
                <h5 className="font-semibold text-lg mb-3 text-blue-800">{String(teacherName)}</h5>
                
                {/* 요약 정보 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-white p-3 rounded border">
                    <div className="text-sm text-gray-600">총 실제 시수</div>
                    <div className="text-xl font-bold text-blue-600">
                      {typeof details.actualTotalHours === 'number' ? details.actualTotalHours : 
                       typeof details.actualTotalHours === 'string' ? parseFloat(details.actualTotalHours) || 0 : 0}시간
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="text-sm text-gray-600">총 요구 시수</div>
                    <div className="text-xl font-bold text-green-600">
                      {typeof details.requiredTotalHours === 'number' ? details.requiredTotalHours : 
                       typeof details.requiredTotalHours === 'string' ? parseFloat(details.requiredTotalHours) || 0 : 0}시간
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="text-sm text-gray-600">차이</div>
                    <div className={`text-xl font-bold ${Math.abs(details.totalDifference || 0) <= DEFAULT_VALUES.HOURS_TOLERANCE ? 'text-green-600' : 'text-red-600'}`}>
                      {(details.totalDifference || 0) > 0 ? '+' : ''}{details.totalDifference || 0}시간
                    </div>
                  </div>
                </div>

                {/* 학급별 상세 */}
                {details.classBreakdown && Object.keys(details.classBreakdown).length > 0 && (
                  <div>
                    <h6 className="font-semibold mb-2 text-gray-700">📚 학급별 시수 분석</h6>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="text-left p-2 border">학급</th>
                            <th className="text-center p-2 border">실제 시수</th>
                            <th className="text-center p-2 border">요구 시수</th>
                            <th className="text-center p-2 border">차이</th>
                            <th className="text-center p-2 border">상태</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(details.classBreakdown).map(([className, classDetail]) => {
                            // classDetail이 유효한 객체인지 확인
                            if (!classDetail || typeof classDetail !== 'object') {
                              return null;
                            }
                            
                            // 모든 값이 숫자인지 확인하고 안전하게 변환
                            const actual = typeof classDetail.actual === 'number' ? classDetail.actual : 
                                         typeof classDetail.actual === 'string' ? parseFloat(classDetail.actual) || 0 : 0;
                            const required = typeof classDetail.required === 'number' ? classDetail.required : 
                                           typeof classDetail.required === 'string' ? parseFloat(classDetail.required) || 0 : 0;
                            const difference = typeof classDetail.difference === 'number' ? classDetail.difference : 
                                             typeof classDetail.difference === 'string' ? parseFloat(classDetail.difference) || 0 : 0;
                            
                            return (
                              <tr key={className} className="hover:bg-gray-50">
                                <td className="p-2 border font-medium">{String(className)}</td>
                                <td className="p-2 border text-center">{actual}시간</td>
                                <td className="p-2 border text-center">{required}시간</td>
                                <td className={`p-2 border text-center font-semibold ${Math.abs(difference) <= DEFAULT_VALUES.HOURS_TOLERANCE ? 'text-green-600' : 'text-red-600'}`}>
                                  {difference > 0 ? '+' : ''}{difference}시간
                                </td>
                                <td className="p-2 border text-center">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    Math.abs(difference) <= DEFAULT_VALUES.HOURS_TOLERANCE 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {Math.abs(difference) <= DEFAULT_VALUES.HOURS_TOLERANCE ? '일치' : '불일치'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 공동수업 조정 정보 */}
                {details.coTeachingAdjustments && Object.keys(details.coTeachingAdjustments).length > 0 && (
                  <div className="mt-4">
                    <h6 className="font-semibold mb-2 text-gray-700">🤝 공동수업 시수 조정</h6>
                    <div className="bg-blue-50 p-3 rounded border">
                      {Object.entries(details.coTeachingAdjustments).map(([className, adjustment]) => {
                        // adjustment 값이 숫자인지 확인하고 안전하게 변환
                        const safeAdjustment = typeof adjustment === 'number' ? adjustment : 
                                             typeof adjustment === 'string' ? parseFloat(adjustment) || 0 : 0;
                        return (
                          <div key={className} className="text-sm text-blue-800">
                            <span className="font-medium">{String(className)}:</span> 공동수업으로 인한 시수 조정 +{safeAdjustment}시간
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
            })}
          </div>
        </div>
      )}

      {/* 문제점 목록 */}
      {issues && issues.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3 text-red-800">⚠️ 발견된 문제점</h4>
          <div className="space-y-2">
            {issues.map((issue, index) => (
              <div key={index} className="bg-red-50 border border-red-200 p-3 rounded">
                <div className="text-red-800 font-medium">{String(issue)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 범례 */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold mb-2">📋 검증 기준</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                     <div className="flex items-center">
             <span className="w-4 h-4 bg-green-100 border mr-2"></span>
             <span>시수 일치 (차이 ≤ {DEFAULT_VALUES.HOURS_TOLERANCE}시간)</span>
           </div>
           <div className="flex items-center">
             <span className="w-4 h-4 bg-red-100 border mr-2"></span>
             <span>시수 불일치 (차이 > {DEFAULT_VALUES.HOURS_TOLERANCE}시간)</span>
           </div>
          <div className="flex items-center">
            <span className="text-blue-600 font-semibold mr-2">🤝</span>
            <span>공동수업 시수 조정</span>
          </div>
          <div className="flex items-center">
            <span className="text-gray-600 font-semibold mr-2">📊</span>
            <span>실제 배치 vs 요구 시수</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherHoursValidationTable; 