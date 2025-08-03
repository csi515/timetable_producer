import React, { useState } from 'react';
import * as XLSX from 'xlsx';

function ReviewAndExport({ data, updateData, prevStep }) {
  const [viewMode, setViewMode] = useState('class'); // 'class' or 'teacher'
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');

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

  // 과목별 현재 시수 계산 (헬퍼 함수)
  const getCurrentSubjectHours = (schedule, className, subjectName) => {
    let hours = 0;
    if (!schedule || !schedule[className]) return hours;
    
    days.forEach(day => {
      if (schedule[className][day]) {
        schedule[className][day].forEach(slot => {
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
    for (let grade = 1; grade <= data.base.grades; grade++) {
      const classesInGrade = data.base.classes_per_grade[grade - 1] || 0;
      for (let classNum = 1; classNum <= classesInGrade; classNum++) {
        classes.push(`${grade}학년 ${classNum}반`);
      }
    }
    return classes;
  };

  // 교사별 시간표 생성 (개선된 버전)
  const getTeacherSchedule = (teacherName) => {
    const teacher = data.teachers.find(t => t.name === teacherName);
    if (!teacher) return {};

    const teacherSchedule = {};
    days.forEach(day => {
      const periodsInDay = data.base?.periods_per_day?.[day] || 7;
      teacherSchedule[day] = Array(periodsInDay).fill('');
    });

    // 모든 학급의 시간표를 확인하여 해당 교사의 수업 찾기
    Object.entries(data.schedule || {}).forEach(([className, classSchedule]) => {
      days.forEach(day => {
        if (classSchedule && classSchedule[day]) {
          classSchedule[day].forEach((scheduleItem, periodIndex) => {
            if (scheduleItem) {
              let subject = '';
              let isCoTeaching = false;
              let teachers = [];
              
              // 시간표 아이템이 객체인 경우 (새로운 형식)
              if (typeof scheduleItem === 'object' && scheduleItem.subject) {
                subject = scheduleItem.subject;
                teachers = scheduleItem.teachers || [];
                isCoTeaching = scheduleItem.isCoTeaching || false;
              } 
              // 시간표 아이템이 문자열인 경우 (기존 형식)
              else if (typeof scheduleItem === 'string' && scheduleItem.trim() !== '') {
                subject = scheduleItem;
                // 해당 과목을 담당할 수 있는 교사들 찾기
                const availableTeachers = data.teachers.filter(t => 
                  t.subjects && t.subjects.includes(subject)
                );
                teachers = availableTeachers.map(t => t.name);
                isCoTeaching = false;
              }
              
              // 교사가 해당 수업에 참여하는지 확인
              const isTeacherInvolved = teachers.includes(teacherName);
              
              // 교사가 해당 과목을 담당하거나 공동수업에 참여하는 경우
              if (subject && isTeacherInvolved) {
                const currentEntry = teacherSchedule[day][periodIndex];
                const coTeachingSuffix = isCoTeaching ? ' (공동)' : '';
                const newEntry = `${subject}${coTeachingSuffix} (${className})`;
                
                if (currentEntry && currentEntry.trim() !== '') {
                  // 병행 수업인 경우
                  teacherSchedule[day][periodIndex] = `${currentEntry}, ${newEntry}`;
                } else {
                  teacherSchedule[day][periodIndex] = newEntry;
                }
              }
            }
          });
        }
      });
    });

    return teacherSchedule;
  };

  // 수업 시수 통계 계산
  const getSubjectHoursStats = () => {
    const stats = {};
    const classList = getClassList();

    // 데이터 유효성 검사
    if (!data.subjects || !data.schedule) {
      return stats;
    }

    // 각 과목별 통계 초기화
    data.subjects.forEach(subject => {
      if (subject && subject.name) {
        stats[subject.name] = {
          expected: subject.weekly_hours || 0,
          actual: {},
          total: 0,
          shortfall: 0
        };
        
        classList.forEach(className => {
          stats[subject.name].actual[className] = 0;
        });
      }
    });

    // 실제 배정된 시수 계산
    Object.entries(data.schedule).forEach(([className, classSchedule]) => {
      if (classSchedule) {
        days.forEach(day => {
          if (classSchedule[day]) {
            classSchedule[day].forEach(scheduleItem => {
              if (scheduleItem) {
                let subject = '';
                
                // 공동 수업인 경우
                if (typeof scheduleItem === 'object' && scheduleItem.isCoTeaching) {
                  subject = scheduleItem.subject;
                } else {
                  subject = scheduleItem;
                }
                
                if (subject && stats[subject]) {
                  stats[subject].actual[className]++;
                  stats[subject].total++;
                }
              }
            });
          }
        });
      }
    });

    // 부족분 계산
    Object.keys(stats).forEach(subjectName => {
      const subject = stats[subjectName];
      const expectedTotal = (subject.expected || 0) * classList.length;
      subject.shortfall = Math.max(0, expectedTotal - (subject.total || 0));
    });

    return stats;
  };

  // JSON 내보내기
  const exportToJSON = () => {
    const exportData = {
      ...data,
      exported_at: new Date().toISOString(),
      version: '1.0'
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `timetable_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 엑셀 내보내기
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const classList = getClassList();

    // 학급별 시간표 시트
    classList.forEach(className => {
      const classSchedule = data.schedule[className];
      if (classSchedule) {
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
                } else {
                  // 단일 교사 수업인 경우
                  const teachers = convertedItem.teachers || [];
                  if (teachers.length > 0) {
                    displayText = `${convertedItem.subject} (${teachers[0]})`;
                  } else {
                    displayText = convertedItem.subject;
                  }
                }
                
                // 고정 수업 표시
                if (convertedItem.isFixed) {
                  displayText += ' (고정)';
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
      }
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
    <div className="card">
      <h2>📋 검토 및 내보내기</h2>
      
      {/* 전체 통계 */}
      <div className="card" style={{ backgroundColor: '#f8f9fa', marginBottom: '30px' }}>
        <h3>📊 전체 통계</h3>
        <div className="grid grid-4" style={{ marginTop: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <h4 style={{ color: '#667eea', fontSize: '2rem' }}>{classList.length}</h4>
            <p>총 학급 수</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <h4 style={{ color: '#28a745', fontSize: '2rem' }}>{data.subjects.length}</h4>
            <p>총 과목 수</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <h4 style={{ color: '#fd7e14', fontSize: '2rem' }}>{data.teachers.length}</h4>
            <p>총 교사 수</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <h4 style={{ color: '#dc3545', fontSize: '2rem' }}>
              {Object.values(stats || {}).reduce((sum, stat) => sum + (stat.shortfall || 0), 0)}
            </h4>
            <p>부족 시수</p>
          </div>
        </div>
      </div>

      {/* 보기 모드 선택 */}
      <div className="card" style={{ marginBottom: '30px' }}>
        <h3>👀 시간표 보기</h3>
        <div style={{ marginTop: '20px' }}>
          <div className="form-group">
            <label>보기 모드</label>
            <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="radio"
                  name="viewMode"
                  value="class"
                  checked={viewMode === 'class'}
                  onChange={(e) => setViewMode(e.target.value)}
                  style={{ marginRight: '8px' }}
                />
                학급별 보기
              </label>
              <label style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="radio"
                  name="viewMode"
                  value="teacher"
                  checked={viewMode === 'teacher'}
                  onChange={(e) => setViewMode(e.target.value)}
                  style={{ marginRight: '8px' }}
                />
                교사별 보기
              </label>
            </div>
          </div>

          {viewMode === 'class' && (
            <div className="form-group">
              <label>학급 선택</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                {classList.map(className => (
                  <option key={className} value={className}>{className}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 시간표 표시 */}
        <div style={{ marginTop: '30px' }}>
          {viewMode === 'class' && selectedClassSchedule ? (
            <div>
              <h4>{selectedClass} 시간표</h4>
              <div style={{ overflowX: 'auto', marginTop: '15px' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>교시</th>
                      {days.map(day => (
                        <th key={day}>{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: Math.max(...Object.values(data.base.periods_per_day)) }, (_, periodIndex) => {
                      const period = periodIndex + 1;
                      return (
                        <tr key={period}>
                          <td><strong>{period}교시</strong></td>
                          {days.map(day => {
                            const scheduleItem = selectedClassSchedule[day]?.[period - 1] || '';
                            const isValidPeriod = period <= data.base.periods_per_day[day];
                            
                            // 데이터 변환 및 표시 형식 결정
                            let displayText = '';
                            let titleText = '';
                            let bgColor = '#fff';
                            
                            if (isValidPeriod && scheduleItem) {
                              // 데이터 변환
                              const convertedItem = convertScheduleItem(scheduleItem, selectedClass, day, period);
                              
                              if (convertedItem) {
                                if (convertedItem.isCoTeaching) {
                                  // 공동수업인 경우 모든 교사 표시
                                  const teachers = convertedItem.teachers || [];
                                  if (teachers.length > 1) {
                                    displayText = `${convertedItem.subject} (${teachers.join(', ')})`;
                                  } else {
                                    displayText = `${convertedItem.subject} (${teachers[0]})`;
                                  }
                                  titleText = `${convertedItem.subject} - ${teachers.join(', ')}`;
                                  bgColor = convertedItem.isFixed ? '#e8f5ff' : '#e8f5ff'; // 공동 수업은 파란색 배경
                                } else {
                                  // 단일 교사 수업인 경우
                                  const teachers = convertedItem.teachers || [];
                                  if (teachers.length > 0) {
                                    displayText = `${convertedItem.subject} (${teachers[0]})`;
                                    titleText = `${convertedItem.subject} - ${teachers[0]}`;
                                  } else {
                                    displayText = convertedItem.subject;
                                    titleText = convertedItem.subject;
                                  }
                                  bgColor = convertedItem.isFixed ? '#fff3cd' : '#e8f5e8'; // 고정 수업은 노란색 배경
                                }
                                
                                // 고정 수업 표시
                                if (convertedItem.isFixed) {
                                  displayText += ' (고정)';
                                }
                              } else {
                                displayText = scheduleItem;
                                titleText = scheduleItem;
                                bgColor = '#e8f5e8';
                              }
                            }
                            
                            return (
                              <td key={day} className="text-ellipsis" style={{ 
                                backgroundColor: !isValidPeriod ? '#f8f9fa' : bgColor,
                                color: !isValidPeriod ? '#ccc' : '#333',
                                minWidth: '100px',
                                maxWidth: '120px'
                              }} title={isValidPeriod ? (titleText || '-') : ''}>
                                {isValidPeriod ? (displayText || '-') : ''}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : viewMode === 'teacher' ? (
            <div>
              <h4>교사별 시간표</h4>
              <div style={{ 
                marginBottom: '10px', 
                padding: '8px', 
                backgroundColor: '#f8f9fa', 
                borderRadius: '4px',
                fontSize: '11px'
              }}>
                <strong>표시 형식:</strong> 학급코드 과목명 (예: 101 국어) | 
                <span style={{ color: '#1976d2' }}> * 공동수업</span> | 
                <span style={{ color: '#666' }}> 교사명(주간시수/실제시수)</span>
              </div>
              <div style={{ overflowX: 'auto', marginTop: '15px' }}>
                <table className="table" style={{ 
                  fontSize: '12px', 
                  borderCollapse: 'collapse',
                  width: '100%',
                  tableLayout: 'fixed'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ 
                        border: '1px solid #dee2e6', 
                        padding: '4px', 
                        textAlign: 'center',
                        width: '120px',
                        minWidth: '120px',
                        position: 'sticky',
                        left: 0,
                        backgroundColor: '#f8f9fa',
                        zIndex: 10,
                        fontSize: '11px'
                      }}>
                        교사
                      </th>
                      {days.map(day => (
                        <th key={day} colSpan={data.base.periods_per_day[day]} style={{ 
                          border: '1px solid #dee2e6', 
                          padding: '4px', 
                          textAlign: 'center',
                          backgroundColor: '#f8f9fa',
                          fontSize: '11px'
                        }}>
                          {day}
                        </th>
                      ))}
                    </tr>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ 
                        border: '1px solid #dee2e6', 
                        padding: '2px', 
                        textAlign: 'center',
                        position: 'sticky',
                        left: 0,
                        backgroundColor: '#f8f9fa',
                        zIndex: 10,
                        fontSize: '10px'
                      }}>
                        교시
                      </th>
                      {days.map(day => {
                        const periods = data.base.periods_per_day[day];
                        return Array.from({ length: periods }, (_, i) => (
                          <th key={`${day}-${i+1}`} style={{ 
                            border: '1px solid #dee2e6', 
                            padding: '2px', 
                            textAlign: 'center',
                            width: '70px',
                            minWidth: '70px',
                            fontSize: '10px',
                            backgroundColor: '#f8f9fa'
                          }}>
                            {i + 1}
                          </th>
                        ));
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {data.teachers.map(teacher => {
                      const teacherSchedule = getTeacherSchedule(teacher.name);
                      const teacherHours = teacher.weeklyHours || teacher.maxHours || 0;
                      
                      // 교사별 실제 배정된 시수 계산 (개선된 버전)
                      let actualHours = 0;
                      days.forEach(day => {
                        if (teacherSchedule[day]) {
                          teacherSchedule[day].forEach(entry => {
                            if (entry && entry.trim() !== '') {
                              // 병행 수업인 경우 여러 수업이 있을 수 있음
                              const classes = entry.split(', ');
                              actualHours += classes.length;
                            }
                          });
                        }
                      });
                      
                      return (
                        <tr key={teacher.name}>
                          <td style={{ 
                            border: '1px solid #dee2e6', 
                            padding: '4px', 
                            textAlign: 'center',
                            position: 'sticky',
                            left: 0,
                            backgroundColor: '#fff',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}>
                            {teacher.name}({teacherHours.toString().padStart(2, '0')}/{actualHours.toString().padStart(2, '0')})
                          </td>
                          {days.map(day => {
                            const periods = data.base?.periods_per_day?.[day] || 7;
                            return Array.from({ length: periods }, (_, periodIndex) => {
                              const entry = teacherSchedule[day] ? teacherSchedule[day][periodIndex] : '';
                              let displayText = '';
                              let bgColor = '#fff';
                              
                              if (entry && entry.trim() !== '') {
                                // 병행 수업 처리
                                const classes = entry.split(', ');
                                displayText = classes.map(classInfo => {
                                  const match = classInfo.match(/(.+) \((.+)\)/);
                                  if (match) {
                                    const subject = match[1];
                                    const className = match[2];
                                    const classMatch = className.match(/(\d+)학년\s*(\d+)반/);
                                    
                                    if (classMatch) {
                                      const grade = classMatch[1];
                                      const classNum = classMatch[2];
                                      const classCode = `${grade}${classNum.padStart(2, '0')}`;
                                      
                                      let subjectDisplay = subject;
                                      if (subject === '기술가정') subjectDisplay = '기가';
                                      else if (subject === '진로와직업') subjectDisplay = '진직';
                                      else if (subject === '정보') subjectDisplay = '소프트';
                                      
                                      const isCoTeaching = subject.includes('(공동)');
                                      if (isCoTeaching) {
                                        return `${classCode} ${subjectDisplay.replace(' (공동)', '')}*`;
                                      } else {
                                        return `${classCode} ${subjectDisplay}`;
                                      }
                                    }
                                  }
                                  return classInfo;
                                }).join(', ');
                                
                                // 공동수업인 경우 배경색 변경
                                if (entry.includes('(공동)')) {
                                  bgColor = '#e3f2fd';
                                }
                              }
                              
                              return (
                                <td key={`${day}-${periodIndex}`} style={{ 
                                  border: '1px solid #dee2e6', 
                                  padding: '2px', 
                                  textAlign: 'center',
                                  fontSize: '10px',
                                  backgroundColor: bgColor,
                                  wordBreak: 'break-all',
                                  verticalAlign: 'middle'
                                }}>
                                  {displayText || '-'}
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
            </div>
          ) : null}
        </div>
      </div>

      {/* 수업 시수 통계 */}
      <div className="card" style={{ marginBottom: '30px' }}>
        <h3>📈 수업 시수 통계</h3>
        <div style={{ marginTop: '20px', overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>과목</th>
                <th>예정 시수</th>
                <th>총 배정 시수</th>
                <th>학급당 평균</th>
                <th>부족분</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
                              {Object.entries(stats || {}).map(([subjectName, stat]) => {
                const avgPerClass = Math.round((stat.total / classList.length) * 10) / 10;
                const isComplete = stat.shortfall === 0;
                
                return (
                  <tr key={subjectName}>
                    <td className="text-ellipsis" style={{ maxWidth: '100px' }} title={subjectName}>
                      <strong>{subjectName}</strong>
                    </td>
                    <td>{stat.expected}</td>
                    <td>{stat.total}</td>
                    <td>{avgPerClass}</td>
                    <td style={{ color: stat.shortfall > 0 ? '#dc3545' : '#28a745' }}>
                      {stat.shortfall}
                    </td>
                    <td style={{ minWidth: '80px' }}>
                      <span style={{ 
                        color: isComplete ? '#28a745' : '#dc3545',
                        fontWeight: 'bold'
                      }}>
                        {isComplete ? '✓ 완료' : '⚠ 부족'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 학급별 상세 시수 */}
      <div className="card" style={{ marginBottom: '30px' }}>
        <h3>📚 학급별 과목 시수</h3>
        <div style={{ marginTop: '20px', overflowX: 'auto' }}>
          <table className="table" style={{ fontSize: '14px' }}>
            <thead>
              <tr>
                <th>학급</th>
                {data.subjects.map(subject => (
                  <th key={subject.name} className="text-ellipsis" style={{ maxWidth: '80px' }} title={subject.name}>
                    {subject.name}
                  </th>
                ))}
                <th>총계</th>
              </tr>
            </thead>
            <tbody>
              {classList.map(className => {
                let totalHours = 0;
                
                return (
                  <tr key={className}>
                    <td className="text-ellipsis" style={{ maxWidth: '100px' }} title={className}>
                      <strong>{className}</strong>
                    </td>
                    {data.subjects.map(subject => {
                      const hours = (stats || {})[subject.name]?.actual[className] || 0;
                      totalHours += hours;
                      const isCorrect = hours === subject.weekly_hours;
                      
                      return (
                        <td key={subject.name} style={{ 
                          color: isCorrect ? '#28a745' : '#dc3545',
                          fontWeight: isCorrect ? 'normal' : 'bold',
                          minWidth: '60px'
                        }} title={`${subject.name}: ${hours}/${subject.weekly_hours}`}>
                          {hours}/{subject.weekly_hours}
                        </td>
                      );
                    })}
                    <td style={{ minWidth: '60px' }}><strong>{totalHours}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 내보내기 */}
      <div className="card">
        <h3>💾 내보내기</h3>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          생성된 시간표를 다양한 형식으로 내보낼 수 있습니다.
        </p>
        
        <div className="grid grid-2">
          <div className="card" style={{ textAlign: 'center', border: '1px solid #dee2e6' }}>
            <h4 style={{ color: '#667eea' }}>📄 JSON 형식</h4>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              시스템에서 다시 불러올 수 있는 형태로 저장됩니다.
            </p>
            <button 
              className="btn btn-primary"
              onClick={exportToJSON}
              style={{ fontSize: '16px', padding: '12px 30px' }}
            >
              JSON 다운로드
            </button>
          </div>
          
          <div className="card" style={{ textAlign: 'center', border: '1px solid #dee2e6' }}>
            <h4 style={{ color: '#28a745' }}>📊 Excel 형식</h4>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              학급별, 교사별 시간표와 통계가 포함된 엑셀 파일입니다.
            </p>
            <button 
              className="btn btn-success"
              onClick={exportToExcel}
              style={{ fontSize: '16px', padding: '12px 30px' }}
            >
              Excel 다운로드
            </button>
          </div>
        </div>
      </div>

      {/* 네비게이션 */}
      <div className="navigation">
        <button className="btn btn-secondary" onClick={prevStep}>
          ← 이전 단계
        </button>
        <div>
          <button 
            className="btn btn-success"
            onClick={() => alert('시간표 제작이 완료되었습니다!')}
            style={{ fontSize: '16px', padding: '12px 30px' }}
          >
            ✅ 완료
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReviewAndExport; 