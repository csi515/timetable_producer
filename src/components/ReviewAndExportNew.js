import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import TeacherTimetable from './TeacherTimetable';
import ClassTimetable from './ClassTimetable';
import FailureAnalysis from './FailureAnalysis';
import TimetableQualityAnalysis from './TimetableQualityAnalysis';

function ReviewAndExportNew({ data, updateData, prevStep }) {
  const [viewMode, setViewMode] = useState('teacher'); // 'class' or 'teacher'
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [showFailureAnalysis, setShowFailureAnalysis] = useState(false);
  const [showQualityAnalysis, setShowQualityAnalysis] = useState(false);

  const days = ['월', '화', '수', '목', '금'];

  // 기존 문자열 형식의 시간표 데이터를 객체 형식으로 변환하는 함수
  const convertScheduleItem = (scheduleItem, className, day, period) => {
    if (typeof scheduleItem === 'object' && scheduleItem !== null) {
      // 이미 객체 형식인 경우 그대로 반환
      return scheduleItem;
    } else if (typeof scheduleItem === 'string' && scheduleItem.trim() !== '') {
      // 문자열 형식인 경우 객체로 변환
      const teacherName = scheduleItem.trim();
      const teacher = data.teachers.find(t => t.name === teacherName);
      
      if (teacher) {
        // 해당 교사가 가르칠 수 있는 과목들 중에서 선택
        const teacherSubjects = teacher.subjects || [];
        if (teacherSubjects.length > 0) {
          // 가장 적합한 과목 선택 (현재 시간표에서 부족한 과목 우선)
          const currentSubjectHours = {};
          teacherSubjects.forEach(subject => {
            currentSubjectHours[subject] = getCurrentSubjectHours(data.schedule, className, subject);
          });
          
          // 가장 부족한 과목 선택
          const targetSubject = teacherSubjects.reduce((best, current) => {
            const currentHours = currentSubjectHours[current] || 0;
            const bestHours = currentSubjectHours[best] || 0;
            const currentTarget = data.subjects.find(s => s.name === current)?.weekly_hours || 1;
            const bestTarget = data.subjects.find(s => s.name === best)?.weekly_hours || 1;
            
            const currentShortfall = currentTarget - currentHours;
            const bestShortfall = bestTarget - bestHours;
            
            return currentShortfall > bestShortfall ? current : best;
          });
          
          return {
            subject: targetSubject,
            teachers: [teacherName],
            isCoTeaching: false,
            isFixed: false
          };
        }
      }
      
      // 교사 정보를 찾을 수 없는 경우 기본 형식으로 반환
      return {
        subject: teacherName,
        teachers: [teacherName],
        isCoTeaching: false,
        isFixed: false
      };
    }
    
    // 빈 슬롯인 경우 null 반환
    return null;
  };

  // 블록제 교사인지 확인하는 함수
  const isBlockPeriodTeacher = (teacherName) => {
    // 제약조건에서 해당 교사가 블록제로 설정되어 있는지 확인
    const blockPeriodConstraints = data.constraints?.must?.filter(c => c.type === 'block_period_requirement') || [];
    return blockPeriodConstraints.some(c => c.subject === teacherName);
  };

  // 과목별 현재 시수 계산 (헬퍼 함수)
  const getCurrentSubjectHours = (schedule, className, subjectName) => {
    let hours = 0;
    if (!schedule || !schedule[className]) return hours;
    
    days.forEach(day => {
      if (schedule[className][day]) {
        Object.values(schedule[className][day]).forEach(slot => {
          if (slot) {
            if (typeof slot === 'object' && slot.subject) {
              if (slot.subject === subjectName) {
                hours++;
              }
            } else if (typeof slot === 'string' && slot.trim() !== '') {
              if (slot.trim() === subjectName) {
                hours++;
              }
            }
          }
        });
      }
    });
    return hours;
  };

  // 학급 목록 생성
  const getClassList = () => {
    const classes = [];
    if (data.schedule) {
      Object.keys(data.schedule).forEach(className => {
        classes.push(className);
      });
    }
    return classes.sort();
  };

  // 교사별 시간표 생성
  const getTeacherSchedule = (teacherName) => {
    const teacherSchedule = {};
    days.forEach(day => {
      teacherSchedule[day] = [];
    });

    if (data.schedule) {
      Object.entries(data.schedule).forEach(([className, classSchedule]) => {
        days.forEach(day => {
          if (classSchedule[day]) {
            Object.entries(classSchedule[day]).forEach(([periodStr, scheduleItem]) => {
              const periodIndex = parseInt(periodStr);
              if (!teacherSchedule[day][periodIndex]) {
                teacherSchedule[day][periodIndex] = '';
              }

              if (scheduleItem) {
                if (typeof scheduleItem === 'object' && scheduleItem.subject) {
                  // 객체 형식의 데이터
                  const teachers = scheduleItem.teachers || [];
                  if (teachers.includes(teacherName)) {
                    const existingEntry = teacherSchedule[day][periodIndex];
                    const newEntry = `${scheduleItem.subject} (${className})`;
                    
                    if (existingEntry) {
                      teacherSchedule[day][periodIndex] = `${existingEntry}, ${newEntry}`;
                    } else {
                      teacherSchedule[day][periodIndex] = newEntry;
                    }
                  }
                } else if (typeof scheduleItem === 'string' && scheduleItem.trim() !== '') {
                  // 문자열 형식의 기존 데이터
                  if (scheduleItem.trim() === teacherName) {
                    const existingEntry = teacherSchedule[day][periodIndex];
                    const newEntry = `과목명 (${className})`;
                    
                    if (existingEntry) {
                      teacherSchedule[day][periodIndex] = `${existingEntry}, ${newEntry}`;
                    } else {
                      teacherSchedule[day][periodIndex] = newEntry;
                    }
                  }
                }
              }
            });
          }
        });
      });
    }

    return teacherSchedule;
  };

  // 과목별 시수 통계 계산
  const getSubjectHoursStats = () => {
    const stats = {};
    
    data.subjects.forEach(subject => {
      stats[subject.name] = {
        expected: subject.weekly_hours || 0,
        total: 0,
        shortfall: 0
      };
    });

    if (data.schedule) {
      Object.entries(data.schedule).forEach(([className, classSchedule]) => {
        days.forEach(day => {
          if (classSchedule[day]) {
            Object.values(classSchedule[day]).forEach(scheduleItem => {
              if (scheduleItem) {
                if (typeof scheduleItem === 'object' && scheduleItem.subject) {
                  const subjectName = scheduleItem.subject;
                  if (stats[subjectName]) {
                    stats[subjectName].total++;
                  }
                } else if (typeof scheduleItem === 'string' && scheduleItem.trim() !== '') {
                  const subjectName = scheduleItem.trim();
                  if (stats[subjectName]) {
                    stats[subjectName].total++;
                  }
                }
              }
            });
          }
        });
      });
    }

    // 부족분 계산
    Object.values(stats).forEach(stat => {
      stat.shortfall = Math.max(0, stat.expected - stat.total);
    });

    return stats;
  };

  // JSON 내보내기
  const exportToJSON = () => {
    const exportData = {
      schedule: data.schedule,
      teachers: data.teachers,
      subjects: data.subjects,
      base: data.base,
      constraints: data.constraints,
      exportDate: new Date().toISOString()
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timetable_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Excel 내보내기
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // 학급별 시간표 시트
    const classList = getClassList();
    classList.forEach(className => {
      const classSchedule = data.schedule[className];
      const ws_data = [['교시', ...days]];
      
      const maxPeriods = Math.max(...Object.values(data.base.periods_per_day));
      for (let period = 1; period <= maxPeriods; period++) {
        const row = [`${period}교시`];
        days.forEach(day => {
          const scheduleItem = classSchedule[day]?.[period - 1] || '';
          let displayText = '';
          
          if (period <= data.base.periods_per_day[day] && scheduleItem) {
            // 데이터 변환
            const convertedItem = convertScheduleItem(scheduleItem, className, day, period);
            
            if (convertedItem) {
              if (convertedItem.isCoTeaching) {
                // 공동수업인 경우 모든 교사 표시
                const teachers = convertedItem.teachers || [];
                if (teachers.length > 1) {
                  displayText = `${convertedItem.subject} (${teachers.join(', ')})`;
                } else {
                  displayText = `${convertedItem.subject} (${teachers[0]})`;
                }
                displayText += ' (공동)';
              } else {
                // 단일 교사 수업인 경우
                const teachers = convertedItem.teachers || [];
                if (teachers.length > 0) {
                  displayText = `${convertedItem.subject} (${teachers[0]})`;
                } else {
                  displayText = convertedItem.subject;
                }
                
                // 고정 수업 표시
                if (convertedItem.isFixed) {
                  displayText += ' (고정)';
                }
              }
            } else {
              displayText = scheduleItem;
            }
          }
          
          row.push(displayText);
        });
        ws_data.push(row);
      }
      
      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      XLSX.utils.book_append_sheet(wb, ws, className);
    });

    // 교사별 시간표 시트
    data.teachers.forEach(teacher => {
      const teacherSchedule = getTeacherSchedule(teacher.name);
      const ws_data = [['교시', ...days]];
      
      const maxPeriods = Math.max(...Object.values(data.base.periods_per_day));
      for (let period = 1; period <= maxPeriods; period++) {
        const row = [`${period}교시`];
        days.forEach(day => {
          const entry = teacherSchedule[day]?.[period - 1] || '';
          row.push(period <= data.base.periods_per_day[day] ? entry : '');
        });
        ws_data.push(row);
      }
      
      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      XLSX.utils.book_append_sheet(wb, ws, `교사_${teacher.name}`);
    });

    // 수업 시수 통계 시트
    const stats = getSubjectHoursStats();
    const stats_data = [['과목', '예정 시수', '실제 배정', '부족분']];
    Object.entries(stats).forEach(([subjectName, stat]) => {
      stats_data.push([subjectName, stat.expected, stat.total, stat.shortfall]);
    });
    const stats_ws = XLSX.utils.aoa_to_sheet(stats_data);
    XLSX.utils.book_append_sheet(wb, stats_ws, '수업시수통계');

    XLSX.writeFile(wb, `timetable_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const classList = getClassList();
  const stats = getSubjectHoursStats();
  const selectedClassSchedule = selectedClass ? data.schedule[selectedClass] : null;
  const selectedTeacherSchedule = selectedTeacher ? getTeacherSchedule(selectedTeacher) : null;

  // 초기 선택값 설정
  if (!selectedClass && classList.length > 0) {
    setSelectedClass(classList[0]);
  }
  if (!selectedTeacher && data.teachers.length > 0) {
    setSelectedTeacher(data.teachers[0].name);
  }

  return (
    <div className="min-w-[1280px] w-full">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">📋 검토 및 내보내기</h2>
        
        {/* 전체 통계 */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">📊 전체 통계</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{classList.length}</div>
              <div className="text-sm text-gray-600">총 학급 수</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{data.subjects.length}</div>
              <div className="text-sm text-gray-600">총 과목 수</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">{data.teachers.length}</div>
              <div className="text-sm text-gray-600">총 교사 수</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">
                {Object.values(stats || {}).reduce((sum, stat) => sum + (stat.shortfall || 0), 0)}
              </div>
              <div className="text-sm text-gray-600">부족 시수</div>
            </div>
          </div>
        </div>

        {/* 보기 모드 선택 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">👀 시간표 보기</h3>
          <div className="flex items-center space-x-6 mb-4">
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="viewMode"
                  value="teacher"
                  checked={viewMode === 'teacher'}
                  onChange={(e) => setViewMode(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm font-medium">교사별 보기</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="viewMode"
                  value="class"
                  checked={viewMode === 'class'}
                  onChange={(e) => setViewMode(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm font-medium">학급별 보기</span>
              </label>
            </div>
          </div>
        </div>

        {/* 시간표 표시 */}
        <div className="mb-6">
          {viewMode === 'class' ? (
            <ClassTimetable data={data} schedule={data.schedule} />
          ) : viewMode === 'teacher' ? (
            <TeacherTimetable data={data} schedule={data.schedule} />
          ) : null}
        </div>

        {/* 실패 분석 섹션 */}
        {data.failureAnalysis && (
          <div className="mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">🔍 실패 분석</h3>
                <button
                  onClick={() => setShowFailureAnalysis(!showFailureAnalysis)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  {showFailureAnalysis ? '숨기기' : '자세히 보기'}
                </button>
              </div>
              
              {showFailureAnalysis ? (
                <FailureAnalysis failureAnalysis={data.failureAnalysis} data={data} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{data.failureAnalysis.totalAttempts}</div>
                    <div className="text-sm text-blue-700">총 시도 횟수</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{data.failureAnalysis.successfulPlacements}</div>
                    <div className="text-sm text-green-700">성공한 배치</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{data.failureAnalysis.failedPlacements}</div>
                    <div className="text-sm text-red-700">실패한 배치</div>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{data.failureAnalysis.backtrackCount}</div>
                    <div className="text-sm text-yellow-700">백트래킹 횟수</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 품질 분석 섹션 */}
        {data.failureAnalysis?.qualityScore && (
          <div className="mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">🎯 품질 분석</h3>
                <button
                  onClick={() => setShowQualityAnalysis(!showQualityAnalysis)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                >
                  {showQualityAnalysis ? '숨기기' : '자세히 보기'}
                </button>
              </div>
              
              {showQualityAnalysis ? (
                <TimetableQualityAnalysis qualityScore={data.failureAnalysis.qualityScore} data={data} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{data.failureAnalysis.qualityScore.totalScore}/100</div>
                    <div className="text-sm text-purple-700">전체 품질 점수</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{data.failureAnalysis.qualityScore.consecutiveTeachingViolations.length}</div>
                    <div className="text-sm text-purple-700">연속 수업 위반</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">-{data.failureAnalysis.qualityScore.consecutiveTeachingScore}점</div>
                    <div className="text-sm text-purple-700">연속 수업 페널티</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 내보내기 버튼 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">📤 내보내기</h3>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={exportToExcel}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              📊 Excel 내보내기
            </button>
            <button
              onClick={exportToJSON}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              📄 JSON 내보내기
            </button>
          </div>
        </div>

        {/* 네비게이션 버튼 */}
        <div className="flex justify-between mt-6">
          <button
            onClick={prevStep}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            이전
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReviewAndExportNew;