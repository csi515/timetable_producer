import React from 'react';
import { safeArray } from '../../utils/reviewUtils';

/**
 * 공동 수업 테이블 컴포넌트
 * @param {Object} props
 * @param {Array} props.coTeachingClasses - 공동 수업 목록
 */
const CoTeachingTable = ({ coTeachingClasses }) => {
  const safeCoTeachingClasses = safeArray(coTeachingClasses);
  if (safeCoTeachingClasses.length === 0) return null;

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <span className="mr-2">🤝</span>
        공동 수업 목록
      </h3>
      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-3 border">학급</th>
              <th className="text-left p-3 border">과목</th>
              <th className="text-left p-3 border">주담당 교사</th>
              <th className="text-left p-3 border">공동 교사</th>
              <th className="text-center p-3 border">시간</th>
              <th className="text-center p-3 border">주간시수</th>
              <th className="text-center p-3 border">최대교사수</th>
              <th className="text-center p-3 border">출처</th>
            </tr>
          </thead>
          <tbody>
            {safeCoTeachingClasses.map((ct, index) => {
              const isFromConstraint = ct?.source === 'constraint';
              const rowClassName = isFromConstraint ? 'bg-yellow-50' : 'bg-blue-50';
              
              return (
                <tr key={index} className={rowClassName}>
                  <td className="font-semibold p-3 border">{ct?.className || '-'}</td>
                  <td className="p-3 border">{ct?.subject || '-'}</td>
                  <td className="p-3 border">{ct?.mainTeacher || '-'}</td>
                  <td className="p-3 border">
                    {ct?.coTeachers && Array.isArray(ct.coTeachers) ? ct.coTeachers.join(', ') : '-'}
                  </td>
                  <td className="p-3 border text-center">
                    {ct?.day ? `${ct.day}요일` : ''} {ct?.period ? `${ct.period}교시` : ''}
                  </td>
                  <td className="p-3 border text-center font-semibold">
                    {ct?.weeklyHours ? `${ct.weeklyHours}시간` : '-'}
                  </td>
                  <td className="p-3 border text-center">
                    {ct?.maxTeachersPerClass ? `${ct.maxTeachersPerClass}명/수업` : '-'}
                  </td>
                  <td className="p-3 border text-center">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      isFromConstraint
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {isFromConstraint ? '제약조건' : '고정수업'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* 제약조건 기반 공동수업 설명 */}
      {safeCoTeachingClasses.some(ct => ct?.source === 'constraint') && (
        <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
          <h4 className="font-semibold mb-2 text-yellow-800">📋 제약조건 기반 공동수업</h4>
          <p className="text-sm text-yellow-700 mb-2">
            제약조건으로 설정된 공동수업은 주교사의 주간시수만큼 배치됩니다. 
            주교사는 모든 수업에 참여하지만, 부교사들은 "한 수업당 최대 교사 수" 제한에 따라 나누어서 참여합니다.
          </p>
          <div className="text-xs text-yellow-600">
            <p><strong>예시:</strong> 주교사 16시간 + 부교사 4명 + 최대교사수 2명</p>
            <p>→ 주교사: 16시간 모두 참여, 부교사들: 16시간을 4명이 나누어서 참여</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoTeachingTable; 