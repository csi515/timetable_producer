import React from 'react';

/**
 * 주간 교사시수 비교 테이블
 * @param {Object} props
 * @param {Object} props.teacherHours - 교사별 시수 데이터
 * @param {Array} props.coTeachingClasses - 공동수업 목록
 * @param {Object} props.data - 전체 데이터
 */
const WeeklyHoursComparisonTable = ({ teacherHours, coTeachingClasses, data }) => {
  if (!teacherHours) {
    return null;
  }



  // 교사별 주간 시수 계산 (공동수업 포함)
  const calculateTeacherWeeklyHours = (teacherName) => {
    const teacherData = teacherHours[teacherName];
    if (!teacherData) return 0;
    
    let totalHours = teacherData.totalHours || 0;
    
    // 공동수업으로 인한 추가 시수 계산
    const coTeachingForTeacher = coTeachingClasses?.filter(ct => 
      ct.mainTeacher === teacherName || 
      (ct.coTeachers && ct.coTeachers.includes(teacherName))
    ) || [];
    
    // 제약조건 기반 공동수업은 이미 teacherHours에 포함되어 있음
    // 고정수업 기반 공동수업만 추가 계산
    const fixedCoTeachingHours = coTeachingForTeacher.filter(ct => 
      ct.source === 'fixed_class'
    ).length;
    
    return totalHours + fixedCoTeachingHours;
  };


  const teacherList = Object.keys(teacherHours || {});

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <span className="mr-2">📊</span>
        주간 시수 비교 분석
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        교사별 주간 시수를 목표 시수와 비교합니다. 공동수업 참여 시수가 포함되어 표시됩니다.
      </p>

      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-3 border">구분</th>
              <th className="text-center p-3 border">주간 시수</th>
              <th className="text-center p-3 border">목표 시수</th>
              <th className="text-center p-3 border">차이</th>
              <th className="text-center p-3 border">상태</th>
            </tr>
          </thead>
          <tbody>
            {/* 교사별 시수 요약 */}
            <tr className="bg-green-50">
              <td className="font-semibold p-3 border" colSpan="5">
                👨‍🏫 교사별 시수 요약 (공동수업 포함)
              </td>
            </tr>
            {teacherList.map(teacherName => {
              const teacher = data?.teachers?.find(t => t.name === teacherName);
              const weeklyHours = calculateTeacherWeeklyHours(teacherName);
              const targetHours = teacher?.weeklyHours || teacher?.maxHours || 25;
              const difference = weeklyHours - targetHours;
              const status = difference > 0 ? '초과' : difference < 0 ? '부족' : '적정';
              const statusColor = difference > 0 ? 'text-red-600' : difference < 0 ? 'text-yellow-600' : 'text-green-600';
              
              // 공동수업 참여 여부 확인
              const hasCoTeaching = coTeachingClasses?.some(ct => 
                ct.mainTeacher === teacherName || 
                (ct.coTeachers && ct.coTeachers.includes(teacherName))
              );
              
              return (
                <tr key={teacherName} className={`hover:bg-gray-50 ${hasCoTeaching ? 'bg-blue-50' : ''}`}>
                  <td className="p-3 border font-medium">
                    {teacherName}
                    {hasCoTeaching && <span className="ml-2 text-blue-600 text-xs">🤝</span>}
                  </td>
                  <td className="p-3 border text-center">{weeklyHours}시간</td>
                  <td className="p-3 border text-center">{targetHours}시간</td>
                  <td className={`p-3 border text-center font-semibold ${difference > 0 ? 'text-red-600' : difference < 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {difference > 0 ? '+' : ''}{difference}시간
                  </td>
                  <td className={`p-3 border text-center font-semibold ${statusColor}`}>
                    {status}
                  </td>
                </tr>
              );
            })}

            {/* 전체 통계 */}
            <tr className="bg-gray-100">
              <td className="font-semibold p-3 border" colSpan="5">
                📈 전체 통계
              </td>
            </tr>
            <tr className="bg-gray-50">
              <td className="p-3 border font-medium">총 교사 시수</td>
              <td className="p-3 border text-center font-semibold">
                {teacherList.reduce((sum, teacherName) => sum + calculateTeacherWeeklyHours(teacherName), 0)}시간
              </td>
              <td className="p-3 border text-center">
                {teacherList.reduce((sum, teacherName) => {
                  const teacher = data?.teachers?.find(t => t.name === teacherName);
                  return sum + (teacher?.weeklyHours || teacher?.maxHours || 25);
                }, 0)}시간
              </td>
              <td className="p-3 border text-center font-semibold">
                {teacherList.reduce((sum, teacherName) => {
                  const teacher = data?.teachers?.find(t => t.name === teacherName);
                  const weeklyHours = calculateTeacherWeeklyHours(teacherName);
                  const targetHours = teacher?.weeklyHours || teacher?.maxHours || 25;
                  return sum + (weeklyHours - targetHours);
                }, 0)}시간
              </td>
              <td className="p-3 border text-center">-</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 범례 */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <h4 className="font-semibold mb-2">📋 범례</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div className="flex items-center">
            <span className="w-4 h-4 bg-blue-50 border mr-2"></span>
            <span>공동수업 참여 교사 🤝</span>
          </div>
          <div className="flex items-center">
            <span className="text-green-600 font-semibold mr-2">적정</span>
            <span>목표 시수와 일치</span>
          </div>
          <div className="flex items-center">
            <span className="text-yellow-600 font-semibold mr-2">부족</span>
            <span>목표 시수보다 적음</span>
          </div>
          <div className="flex items-center">
            <span className="text-red-600 font-semibold mr-2">초과</span>
            <span>목표 시수보다 많음</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyHoursComparisonTable; 