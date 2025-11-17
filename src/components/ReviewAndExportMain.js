"use client";

import React, { useState, useEffect } from 'react';
import { 
  convertScheduleItem,
  isBlockPeriodTeacher,
  getCurrentSubjectHours,
  getClassList,
  getTeacherList,
  getTeacherSchedule,
  getAllTeachersSchedule,
  getSubjectHoursStats,
  getTeacherHoursStats
} from './ReviewAndExportHelpers';
import { exportToJSON, exportToExcel } from './ReviewAndExportExport';

function ReviewAndExport({ data, updateData, prevStep = () => {} }) {
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

    // 교사 상호 배제 정보 수집 및 커플 그룹화
    const teacherMutualExclusions = {};
    const mutualExclusionGroups = [];
    const processedPairs = new Set();

    data.teachers?.forEach(teacher => {
      if (teacher.mutual_exclusions && teacher.mutual_exclusions.length > 0) {
        teacherMutualExclusions[teacher.name] = teacher.mutual_exclusions;
        
        // 상호 배제 커플 그룹화
        teacher.mutual_exclusions.forEach(excludedTeacher => {
          const pairKey = [teacher.name, excludedTeacher].sort().join('|');
          if (!processedPairs.has(pairKey)) {
            mutualExclusionGroups.push([teacher.name, excludedTeacher]);
            processedPairs.add(pairKey);
          }
        });
      }
    });

    // 상호 배제 색상 배열 (여러 커플을 구분하기 위해)
    const exclusionColors = [
      'bg-red-100 border-red-300',
      'bg-orange-100 border-orange-300',
      'bg-yellow-100 border-yellow-300',
      'bg-pink-100 border-pink-300',
      'bg-indigo-100 border-indigo-300',
      'bg-teal-100 border-teal-300',
      'bg-amber-100 border-amber-300',
      'bg-rose-100 border-rose-300'
    ];

    // 특정 시간대에 상호 배제 교사들이 동시에 수업하는지 확인하고 그룹 인덱스 반환
    const getMutualExclusionGroupAtTime = (day, period) => {
      const teachersAtThisTime = [];
      
      // 해당 시간대에 수업하는 모든 교사 수집
      Object.keys(data.schedule).forEach(className => {
        const slotIndex = period - 1;
        const slot = data.schedule[className]?.[day]?.[slotIndex];
        if (slot && typeof slot === 'object' && slot.teachers && Array.isArray(slot.teachers)) {
          slot.teachers.forEach(teacherName => {
            if (!teachersAtThisTime.includes(teacherName)) {
              teachersAtThisTime.push(teacherName);
            }
          });
        }
      });

      // 상호 배제 그룹별로 확인 (실제 상호배제 관계가 설정된 교사들만)
      for (let groupIndex = 0; groupIndex < mutualExclusionGroups.length; groupIndex++) {
        const [teacher1, teacher2] = mutualExclusionGroups[groupIndex];
        
        // 두 교사 모두 상호배제 관계가 설정되어 있는지 확인
        const teacher1Data = data.teachers?.find(t => t.name === teacher1);
        const teacher2Data = data.teachers?.find(t => t.name === teacher2);
        
        const teacher1HasExclusion = teacher1Data?.mutual_exclusions?.includes(teacher2);
        const teacher2HasExclusion = teacher2Data?.mutual_exclusions?.includes(teacher1);
        
        // 양방향 상호배제 관계가 설정되어 있고, 동시에 수업하는 경우에만 색상 표시
        if (teacher1HasExclusion && teacher2HasExclusion && 
            teachersAtThisTime.includes(teacher1) && teachersAtThisTime.includes(teacher2)) {
          return groupIndex; // 상호 배제 위반 발견
        }
      }
      return -1; // 위반 없음
    };

    return (
      <div className="overflow-x-auto">
        {/* 수업 타입별 색상 범례 */}
        <div className="mb-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 border-2 border-blue-300 rounded"></div>
            <span>공동수업</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border-2 border-green-300 rounded"></div>
            <span>고정수업</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-100 border-2 border-purple-300 rounded"></div>
            <span>블록제 수업</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded"></div>
            <span>일반 수업</span>
          </div>
          {mutualExclusionGroups.map((group, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className={`w-4 h-4 border-2 rounded ${exclusionColors[index % exclusionColors.length]}`}></div>
              <span>상호배제: {group[0]} ↔ {group[1]}</span>
            </div>
          ))}
        </div>

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
                    
                    // 수업 타입에 따른 배경색 결정
                    let bgColor = 'bg-gray-50'; // 기본색
                    let borderColor = 'border-gray-300';
                    
                    if (convertedSlot && typeof convertedSlot === 'object' && convertedSlot.subject) {
                      if (convertedSlot.isCoTeaching) {
                        bgColor = 'bg-blue-100';
                        borderColor = 'border-blue-300';
                      } else if (convertedSlot.isFixed) {
                        bgColor = 'bg-green-100';
                        borderColor = 'border-green-300';
                      } else if (convertedSlot.isBlockPeriod) {
                        bgColor = 'bg-purple-100';
                        borderColor = 'border-purple-300';
                      }
                    }

                    // 상호 배제 위반 확인 및 색상 적용
                    const exclusionGroupIndex = getMutualExclusionGroupAtTime(day, period);
                    if (exclusionGroupIndex >= 0) {
                      const [bgClass, borderClass] = exclusionColors[exclusionGroupIndex % exclusionColors.length].split(' ');
                      bgColor = bgClass;
                      borderColor = borderClass;
                    }
                    
                    return (
                      <td key={day} className={`border ${borderColor} ${bgColor} px-4 py-2 text-center`}>
                        {convertedSlot && typeof convertedSlot === 'object' && convertedSlot.subject ? (
                          <div>
                            <div className="font-medium text-sm">{String(convertedSlot.subject)}</div>
                            <div className="text-xs text-gray-600">
                              {convertedSlot.teachers && Array.isArray(convertedSlot.teachers) ? convertedSlot.teachers.join(', ') : ''}
                            </div>
                            {convertedSlot.isCoTeaching && (
                              <div className="text-xs text-blue-600 font-medium">공동수업</div>
                            )}
                            {convertedSlot.isFixed && (
                              <div className="text-xs text-green-600 font-medium">고정</div>
                            )}
                            {convertedSlot.isBlockPeriod && (
                              <div className="text-xs text-purple-600 font-medium">블록제</div>
                            )}
                            {exclusionGroupIndex >= 0 && (
                              <div className="text-xs text-red-600 font-medium">상호배제</div>
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

  // 교사별 시간표 렌더링 (전체 교사 한 페이지)
  const renderTeacherTimetable = () => {
    const allTeachersSchedule = getAllTeachersSchedule(data);
    const periodsPerDay = data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };
    const maxPeriods = Math.max(...Object.values(periodsPerDay));
    const teacherList = getTeacherList(data);

    if (teacherList.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">등록된 교사가 없습니다.</p>
        </div>
      );
    }

    // 교사 상호 배제 정보 수집 및 커플 그룹화
    const teacherMutualExclusions = {};
    const mutualExclusionGroups = [];
    const processedPairs = new Set();

    data.teachers?.forEach(teacher => {
      if (teacher.mutual_exclusions && teacher.mutual_exclusions.length > 0) {
        teacherMutualExclusions[teacher.name] = teacher.mutual_exclusions;
        
        // 상호 배제 커플 그룹화
        teacher.mutual_exclusions.forEach(excludedTeacher => {
          const pairKey = [teacher.name, excludedTeacher].sort().join('|');
          if (!processedPairs.has(pairKey)) {
            mutualExclusionGroups.push([teacher.name, excludedTeacher]);
            processedPairs.add(pairKey);
          }
        });
      }
    });

    // 상호 배제 색상 배열 (여러 커플을 구분하기 위해)
    const exclusionColors = [
      'bg-red-100 border-red-300',
      'bg-orange-100 border-orange-300',
      'bg-yellow-100 border-yellow-300',
      'bg-pink-100 border-pink-300',
      'bg-indigo-100 border-indigo-300',
      'bg-teal-100 border-teal-300',
      'bg-amber-100 border-amber-300',
      'bg-rose-100 border-rose-300'
    ];

    // 특정 시간대에 상호 배제 교사들이 동시에 수업하는지 확인하고 그룹 인덱스 반환
    const getMutualExclusionGroupAtTime = (day, period) => {
      const teachersAtThisTime = [];
      
      // 해당 시간대에 수업하는 모든 교사 수집
      teacherList.forEach(teacherName => {
        const slot = allTeachersSchedule[teacherName]?.[day]?.[period];
        if (slot) {
          teachersAtThisTime.push(teacherName);
        }
      });

      // 상호 배제 그룹별로 확인 (실제 상호배제 관계가 설정된 교사들만)
      for (let groupIndex = 0; groupIndex < mutualExclusionGroups.length; groupIndex++) {
        const [teacher1, teacher2] = mutualExclusionGroups[groupIndex];
        
        // 두 교사 모두 상호배제 관계가 설정되어 있는지 확인
        const teacher1Data = data.teachers?.find(t => t.name === teacher1);
        const teacher2Data = data.teachers?.find(t => t.name === teacher2);
        
        const teacher1HasExclusion = teacher1Data?.mutual_exclusions?.includes(teacher2);
        const teacher2HasExclusion = teacher2Data?.mutual_exclusions?.includes(teacher1);
        
        // 양방향 상호배제 관계가 설정되어 있고, 동시에 수업하는 경우에만 색상 표시
        if (teacher1HasExclusion && teacher2HasExclusion && 
            teachersAtThisTime.includes(teacher1) && teachersAtThisTime.includes(teacher2)) {
          return groupIndex; // 상호 배제 위반 발견
        }
      }
      return -1; // 위반 없음
    };

    // 특정 교사가 상호 배제 위반에 포함되는지 확인
    const isTeacherInMutualExclusionViolation = (teacherName, day, period) => {
      const exclusionGroupIndex = getMutualExclusionGroupAtTime(day, period);
      if (exclusionGroupIndex >= 0) {
        const [teacher1, teacher2] = mutualExclusionGroups[exclusionGroupIndex];
        return teacherName === teacher1 || teacherName === teacher2;
      }
      return false;
    };

    return (
      <div className="overflow-x-auto">
        {/* 수업 타입별 색상 범례 */}
        <div className="mb-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 border-2 border-blue-300 rounded"></div>
            <span>공동수업</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border-2 border-green-300 rounded"></div>
            <span>고정수업</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-100 border-2 border-purple-300 rounded"></div>
            <span>블록제 수업</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded"></div>
            <span>일반 수업</span>
          </div>
          {mutualExclusionGroups.map((group, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className={`w-4 h-4 border-2 rounded ${exclusionColors[index % exclusionColors.length]}`}></div>
              <span>상호배제: {group[0]} ↔ {group[1]}</span>
            </div>
          ))}
        </div>

        <table className="min-w-full bg-white border border-gray-300 text-sm">
          <thead>
            <tr>
              <th className="border border-gray-300 bg-gray-100 px-4 py-3 font-semibold sticky left-0 z-10 bg-gray-100 min-w-[150px]">
                교사명
              </th>
              {days.map(day => (
                <th key={day} colSpan={periodsPerDay[day] || 7} className="border border-gray-300 bg-gray-100 px-2 py-3 font-semibold text-center">
                  {day}요일
                </th>
              ))}
            </tr>
            <tr>
              <th className="border border-gray-300 bg-gray-100 px-4 py-2 font-semibold sticky left-0 z-10 bg-gray-100 min-w-[150px]">
                교시
              </th>
              {days.map(day => {
                const dayPeriods = periodsPerDay[day] || 7;
                return Array.from({ length: dayPeriods }, (_, periodIndex) => (
                  <th key={`${day}-${periodIndex + 1}`} className="border border-gray-300 bg-gray-100 px-2 py-2 font-semibold text-center min-w-[100px]">
                    {periodIndex + 1}교시
                  </th>
                ));
              })}
            </tr>
          </thead>
          <tbody>
            {teacherList.map((teacherName, teacherIndex) => (
              <tr key={teacherName} className="hover:bg-gray-50">
                <td className="border border-gray-300 bg-gray-50 px-4 py-3 font-medium sticky left-0 z-10 bg-gray-50 min-w-[150px]">
                  {teacherName}({String(teacherIndex + 1).padStart(2, '0')})
                </td>
                {days.map(day => {
                  const dayPeriods = periodsPerDay[day] || 7;
                  return Array.from({ length: dayPeriods }, (_, periodIndex) => {
                    const period = periodIndex + 1;
                    const slot = allTeachersSchedule[teacherName]?.[day]?.[period];
                    
                    // 수업 타입에 따른 배경색 결정
                    let bgColor = 'bg-gray-50'; // 기본색
                    let borderColor = 'border-gray-300';
                    
                    if (slot) {
                      if (slot.isCoTeaching) {
                        bgColor = 'bg-blue-100';
                        borderColor = 'border-blue-300';
                      } else if (slot.isFixed) {
                        bgColor = 'bg-green-100';
                        borderColor = 'border-green-300';
                      } else if (slot.isBlockPeriod) {
                        bgColor = 'bg-purple-100';
                        borderColor = 'border-purple-300';
                      }
                    }

                    // 상호 배제 위반 확인 및 색상 적용
                    const exclusionGroupIndex = getMutualExclusionGroupAtTime(day, period);
                    const isThisTeacherInViolation = isTeacherInMutualExclusionViolation(teacherName, day, period);
                    if (exclusionGroupIndex >= 0 && isThisTeacherInViolation) {
                      const [bgClass, borderClass] = exclusionColors[exclusionGroupIndex % exclusionColors.length].split(' ');
                      bgColor = bgClass;
                      borderColor = borderClass;
                    }
                    
                    return (
                      <td key={`${day}-${period}`} className={`border ${borderColor} ${bgColor} px-2 py-3 text-center min-h-[80px] align-top`}>
                        {slot ? (
                          <div className="space-y-1">
                            <div className="font-medium text-gray-800 text-sm leading-tight">
                              {slot.className.replace('학년 ', '').replace('반', '').replace(' ', '')} {slot.subject}
                            </div>
                            {slot.isCoTeaching && (
                              <div className="text-xs text-blue-600 font-medium">
                                공동수업
                              </div>
                            )}
                            {slot.isFixed && (
                              <div className="text-xs text-green-600 font-medium">
                                고정수업
                              </div>
                            )}
                            {slot.isBlockPeriod && (
                              <div className="text-xs text-purple-600 font-medium">
                                블록제
                              </div>
                            )}
                            {exclusionGroupIndex >= 0 && isThisTeacherInViolation && (
                              <div className="text-xs text-red-600 font-medium">
                                상호배제
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    );
                  });
                })}
              </tr>
            ))}
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
        {Object.entries(stats).map(([subjectName, subjectStats]) => (
          <div key={subjectName} className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-lg mb-3">{subjectName}</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">목표 시수</span>
                <span className="font-medium">{subjectStats.target || 0}시간</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">실제 시수</span>
                <span className="font-medium">{subjectStats.actual || 0}시간</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">부족 시수</span>
                <span className="font-medium">{subjectStats.shortage || 0}시간</span>
              </div>
              {subjectStats.classBreakdown && typeof subjectStats.classBreakdown === 'object' && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="text-xs text-gray-500 mb-1">학급별 배치:</div>
                  {Object.entries(subjectStats.classBreakdown).map(([className, hours]) => (
                    <div key={className} className="flex justify-between text-xs">
                      <span className="text-gray-600">{className}</span>
                      <span className="font-medium">{hours}시간</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto p-6">
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
          {viewMode === 'class' && (
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
          )}
        </div>

        {/* 시간표 표시 */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {viewMode === 'class' ? `${selectedClass} 시간표` : '전체 교사 시간표'}
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