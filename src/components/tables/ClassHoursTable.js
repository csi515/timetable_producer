import React from 'react';
import { safeObject } from '../../utils/reviewUtils';

/**
 * 학급별 시수 테이블 컴포넌트
 * @param {Object} props
 * @param {Object} props.classHours - 학급별 시수 데이터
 */
const ClassHoursTable = ({ classHours }) => {
  const safeClassHours = safeObject(classHours);

  return (
    <div className="card mb-6">
      <h3 className="text-xl font-bold mb-4">📚 학급별 시수 현황</h3>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>학급</th>
              <th>총 시수</th>
              <th>목표 시수</th>
              <th>차이</th>
              <th>과목별 시수</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(safeClassHours).map(([className, hours]) => {
              const targetHours = 25;
              const totalHours = hours?.totalHours || 0;
              const difference = totalHours - targetHours;
              const isOverLimit = Math.abs(difference) > 2;
              
              return (
                <tr key={className} className={isOverLimit ? 'bg-red-50' : ''}>
                  <td className="font-semibold">{className}</td>
                  <td className={isOverLimit ? 'text-red-600 font-bold' : ''}>
                    {totalHours}시간
                  </td>
                  <td>{targetHours}시간</td>
                  <td className={difference > 0 ? 'text-red-600' : difference < 0 ? 'text-blue-600' : 'text-green-600'}>
                    {difference > 0 ? '+' : ''}{difference}시간
                  </td>
                  <td>
                    <div className="text-sm">
                      {Object.entries(safeObject(hours.subjects)).map(([subject, count]) => (
                        <span key={subject} className="inline-block bg-gray-100 px-2 py-1 rounded mr-1 mb-1">
                          {subject}: {count}시간
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClassHoursTable; 