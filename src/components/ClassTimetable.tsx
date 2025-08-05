import React, { useState, useMemo } from 'react';
import { TimetableData } from '../types';

interface ClassTimetableProps {
  data: TimetableData;
  schedule: any;
}

interface ClassScheduleEntry {
  subject: string;
  teachers: string[];
  isCoTeaching: boolean;
  isFixed: boolean;
  isBlockPeriod: boolean;
}

const ClassTimetable: React.FC<ClassTimetableProps> = ({ data, schedule }) => {
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [viewMode, setViewMode] = useState<'all' | 'single'>('all');
  
  const days = ['월', '화', '수', '목', '금'];
  
  // 학급 목록 생성
  const classList = useMemo(() => {
    return Object.keys(schedule).sort();
  }, [schedule]);

  // 학급별 시수 통계 계산
  const classSubjectHours = useMemo(() => {
    const stats: Record<string, Record<string, { expected: number; actual: number }>> = {};
    
    classList.forEach(className => {
      stats[className] = {};
      
      // 각 과목별 예정 시수 설정
      data.subjects.forEach(subject => {
        stats[className][subject.name] = {
          expected: subject.weekly_hours || 0,
          actual: 0
        };
      });
      
      // 실제 배정된 시수 계산
      const classSchedule = schedule[className];
      if (classSchedule) {
        days.forEach(day => {
          if (classSchedule[day]) {
            Object.values(classSchedule[day]).forEach((scheduleItem: any) => {
              if (scheduleItem && typeof scheduleItem === 'object' && scheduleItem.subject) {
                const subjectName = scheduleItem.subject;
                if (stats[className][subjectName]) {
                  stats[className][subjectName].actual++;
                }
              } else if (scheduleItem && typeof scheduleItem === 'string' && scheduleItem.trim() !== '') {
                // 문자열 형식의 기존 데이터 처리
                const subjectName = scheduleItem.trim();
                if (stats[className][subjectName]) {
                  stats[className][subjectName].actual++;
                }
              }
            });
          }
        });
      }
    });
    
    return stats;
  }, [data.subjects, schedule, classList, days]);

  // 최대 교시 수 계산
  const maxPeriods = Math.max(...Object.values(data.base.periods_per_day));

  // 셀 렌더링 함수
  const renderCell = (scheduleItem: any, className: string, day: string, period: number) => {
    if (!scheduleItem) {
      return <div className="text-gray-400 text-xs">-</div>;
    }

    let displayText = '';
    let bgColor = 'bg-green-50';
    let borderColor = 'border-green-200';
    let textColor = 'text-green-800';
    let isBlockPeriod = false;
    let isCoTeaching = false;
    let isFixed = false;

    if (typeof scheduleItem === 'object' && scheduleItem.subject) {
      displayText = scheduleItem.subject;
      isCoTeaching = scheduleItem.isCoTeaching || false;
      isFixed = scheduleItem.isFixed || false;
      isBlockPeriod = scheduleItem.isBlockPeriod || false;
      
      if (isCoTeaching) {
        bgColor = 'bg-blue-50';
        borderColor = 'border-blue-200';
        textColor = 'text-blue-800';
      } else if (isFixed) {
        bgColor = 'bg-yellow-50';
        borderColor = 'border-yellow-200';
        textColor = 'text-yellow-800';
      } else if (isBlockPeriod) {
        bgColor = 'bg-red-50';
        borderColor = 'border-red-200';
        textColor = 'text-red-800';
      }
    } else if (typeof scheduleItem === 'string' && scheduleItem.trim() !== '') {
      displayText = scheduleItem.trim();
    }

    return (
      <div
        className={`p-2 rounded text-sm border ${bgColor} ${borderColor} ${textColor} break-words min-h-[60px] flex flex-col justify-center`}
        title={`${displayText}${isCoTeaching ? ' (공동수업)' : ''}${isFixed ? ' (고정)' : ''}${isBlockPeriod ? ' (블록제)' : ''}`}
      >
        <div className="font-medium text-center">{displayText}</div>
        {isCoTeaching && <div className="text-xs text-center mt-1">(공동)</div>}
        {isFixed && <div className="text-xs text-center mt-1">(고정)</div>}
        {isBlockPeriod && <div className="text-xs text-center mt-1">(블록)</div>}
      </div>
    );
  };

  // 초기 선택값 설정
  React.useEffect(() => {
    if (!selectedClass && classList.length > 0) {
      setSelectedClass(classList[0]);
    }
  }, [classList, selectedClass]);

  return (
    <div className="timetable-container">
      {/* 헤더 */}
      <div className="timetable-header">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-bold text-gray-900">학급별 시간표</h2>
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
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            >
              {classList.map(className => (
                <option key={className} value={className}>
                  {className}
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
        {(viewMode === 'all' ? classList : [selectedClass]).map(className => {
          const classSchedule = schedule[className];
          const subjectStats = classSubjectHours[className];
          
          return (
            <div key={className} className="mb-8">
              <div className="bg-gray-50 p-4 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{className} 시간표</h3>
                
                {/* 과목별 시수 통계 */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {Object.entries(subjectStats || {}).map(([subjectName, stat]) => {
                    const isOverLimit = stat.actual > stat.expected;
                    const isUnderLimit = stat.actual < stat.expected;
                    
                    return (
                      <div key={subjectName} className={`p-2 rounded text-xs border ${
                        isOverLimit ? 'bg-red-50 border-red-200' :
                        isUnderLimit ? 'bg-yellow-50 border-yellow-200' :
                        'bg-green-50 border-green-200'
                      }`}>
                        <div className="font-medium truncate">{subjectName}</div>
                        <div className={`font-bold ${
                          isOverLimit ? 'text-red-600' :
                          isUnderLimit ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {stat.actual}/{stat.expected}
                        </div>
                        {isOverLimit && <div className="text-red-600">+{stat.actual - stat.expected}</div>}
                        {isUnderLimit && <div className="text-yellow-600">-{stat.expected - stat.actual}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <table className="w-full border-collapse bg-white">
                <thead className="bg-gray-50 sticky top-32 z-10">
                  <tr>
                    <th className="border border-gray-200 p-2 text-center font-medium text-gray-700 min-w-[80px]">
                      교시
                    </th>
                    {days.map(day => (
                      <th key={day} className="border border-gray-200 p-2 text-center font-medium text-gray-700 min-w-[120px]">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: maxPeriods }, (_, periodIndex) => {
                    const period = periodIndex + 1;
                    
                    return (
                      <tr key={period} className="hover:bg-gray-50">
                        <td className="border border-gray-200 p-2 text-center font-medium text-gray-700 bg-gray-50">
                          {period}교시
                        </td>
                        {days.map(day => {
                          const isValidPeriod = period <= data.base.periods_per_day[day];
                          const scheduleItem = classSchedule?.[day]?.[period - 1];
                          
                          return (
                            <td key={day} className="border border-gray-200 p-1 align-top">
                              {isValidPeriod ? renderCell(scheduleItem, className, day, period) : (
                                <div className="text-gray-300 text-xs text-center">-</div>
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
        })}
      </div>

      {/* 전체 통계 */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">전체 학급 통계</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-blue-600">{classList.length}</div>
            <div className="text-sm text-gray-600">총 학급 수</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-green-600">{data.subjects.length}</div>
            <div className="text-sm text-gray-600">총 과목 수</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-orange-600">{data.teachers.length}</div>
            <div className="text-sm text-gray-600">총 교사 수</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-purple-600">
              {Object.values(classSubjectHours).reduce((total, classStats) => {
                return total + Object.values(classStats).reduce((sum, stat) => {
                  return sum + Math.max(0, stat.expected - stat.actual);
                }, 0);
              }, 0)}
            </div>
            <div className="text-sm text-gray-600">부족 시수</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassTimetable;