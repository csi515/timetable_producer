import React from 'react';
import { safeObject, safeArray, hasCoTeaching, getCoTeachingTypes } from '../../utils/reviewUtils';

/**
 * 교사별 시수 테이블 컴포넌트
 * @param {Object} props
 * @param {Object} props.teacherHours - 교사별 시수 데이터
 * @param {Array} props.coTeachingClasses - 공동 수업 목록
 */
const TeacherHoursTable = ({ teacherHours, coTeachingClasses }) => {
  const safeTeacherHours = safeObject(teacherHours);
  const safeCoTeachingClasses = safeArray(coTeachingClasses);

  return (
    <div className="card mb-6">
      <h3 className="text-xl font-bold mb-4">👨‍🏫 교사별 시수 현황</h3>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>교사</th>
              <th>총 시수</th>
              <th>주간 시수</th>
              <th>설정된 학급별 시수</th>
              <th>과목별 시수</th>
              <th>공동수업</th>
              <th>공동수업 유형</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(safeTeacherHours).map(([teacherName, hours]) => {
              const totalHours = hours?.totalHours || 0;
              const weeklyHours = hours?.weeklyHours || 0;
              const difference = totalHours - weeklyHours;
              const isOverLimit = difference > 0;
              const teacherHasCoTeaching = hasCoTeaching(teacherName, safeCoTeachingClasses);
              const coTeachingTypes = getCoTeachingTypes(teacherName, safeCoTeachingClasses);
              
              return (
                <tr key={teacherName} className={isOverLimit ? 'bg-red-50' : teacherHasCoTeaching ? 'bg-blue-50' : ''}>
                  <td className="font-semibold">{teacherName}</td>
                  <td className={isOverLimit ? 'text-red-600 font-bold' : ''}>
                    {totalHours}시간
                  </td>
                  <td>{weeklyHours}시간</td>
                  <td className="text-green-600 font-semibold">
                    {hours?.weeklyHoursSum || 0}시간
                  </td>
                  <td>
                    <div className="text-sm">
                      {Object.entries(safeObject(hours.subjects || {})).map(([subject, count]) => (
                        <span key={subject} className="inline-block bg-gray-100 px-2 py-1 rounded mr-1 mb-1">
                          {subject}: {count}시간
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    {teacherHasCoTeaching ? (
                      <span className="text-blue-600 text-sm">✓ 공동수업</span>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td>
                    {coTeachingTypes.length > 0 ? (
                      <div className="space-y-1">
                        {coTeachingTypes.map((type, index) => (
                          <span key={index} className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                            type === '제약조건' 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {type}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
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

export default TeacherHoursTable; 