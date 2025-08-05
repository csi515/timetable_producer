import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { TimetableData } from '../types';

interface VirtualizedTimetableProps {
  data: TimetableData;
  schedule: any;
  type: 'teacher' | 'class';
  itemHeight?: number;
  visibleItems?: number;
}

interface TimetableItem {
  id: string;
  name: string;
  schedule: any;
  stats?: any;
}

const VirtualizedTimetable: React.FC<VirtualizedTimetableProps> = ({
  data,
  schedule,
  type,
  itemHeight = 80,
  visibleItems = 15
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const days = ['월', '화', '수', '목', '금'];

  // 시간표 아이템 데이터 생성
  const timetableItems = useMemo(() => {
    if (type === 'teacher') {
      return data.teachers.map(teacher => {
        const teacherSchedule = generateTeacherSchedule(teacher.name);
        const stats = calculateTeacherStats(teacher, teacherSchedule);
        
        return {
          id: teacher.name,
          name: teacher.name,
          schedule: teacherSchedule,
          stats
        };
      });
    } else {
      return Object.keys(schedule).map(className => {
        const classSchedule = schedule[className];
        const stats = calculateClassStats(className, classSchedule);
        
        return {
          id: className,
          name: className,
          schedule: classSchedule,
          stats
        };
      });
    }
  }, [data, schedule, type]);

  // 교사별 시간표 생성
  const generateTeacherSchedule = useCallback((teacherName: string) => {
    const teacherSchedule: Record<string, any[]> = {};
    days.forEach(day => {
      teacherSchedule[day] = [];
    });

    Object.entries(schedule).forEach(([className, classSchedule]: [string, any]) => {
      days.forEach(day => {
        if (classSchedule[day]) {
          Object.entries(classSchedule[day]).forEach(([periodStr, scheduleItem]: [string, any]) => {
            const periodIndex = parseInt(periodStr);
            if (!teacherSchedule[day][periodIndex]) {
              teacherSchedule[day][periodIndex] = [];
            }

            if (scheduleItem) {
              if (typeof scheduleItem === 'object' && scheduleItem.subject) {
                const teachers = scheduleItem.teachers || [];
                if (teachers.includes(teacherName)) {
                  teacherSchedule[day][periodIndex].push({
                    classCode: className,
                    subject: scheduleItem.subject,
                    isCoTeaching: scheduleItem.isCoTeaching || false,
                    isFixed: scheduleItem.isFixed || false,
                    isBlockPeriod: scheduleItem.isBlockPeriod || false
                  });
                }
              } else if (typeof scheduleItem === 'string' && scheduleItem.trim() === teacherName) {
                teacherSchedule[day][periodIndex].push({
                  classCode: className,
                  subject: '과목명',
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

    return teacherSchedule;
  }, [schedule, days]);

  // 교사 통계 계산
  const calculateTeacherStats = useCallback((teacher: any, teacherSchedule: any) => {
    const expected = teacher.max_hours_per_week || teacher.maxHours || 0;
    let actual = 0;
    
    days.forEach(day => {
      Object.values(teacherSchedule[day] || {}).forEach((entries: any) => {
        actual += entries.length;
      });
    });
    
    return { expected, actual, isOverLimit: actual > expected };
  }, [days]);

  // 학급 통계 계산
  const calculateClassStats = useCallback((className: string, classSchedule: any) => {
    const stats: Record<string, { expected: number; actual: number }> = {};
    
    data.subjects.forEach(subject => {
      stats[subject.name] = { expected: subject.weekly_hours || 0, actual: 0 };
    });
    
    days.forEach(day => {
      if (classSchedule[day]) {
        Object.values(classSchedule[day]).forEach((scheduleItem: any) => {
          if (scheduleItem) {
            if (typeof scheduleItem === 'object' && scheduleItem.subject) {
              const subjectName = scheduleItem.subject;
              if (stats[subjectName]) {
                stats[subjectName].actual++;
              }
            } else if (typeof scheduleItem === 'string' && scheduleItem.trim() !== '') {
              const subjectName = scheduleItem.trim();
              if (stats[subjectName]) {
                stats[subjectName].actual++;
              }
            }
          }
        });
      }
    });
    
    return stats;
  }, [data.subjects, days]);

  // 가상화 계산
  const totalHeight = timetableItems.length * itemHeight;
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleItems, timetableItems.length);
  const visibleItemsData = timetableItems.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  // 스크롤 핸들러
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // 셀 렌더링
  const renderCell = useCallback((entries: any[], itemName: string) => {
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
              title={`${entry.subject} - ${entry.classCode}`}
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
  }, []);

  // 학급용 셀 렌더링
  const renderClassCell = useCallback((scheduleItem: any, className: string, day: string, period: number) => {
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
  }, []);

  return (
    <div className="timetable-container">
      {/* 헤더 */}
      <div className="timetable-header">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {type === 'teacher' ? '교사별 시간표' : '학급별 시간표'}
            </h2>
            <div className="text-sm text-gray-600">
              총 {timetableItems.length}개 항목
            </div>
          </div>
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

      {/* 가상화된 시간표 */}
      <div 
        ref={containerRef}
        className="overflow-auto"
        style={{ height: `${visibleItems * itemHeight}px` }}
        onScroll={handleScroll}
      >
        <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {visibleItemsData.map((item) => (
              <div key={item.id} style={{ height: `${itemHeight}px` }}>
                {type === 'teacher' ? (
                  <TeacherRow 
                    item={item} 
                    days={days} 
                    data={data} 
                    renderCell={renderCell}
                  />
                ) : (
                  <ClassRow 
                    item={item} 
                    days={days} 
                    data={data} 
                    renderCell={renderClassCell}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// 교사 행 컴포넌트
const TeacherRow: React.FC<{
  item: TimetableItem;
  days: string[];
  data: TimetableData;
  renderCell: (entries: any[], itemName: string) => React.ReactNode;
}> = ({ item, days, data, renderCell }) => {
  const stats = item.stats;
  const isOverLimit = stats?.isOverLimit;

  return (
    <div className="border-b border-gray-200 hover:bg-gray-50">
      <div className="grid grid-cols-1" style={{ 
        gridTemplateColumns: `150px repeat(${days.length}, 1fr)` 
      }}>
        {/* 교사명 셀 */}
        <div className={`p-2 text-center font-medium text-sm sticky left-0 z-10 ${
          isOverLimit ? 'bg-red-50 text-red-700' : 'bg-white'
        }`}>
          <div className="font-bold">{item.name}</div>
          <div className={`text-xs ${isOverLimit ? 'text-red-600' : 'text-gray-500'}`}>
            {stats?.expected || 0}/{stats?.actual || 0}
          </div>
          {isOverLimit && <div className="text-xs text-red-600">초과!</div>}
        </div>

        {/* 요일별 셀 */}
        {days.map(day => {
          const periods = data.base.periods_per_day[day];
          return Array.from({ length: periods }, (_, periodIndex) => {
            const period = periodIndex + 1;
            const entries = item.schedule[day]?.[period] || [];
            
            return (
              <div key={`${day}-${period}`} className="timetable-td">
                {renderCell(entries, item.name)}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
};

// 학급 행 컴포넌트
const ClassRow: React.FC<{
  item: TimetableItem;
  days: string[];
  data: TimetableData;
  renderCell: (scheduleItem: any, className: string, day: string, period: number) => React.ReactNode;
}> = ({ item, days, data, renderCell }) => {
  const maxPeriods = Math.max(...Object.values(data.base.periods_per_day));

  return (
    <div className="border-b border-gray-200 hover:bg-gray-50">
      <div className="grid grid-cols-1" style={{ 
        gridTemplateColumns: `80px repeat(${days.length}, 1fr)` 
      }}>
        {/* 교시 셀 */}
        <div className="p-2 text-center font-medium text-sm bg-gray-50 sticky left-0 z-10">
          {item.name}
        </div>

        {/* 요일별 셀 */}
        {days.map(day => {
          const periods = data.base.periods_per_day[day];
          return Array.from({ length: periods }, (_, periodIndex) => {
            const period = periodIndex + 1;
            const scheduleItem = item.schedule[day]?.[period - 1];
            const isValidPeriod = period <= data.base.periods_per_day[day];
            
            return (
              <div key={`${day}-${period}`} className="timetable-td">
                {isValidPeriod ? renderCell(scheduleItem, item.name, day, period) : (
                  <div className="text-gray-300 text-xs text-center">-</div>
                )}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
};

export default VirtualizedTimetable;