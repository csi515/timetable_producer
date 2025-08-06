import React, { useState, useEffect } from 'react';
import { 
  convertScheduleItem,
  isBlockPeriodTeacher,
  getCurrentSubjectHours,
  getClassList,
  getTeacherList,
  getTeacherSchedule,
  getSubjectHoursStats,
  getTeacherHoursStats
} from './ReviewAndExportHelpers';
import { exportToJSON, exportToExcel } from './ReviewAndExportExport';

function ReviewAndExport({ data, updateData, prevStep }) {
  const [viewMode, setViewMode] = useState('class'); // 'class' or 'teacher'
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');

  const days = ['월', '화', '수', '목', '금'];

  // 컴포넌트 마운트 시 첫 번째 학급/교사 선택
  useEffect(() => {
    const classList = getClassList(data);
    const teacherList = getTeacherList(data);
    
    if (classList.length > 0 && !selectedClass) {
      setSelectedClass(classList[0]);
    }
    
    if (teacherList.length > 0 && !selectedTeacher) {
      setSelectedTeacher(teacherList[0]);
    }
  }, [data, selectedClass, selectedTeacher]);

  // 선택된 학급/교사 변경 시 자동 선택
  useEffect(() => {
    const classList = getClassList(data);
    const teacherList = getTeacherList(data);
    
    if (viewMode === 'class' && classList.length > 0 && !classList.includes(selectedClass)) {
      setSelectedClass(classList[0]);
    }
    
    if (viewMode === 'teacher' && teacherList.length > 0 && !teacherList.includes(selectedTeacher)) {
      setSelectedTeacher(teacherList[0]);
    }
  }, [viewMode, data, selectedClass, selectedTeacher]);

  // 시간표 렌더링
  const renderTimetable = () => {
    if (!data.schedule || Object.keys(data.schedule).length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">생성된 시간표가 없습니다.</p>
        </div>
      );
    }

    if (viewMode === 'class') {
      return renderClassTimetable();
    } else {
      return renderTeacherTimetable();
    }
  };

  // 학급별 시간표 렌더링
  const renderClassTimetable = () => {
    if (!selectedClass || !data.schedule[selectedClass]) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">학급을 선택해주세요.</p>
        </div>
      );
    }

    const classSchedule = data.schedule[selectedClass];
    const periodsPerDay = data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr>
              <th className="border border-gray-300 bg-gray-100 px-4 py-2 font-semibold">교시</th>
              {days.map(day => (
                <th key={day} className="border border-gray-300 bg-gray-100 px-4 py-2 font-semibold">
                  {day}요일
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(...Object.values(periodsPerDay)) }, (_, periodIndex) => {
              const period = periodIndex + 1;
              return (
                <tr key={period}>
                  <td className="border border-gray-300 bg-gray-50 px-4 py-2 font-medium text-center">
                    {period}교시
                  </td>
                  {days.map(day => {
                    const slot = classSchedule[day]?.[periodIndex];
                    const convertedSlot = convertScheduleItem(slot, selectedClass, day, period, data);
                    
                    return (
                      <td key={day} className="border border-gray-300 px-4 py-2 text-center">
                        {convertedSlot ? (
                          <div>
                            <div className="font-medium text-sm">{convertedSlot.subject}</div>
                            <div className="text-xs text-gray-600">
                              {convertedSlot.teachers.join(', ')}
                            </div>
                            {convertedSlot.isCoTeaching && (
                              <div className="text-xs text-blue-600">공동수업</div>
                            )}
                            {convertedSlot.isFixed && (
                              <div className="text-xs text-green-600">고정</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // 교사별 시간표 렌더링
  const renderTeacherTimetable = () => {
    if (!selectedTeacher) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">교사를 선택해주세요.</p>
        </div>
      );
    }

    const teacherSchedule = getTeacherSchedule(selectedTeacher, data);
    const periodsPerDay = data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr>
              <th className="border border-gray-300 bg-gray-100 px-4 py-2 font-semibold">교시</th>
              {days.map(day => (
                <th key={day} className="border border-gray-300 bg-gray-100 px-4 py-2 font-semibold">
                  {day}요일
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(...Object.values(periodsPerDay)) }, (_, periodIndex) => {
              const period = periodIndex + 1;
              return (
                <tr key={period}>
                  <td className="border border-gray-300 bg-gray-50 px-4 py-2 font-medium text-center">
                    {period}교시
                  </td>
                  {days.map(day => {
                    const slot = teacherSchedule[day]?.[periodIndex];
                    
                    return (
                      <td key={day} className="border border-gray-300 px-4 py-2 text-center">
                        {slot ? (
                          <div>
                            <div className="font-medium text-sm">{slot.className}</div>
                            <div className="text-xs text-gray-600">{slot.subject}</div>
                            {slot.isCoTeaching && (
                              <div className="text-xs text-blue-600">공동수업</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // 통계 정보 렌더링
  const renderStats = () => {
    const stats = getSubjectHoursStats(data);
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(stats).map(([className, subjectStats]) => (
          <div key={className} className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-lg mb-3">{className}</h3>
            <div className="space-y-2">
              {Object.entries(subjectStats).map(([subject, hours]) => (
                <div key={subject} className="flex justify-between text-sm">
                  <span className="text-gray-700">{subject}</span>
                  <span className="font-medium">{hours}시간</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">시간표 검토 및 내보내기</h2>
        
        {/* 뷰 모드 선택 */}
        <div className="mb-6">
          <div className="flex space-x-4">
            <button
              onClick={() => setViewMode('class')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'class'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              학급별 보기
            </button>
            <button
              onClick={() => setViewMode('teacher')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'teacher'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              교사별 보기
            </button>
          </div>
        </div>

        {/* 선택 드롭다운 */}
        <div className="mb-6">
          {viewMode === 'class' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                학급 선택
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {getClassList(data).map(className => (
                  <option key={className} value={className}>
                    {className}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                교사 선택
              </label>
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {getTeacherList(data).map(teacherName => (
                  <option key={teacherName} value={teacherName}>
                    {teacherName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 시간표 표시 */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {viewMode === 'class' ? `${selectedClass} 시간표` : `${selectedTeacher} 교사 시간표`}
          </h3>
          {renderTimetable()}
        </div>

        {/* 통계 정보 */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">과목별 시수 통계</h3>
          {renderStats()}
        </div>

        {/* 내보내기 버튼 */}
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => exportToJSON(data)}
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            JSON으로 내보내기
          </button>
          
          <button
            onClick={async () => {
              try {
                await exportToExcel(data.schedule, getTeacherHoursStats(data), data);
              } catch (error) {
                console.error('Excel 내보내기 실패:', error);
              }
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Excel로 내보내기
          </button>
          
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
}

export default ReviewAndExport; 