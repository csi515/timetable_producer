import React, { useState, useMemo } from 'react';
import { TimetableData } from '../types';

interface TeacherTimetableProps {
  data: TimetableData;
  schedule: any;
}

interface TeacherScheduleEntry {
  classCode: string;
  subject: string;
  className: string;
  isCoTeaching: boolean;
  isFixed: boolean;
  isBlockPeriod: boolean;
}

const TeacherTimetable: React.FC<TeacherTimetableProps> = ({ data, schedule }) => {
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [viewMode, setViewMode] = useState<'all' | 'single'>('all');
  
  const days = ['월', '화', '수', '목', '금'];
  
  // 교사별 시간표 데이터 생성
  const teacherSchedules = useMemo(() => {
    const teacherData: Record<string, Record<string, Record<number, TeacherScheduleEntry[]>>> = {};
    
    // 모든 교사 초기화
    data.teachers.forEach(teacher => {
      teacherData[teacher.name] = {};
      days.forEach(day => {
        teacherData[teacher.name][day] = {};
        const maxPeriods = data.base.periods_per_day[day] || 7;
        for (let period = 1; period <= maxPeriods; period++) {
          teacherData[teacher.name][day][period] = [];
        }
      });
    });

    // 스케줄에서 교사별 데이터 추출
    Object.entries(schedule).forEach(([className, classSchedule]: [string, any]) => {
      days.forEach(day => {
        if (classSchedule[day]) {
          Object.entries(classSchedule[day]).forEach(([periodStr, scheduleItem]: [string, any]) => {
            const period = parseInt(periodStr) + 1;
            
            if (scheduleItem && typeof scheduleItem === 'object' && scheduleItem.subject) {
              const teachers = scheduleItem.teachers || [];
              teachers.forEach((teacherName: string) => {
                if (teacherData[teacherName] && teacherData[teacherName][day] && teacherData[teacherName][day][period]) {
                  teacherData[teacherName][day][period].push({
                    classCode: className,
                    subject: scheduleItem.subject,
                    className: className,
                    isCoTeaching: scheduleItem.isCoTeaching || false,
                    isFixed: scheduleItem.isFixed || false,
                    isBlockPeriod: scheduleItem.isBlockPeriod || false
                  });
                }
              });
            } else if (scheduleItem && typeof scheduleItem === 'string' && scheduleItem.trim() !== '') {
              // 문자열 형식의 기존 데이터 처리
              const teacherName = scheduleItem.trim();
              if (teacherData[teacherName] && teacherData[teacherName][day] && teacherData[teacherName][day][period]) {
                teacherData[teacherName][day][period].push({
                  classCode: className,
                  subject: '과목명', // 기본값
                  className: className,
                  isCoTeaching: false,
                  isFixed: false,
                  isBlockPeriod: false
                });
              }
            }
          });
        }
      });
    });

    return teacherData;
  }, [data, schedule]);

  // 교사별 주간 시수 계산
  const teacherWeeklyHours = useMemo(() => {
    const hours: Record<string, { expected: number; actual: number }> = {};
    
    data.teachers.forEach(teacher => {
      const expected = teacher.max_hours_per_week || teacher.maxHours || 0;
      let actual = 0;
      
      days.forEach(day => {
        Object.values(teacherSchedules[teacher.name]?.[day] || {}).forEach(entries => {
          actual += entries.length;
        });
      });
      
      hours[teacher.name] = { expected, actual };
    });
    
    return hours;
  }, [data.teachers, teacherSchedules]);

  // 최대 교시 수 계산
  const maxPeriods = Math.max(...Object.values(data.base.periods_per_day));

  // 셀 렌더링 함수
  const renderCell = (entries: TeacherScheduleEntry[], teacherName: string) => {
    if (entries.length === 0) {
      return <div className="text-gray-400 text-xs">-</div>;
    }

    return (
      <div className="space-y-1">
        {entries.map((entry, index) => {
          let bgColor = 'bg-green-50';
          let borderColor = 'border-green-200';
          let textColor = 'text-green-800';
          
          if (entry.isCoTeaching) {
            bgColor = 'bg-blue-50';
            borderColor = 'border-blue-200';
            textColor = 'text-blue-800';
          } else if (entry.isFixed) {
            bgColor = 'bg-yellow-50';
            borderColor = 'border-yellow-200';
            textColor = 'text-yellow-800';
          } else if (entry.isBlockPeriod) {
            bgColor = 'bg-red-50';
            borderColor = 'border-red-200';
            textColor = 'text-red-800';
          }

          return (
            <div
              key={index}
              className={`p-1 rounded text-xs border ${bgColor} ${borderColor} ${textColor} break-words`}
              title={`${entry.subject} - ${entry.className}`}
            >
              <div className="font-medium">{entry.classCode}</div>
              <div className="text-xs">{entry.subject}</div>
              {entry.isCoTeaching && <div className="text-xs">(공동)</div>}
              {entry.isFixed && <div className="text-xs">(고정)</div>}
              {entry.isBlockPeriod && <div className="text-xs">(블록)</div>}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="timetable-container">
      {/* 헤더 */}
      <div className="timetable-header">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-bold text-gray-900">교사별 시간표</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  viewMode === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                전체 보기
              </button>
              <button
                onClick={() => setViewMode('single')}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  viewMode === 'single'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                개별 보기
              </button>
            </div>
          </div>
          
          {viewMode === 'single' && (
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="">교사 선택</option>
              {data.teachers.map(teacher => (
                <option key={teacher.name} value={teacher.name}>
                  {teacher.name} ({teacherWeeklyHours[teacher.name]?.expected || 0}시수)
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 범례 */}
        <div className="px-4 pb-4">
          <div className="flex items-center space-x-4 text-xs">
            <span className="font-medium">범례:</span>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-50 border border-green-200 rounded"></div>
              <span>일반 수업</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-50 border border-blue-200 rounded"></div>
              <span>공동 수업</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-50 border border-yellow-200 rounded"></div>
              <span>고정 수업</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-50 border border-red-200 rounded"></div>
              <span>블록 수업</span>
            </div>
          </div>
        </div>
      </div>

      {/* 시간표 테이블 */}
      <div className="overflow-x-auto">
        <table className="timetable-table">
          <thead className="timetable-thead">
            <tr>
                              <th className="timetable-th-sticky min-w-[150px]">
                  교사명 (예정/실제)
                </th>
                              {days.map(day => (
                  <th key={day} colSpan={data.base.periods_per_day[day]} className="timetable-th">
                    {day}
                  </th>
                ))}
            </tr>
            <tr>
                              <th className="timetable-th-sticky text-xs">
                  교시
                </th>
              {days.map(day => {
                const periods = data.base.periods_per_day[day];
                return Array.from({ length: periods }, (_, i) => (
                                      <th key={`${day}-${i+1}`} className="timetable-th text-xs min-w-[100px]">
                      {i + 1}
                    </th>
                ));
              })}
            </tr>
          </thead>
          <tbody>
            {(viewMode === 'all' ? data.teachers : data.teachers.filter(t => t.name === selectedTeacher)).map(teacher => {
              const teacherSchedule = teacherSchedules[teacher.name];
              const hours = teacherWeeklyHours[teacher.name];
              const isOverLimit = hours && hours.actual > hours.expected;
              
              return (
                <tr key={teacher.name} className="hover:bg-gray-50">
                  <td className={`border border-gray-200 p-2 text-center font-medium text-sm sticky left-0 z-10 ${
                    isOverLimit ? 'bg-red-50 text-red-700' : 'bg-white'
                  }`}>
                    <div className="font-bold">{teacher.name}</div>
                    <div className={`text-xs ${isOverLimit ? 'text-red-600' : 'text-gray-500'}`}>
                      {hours?.expected || 0}/{hours?.actual || 0}
                    </div>
                    {isOverLimit && <div className="text-xs text-red-600">초과!</div>}
                  </td>
                  {days.map(day => {
                    const periods = data.base.periods_per_day[day];
                    return Array.from({ length: periods }, (_, periodIndex) => {
                      const period = periodIndex + 1;
                      const entries = teacherSchedule?.[day]?.[period] || [];
                      
                      return (
                        <td key={`${day}-${period}`} className="border border-gray-200 p-1 align-top min-h-[80px]">
                          {renderCell(entries, teacher.name)}
                        </td>
                      );
                    });
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 통계 정보 */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">교사별 시수 통계</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {data.teachers.map(teacher => {
            const hours = teacherWeeklyHours[teacher.name];
            const isOverLimit = hours && hours.actual > hours.expected;
            
            return (
              <div key={teacher.name} className={`p-3 rounded-lg border ${
                isOverLimit ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
              }`}>
                <div className="font-medium text-sm">{teacher.name}</div>
                <div className={`text-lg font-bold ${isOverLimit ? 'text-red-600' : 'text-gray-700'}`}>
                  {hours?.actual || 0}/{hours?.expected || 0}
                </div>
                {isOverLimit && (
                  <div className="text-xs text-red-600">
                    +{hours.actual - hours.expected} 초과
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TeacherTimetable;