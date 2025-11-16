"use client";

import React, { useState, useRef } from 'react';

function FixedClassSettings({ data, updateData, nextStep, prevStep }) {
  const [fixedClasses, setFixedClasses] = useState(data.fixedClasses || []);
  const [newFixedClass, setNewFixedClass] = useState({
    day: '',
    period: '',
    grade: '',
    class: '',
    subject: '',
    teacher: ''
  });
  const fileInputRef = useRef(null);

  const days = ['월', '화', '수', '목', '금'];
  const grades = [1, 2, 3];

  // 학급 수 계산
  const getClassCountForGrade = (grade) => {
    return data.base?.classes_per_grade?.[grade - 1] || 0;
  };

  // 교시 수 계산
  const getMaxPeriods = () => {
    return Math.max(...Object.values(data.base?.periods_per_day || {}));
  };

  // 고정 수업 추가
  const addFixedClass = () => {
    if (!newFixedClass.day || !newFixedClass.period || !newFixedClass.grade || 
        !newFixedClass.class || !newFixedClass.subject || !newFixedClass.teacher) {
      alert('모든 항목을 입력해주세요.');
      return;
    }

    // 중복 체크
    const duplicate = fixedClasses.find(fc => 
      fc.day === newFixedClass.day && 
      fc.period === parseInt(newFixedClass.period) && 
      fc.grade === parseInt(newFixedClass.grade) && 
      fc.class === parseInt(newFixedClass.class)
    );

    if (duplicate) {
      alert('해당 시간에 이미 고정 수업이 있습니다.');
      return;
    }

    const fixedClass = {
      id: Date.now(),
      day: newFixedClass.day,
      period: parseInt(newFixedClass.period),
      grade: parseInt(newFixedClass.grade),
      class: parseInt(newFixedClass.class),
      subject: newFixedClass.subject,
      teacher: newFixedClass.teacher
    };

    const updatedFixedClasses = [...fixedClasses, fixedClass];
    setFixedClasses(updatedFixedClasses);
    updateData('fixedClasses', updatedFixedClasses);
    
    setNewFixedClass({
      day: '',
      period: '',
      grade: '',
      class: '',
      subject: '',
      teacher: ''
    });
  };

  // 고정 수업 삭제
  const removeFixedClass = (id) => {
    const updatedFixedClasses = fixedClasses.filter(fc => fc.id !== id);
    setFixedClasses(updatedFixedClasses);
    updateData('fixedClasses', updatedFixedClasses);
  };

  // JSON 파일 업로드 처리
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonData = JSON.parse(e.target.result);
          
          if (jsonData.fixedClasses && Array.isArray(jsonData.fixedClasses)) {
            // JSON 데이터를 우리 형식으로 변환
            const convertedFixedClasses = jsonData.fixedClasses.map((fc, index) => {
              // classId에서 학년과 반 추출 (예: "1-1" -> 학년: 1, 반: 1)
              const [grade, classNum] = fc.classId.split('-').map(num => parseInt(num));
              
              // 공동 교사 정보 처리
              let coTeachers = [];
              if (fc.coTeachers && Array.isArray(fc.coTeachers)) {
                coTeachers = fc.coTeachers.map(ct => ct.teacherName);
              }
              
              return {
                id: fc.id || `imported_${Date.now()}_${index}`,
                day: fc.day,
                period: fc.period,
                grade: grade,
                class: classNum,
                subject: fc.subject,
                teacher: fc.teacherName,
                coTeachers: coTeachers,
                originalData: fc // 원본 데이터 보존
              };
            });
            
            if (confirm(`${convertedFixedClasses.length}개의 고정 수업을 불러오시겠습니까? 기존 설정이 덮어씌워집니다.`)) {
              setFixedClasses(convertedFixedClasses);
              updateData('fixedClasses', convertedFixedClasses);
              alert('고정 수업 데이터를 성공적으로 불러왔습니다!');
            }
          } else {
            alert('유효하지 않은 고정 수업 JSON 파일입니다. fixedClasses 배열이 필요합니다.');
          }
        } catch (error) {
          console.error('JSON 파싱 오류:', error);
          alert('유효하지 않은 JSON 파일입니다.');
        }
      };
      reader.readAsText(file);
    }
    
    // 파일 입력 초기화
    event.target.value = '';
  };

  // 전체 설정 저장 (JSON 내보내기)
  const handleSaveAllSettings = () => {
    // 현재까지의 모든 데이터 수집
    const allSettings = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: "1.0",
        description: "시간표 생성기 전체 설정 데이터"
      },
      base: data.base,
      subjects: data.subjects,
      teachers: data.teachers,
      constraints: data.constraints,
      fixedClasses: fixedClasses,
      statistics: {
        totalSubjects: data.subjects?.length || 0,
        totalTeachers: data.teachers?.length || 0,
        totalConstraints: (data.constraints?.must?.length || 0) + (data.constraints?.optional?.length || 0),
        totalFixedClasses: fixedClasses.length
      }
    };

    // JSON 파일 생성 및 다운로드
    const jsonString = JSON.stringify(allSettings, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `timetable-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert('전체 설정이 JSON 파일로 저장되었습니다!');
  };

  // 시간 충돌 체크
  const getConflicts = () => {
    const teacherConflicts = [];
    const classConflicts = [];

    fixedClasses.forEach((fc1, index1) => {
      fixedClasses.forEach((fc2, index2) => {
        if (index1 >= index2) return;

        // 같은 시간
        if (fc1.day === fc2.day && fc1.period === fc2.period) {
          // 같은 교사
          if (fc1.teacher === fc2.teacher) {
            teacherConflicts.push({ fc1, fc2, type: 'teacher' });
          }
          // 같은 학급
          if (fc1.grade === fc2.grade && fc1.class === fc2.class) {
            classConflicts.push({ fc1, fc2, type: 'class' });
          }
        }
      });
    });

    return [...teacherConflicts, ...classConflicts];
  };

  const conflicts = getConflicts();

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="flex items-center">
          <span className="mr-3">📌</span>
          고정 수업 설정
        </h2>
        
        <p style={{ color: '#666', marginBottom: '20px' }}>
          시간표 생성 전에 특정 시간에 반드시 들어가야 할 수업을 미리 설정하세요. 
          이 설정은 시간표 생성 시 절대적으로 지켜집니다.
        </p>

        {/* 통계 정보 - 가로 카드 레이아웃 */}
        <div className="flex gap-4 mb-8">
          <div className="card flex-1 bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-blue-600 mb-1">{fixedClasses.length}</h3>
                <p className="text-blue-700 font-medium">총 고정 수업</p>
              </div>
              <div className="text-blue-500 text-3xl">📌</div>
            </div>
          </div>
          
          <div className="card flex-1 bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-green-600 mb-1">
                  {new Set(fixedClasses.map(fc => fc.teacher)).size}
                </h3>
                <p className="text-green-700 font-medium">주교사 수</p>
              </div>
              <div className="text-green-500 text-3xl">👨‍🏫</div>
            </div>
          </div>
          
          <div className="card flex-1 bg-gradient-to-br from-cyan-50 to-cyan-100 border-l-4 border-cyan-500">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-cyan-600 mb-1">
                  {fixedClasses.filter(fc => fc.coTeachers && fc.coTeachers.length > 0).length}
                </h3>
                <p className="text-cyan-700 font-medium">공동 수업</p>
              </div>
              <div className="text-cyan-500 text-3xl">🤝</div>
            </div>
          </div>
          
          <div className="card flex-1 bg-gradient-to-br from-purple-50 to-purple-100 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-purple-600 mb-1">
                  {new Set(fixedClasses.map(fc => fc.subject)).size}
                </h3>
                <p className="text-purple-700 font-medium">관련 과목 수</p>
              </div>
              <div className="text-purple-500 text-3xl">📚</div>
            </div>
          </div>
          
          <div className="card flex-1 bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-red-600 mb-1">{conflicts.length}</h3>
                <p className="text-red-700 font-medium">충돌 수</p>
              </div>
              <div className="text-red-500 text-3xl">⚠️</div>
            </div>
          </div>
          
          <div className="card flex-1 bg-gradient-to-br from-indigo-50 to-indigo-100 border-l-4 border-indigo-500">
            <div className="flex items-center justify-between">
              <div>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveAllSettings}
                >
                  📥 조건 저장하기
                </button>
                <p className="text-indigo-700 font-medium mt-2">전체 설정 저장</p>
              </div>
              <div className="text-indigo-500 text-3xl">💾</div>
            </div>
          </div>
        </div>

        {/* 충돌 경고 */}
        {conflicts.length > 0 && (
          <div className="alert alert-warning mb-6">
            <h4 className="text-lg font-semibold mb-3">⚠️ 시간 충돌이 감지되었습니다!</h4>
            <div className="space-y-2">
              {conflicts.map((conflict, index) => (
                <div key={index} className="text-sm bg-white p-3 rounded border">
                  <strong>{conflict.type === 'teacher' ? '교사 충돌:' : '학급 충돌:'}</strong>
                  <br />
                  {conflict.fc1.day}요일 {conflict.fc1.period}교시: 
                  {conflict.fc1.grade}학년 {conflict.fc1.class}반 {conflict.fc1.subject} ({conflict.fc1.teacher})
                  <br />
                  vs {conflict.fc2.grade}학년 {conflict.fc2.class}반 {conflict.fc2.subject} ({conflict.fc2.teacher})
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 새 고정 수업 추가 폼 */}
        <div className="card bg-gradient-to-br from-gray-50 to-gray-100 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3>➕ 새 고정 수업 추가</h3>
            <div className="flex gap-2">
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                📁 JSON 파일 업로드
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="form-group">
              <label>요일</label>
              <select
                value={newFixedClass.day}
                onChange={(e) => setNewFixedClass({ ...newFixedClass, day: e.target.value })}
              >
                <option value="">요일 선택</option>
                {days.map(day => (
                  <option key={day} value={day}>{day}요일</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>교시</label>
              <select
                value={newFixedClass.period}
                onChange={(e) => setNewFixedClass({ ...newFixedClass, period: e.target.value })}
              >
                <option value="">교시 선택</option>
                {Array.from({ length: getMaxPeriods() }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}교시</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>학년</label>
              <select
                value={newFixedClass.grade}
                onChange={(e) => setNewFixedClass({ ...newFixedClass, grade: e.target.value, class: '' })}
              >
                <option value="">학년 선택</option>
                {grades.map(grade => (
                  <option key={grade} value={grade}>{grade}학년</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>반</label>
              <select
                value={newFixedClass.class}
                onChange={(e) => setNewFixedClass({ ...newFixedClass, class: e.target.value })}
                disabled={!newFixedClass.grade}
              >
                <option value="">반 선택</option>
                {newFixedClass.grade && Array.from({ length: getClassCountForGrade(parseInt(newFixedClass.grade)) }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}반</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>과목</label>
              <select
                value={newFixedClass.subject}
                onChange={(e) => setNewFixedClass({ ...newFixedClass, subject: e.target.value })}
              >
                <option value="">과목 선택</option>
                {data.subjects?.map((subject, index) => (
                  <option key={index} value={subject.name}>{subject.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>교사</label>
              <select
                value={newFixedClass.teacher}
                onChange={(e) => setNewFixedClass({ ...newFixedClass, teacher: e.target.value })}
              >
                <option value="">교사 선택</option>
                {data.teachers?.map((teacher, index) => (
                  <option key={index} value={teacher.name}>{teacher.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <button className="btn btn-primary" onClick={addFixedClass}>
              고정 수업 추가
            </button>
          </div>
        </div>

        {/* 고정 수업 목록 */}
        <div className="card">
          <h3>📋 설정된 고정 수업 목록</h3>
          
          {fixedClasses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-4">📝</div>
              <p className="mb-2">설정된 고정 수업이 없습니다.</p>
              <p className="text-sm mb-4">위 폼을 사용해서 고정 수업을 추가하거나 JSON 파일을 업로드해보세요.</p>
              <div className="flex justify-center gap-4">
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  📁 JSON 파일 업로드
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>요일</th>
                    <th>교시</th>
                    <th>학급</th>
                    <th>과목</th>
                    <th>주교사</th>
                    <th>공동 교사</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {fixedClasses
                    .sort((a, b) => {
                      const dayOrder = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5 };
                      if (dayOrder[a.day] !== dayOrder[b.day]) {
                        return dayOrder[a.day] - dayOrder[b.day];
                      }
                      return a.period - b.period;
                    })
                    .map((fixedClass) => (
                    <tr key={fixedClass.id}>
                      <td>{fixedClass.day}요일</td>
                      <td>{fixedClass.period}교시</td>
                      <td>{fixedClass.grade}학년 {fixedClass.class}반</td>
                      <td>{fixedClass.subject}</td>
                      <td>
                        <span className="font-medium">{fixedClass.teacher}</span>
                      </td>
                      <td>
                        {fixedClass.coTeachers && fixedClass.coTeachers.length > 0 ? (
                          <div className="text-sm">
                            {fixedClass.coTeachers.map((coTeacher, index) => (
                              <span key={index} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-1 mb-1">
                                {coTeacher}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td>
                        <button 
                          className="btn btn-danger btn-sm"
                          onClick={() => removeFixedClass(fixedClass.id)}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 네비게이션 */}
        <div className="navigation">
          <button className="btn btn-secondary" onClick={prevStep}>
            ← 이전 단계
          </button>
          <button 
            className="btn btn-primary" 
            onClick={nextStep}
            disabled={conflicts.length > 0}
          >
            다음 단계 →
          </button>
        </div>
        
        {conflicts.length > 0 && (
          <p className="text-red-600 text-sm mt-2 text-center">
            * 충돌을 해결한 후 다음 단계로 진행할 수 있습니다.
          </p>
        )}
      </div>
    </div>
  );
}

export default FixedClassSettings; 