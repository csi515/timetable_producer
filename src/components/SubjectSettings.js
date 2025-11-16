"use client";

import React, { useState } from 'react';

function SubjectSettings({ data, updateData, nextStep, prevStep }) {
  // 기존 데이터 호환성을 위한 과목 데이터 보정
  const normalizeSubjects = (subjects) => {
    return subjects.map(subject => ({
      ...subject,
      weekly_hours: subject.weekly_hours !== undefined ? subject.weekly_hours : 1,
      requires_co_teaching: subject.requires_co_teaching !== undefined ? subject.requires_co_teaching : false,
      category: subject.category || '교과과목' // 기본값 설정
    }));
  };

  const [subjects, setSubjects] = useState(normalizeSubjects(data.subjects || defaultSubjects));
  const [newSubject, setNewSubject] = useState({
    name: '',
    weekly_hours: 1,
    is_merged: false,
    is_space_limited: false,
    max_classes_at_once: 1,
    requires_co_teaching: false,
    category: '교과과목'
  });

  const defaultSubjects = [
    // 교과과목 (Academic Subjects)
    { name: '국어', weekly_hours: 5, is_merged: false, is_space_limited: false, max_classes_at_once: 1, requires_co_teaching: false, category: '교과과목' },
    { name: '도덕', weekly_hours: 2, is_merged: false, is_space_limited: false, max_classes_at_once: 1, requires_co_teaching: false, category: '교과과목' },
    { name: '역사', weekly_hours: 3, is_merged: false, is_space_limited: false, max_classes_at_once: 1, requires_co_teaching: false, category: '교과과목' },
    { name: '사회', weekly_hours: 3, is_merged: false, is_space_limited: false, max_classes_at_once: 1, requires_co_teaching: false, category: '교과과목' },
    { name: '수학', weekly_hours: 5, is_merged: false, is_space_limited: false, max_classes_at_once: 1, requires_co_teaching: false, category: '교과과목' },
    { name: '과학', weekly_hours: 4, is_merged: false, is_space_limited: false, max_classes_at_once: 1, requires_co_teaching: false, category: '교과과목' },
    { name: '기술가정', weekly_hours: 2, is_merged: false, is_space_limited: false, max_classes_at_once: 1, requires_co_teaching: false, category: '교과과목' },
    { name: '정보', weekly_hours: 1, is_merged: false, is_space_limited: false, max_classes_at_once: 1, requires_co_teaching: false, category: '교과과목' },
    { name: '체육', weekly_hours: 3, is_merged: false, is_space_limited: true, max_classes_at_once: 2, requires_co_teaching: false, category: '교과과목' },
    { name: '음악', weekly_hours: 2, is_merged: false, is_space_limited: false, max_classes_at_once: 1, requires_co_teaching: false, category: '교과과목' },
    { name: '미술', weekly_hours: 2, is_merged: false, is_space_limited: false, max_classes_at_once: 1, requires_co_teaching: false, category: '교과과목' },
    { name: '영어', weekly_hours: 4, is_merged: false, is_space_limited: false, max_classes_at_once: 1, requires_co_teaching: false, category: '교과과목' },
    { name: '원어민', weekly_hours: 1, is_merged: false, is_space_limited: false, max_classes_at_once: 1, requires_co_teaching: false, category: '교과과목' },
    { name: '보건', weekly_hours: 1, is_merged: false, is_space_limited: false, max_classes_at_once: 1, requires_co_teaching: false, category: '교과과목' },
    
    // 창의적 체험활동 (Creative Experience Activities)
    { name: '진로와직업', weekly_hours: 1, is_merged: false, is_space_limited: false, max_classes_at_once: 1, requires_co_teaching: false, category: '창의적 체험활동' },
    { name: '동아리', weekly_hours: 1, is_merged: false, is_space_limited: false, max_classes_at_once: 1, requires_co_teaching: false, category: '창의적 체험활동' },
    { name: '스포츠', weekly_hours: 1, is_merged: false, is_space_limited: false, max_classes_at_once: 1, requires_co_teaching: false, category: '창의적 체험활동' }
  ];

  const addSubject = () => {
    if (newSubject.name.trim()) {
      const updatedSubjects = [...subjects, { ...newSubject, id: Date.now() }];
      setSubjects(updatedSubjects);
      updateData('subjects', updatedSubjects);
      setNewSubject({
        name: '',
        weekly_hours: 1,
        is_merged: false,
        is_space_limited: false,
        max_classes_at_once: 1,
        requires_co_teaching: false,
        category: '교과과목'
      });
    }
  };

  const updateSubject = (index, field, value) => {
    const updatedSubjects = subjects.map((subject, i) => 
      i === index ? { ...subject, [field]: value } : subject
    );
    setSubjects(updatedSubjects);
    updateData('subjects', updatedSubjects);
  };

  const removeSubject = (index) => {
    const updatedSubjects = subjects.filter((_, i) => i !== index);
    setSubjects(updatedSubjects);
    updateData('subjects', updatedSubjects);
  };

  const loadDefaultSubjects = () => {
    if (confirm('기본 과목을 불러오시겠습니까? 기존 설정이 덮어씌워집니다.')) {
      const normalizedSubjects = normalizeSubjects(defaultSubjects);
      setSubjects(normalizedSubjects);
      updateData('subjects', normalizedSubjects);
    }
  };

  const getTotalClassesFromBase = () => {
    if (!Array.isArray(data.base.classes_per_grade)) {
      return 0;
    }
    return data.base.classes_per_grade.reduce((sum, classes) => sum + classes, 0);
  };

  const handleNext = () => {
    if (subjects.length === 0) {
      alert('최소 1개 이상의 과목을 추가해주세요.');
      return;
    }
    nextStep();
  };

  // 과목 요약 텍스트 생성 함수
  const getSubjectSummaryText = () => {
    return subjects.map(subject => {
      let subjectText = subject.name;
      const attributes = [];
      
      if (subject.is_merged) attributes.push('병합');
      if (subject.is_space_limited) {
        attributes.push(`공간 제한(${subject.max_classes_at_once}반)`);
      }
      if (subject.requires_co_teaching) attributes.push('공동수업');
      
      if (attributes.length > 0) {
        subjectText += `(${attributes.join(', ')})`;
      }
      
      return subjectText;
    }).join(', ');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 py-8">
      {/* 전체 컨테이너 - 데스크탑 최적화 넓은 레이아웃 */}
      <div className="max-w-[1600px] mx-auto px-8">
        
        {/* 헤더 */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-4 mb-6">
            <span className="text-6xl">📖</span>
            <h1 className="text-5xl font-bold text-gray-800">과목 설정</h1>
          </div>
          <p className="text-xl text-gray-600">시간표에 포함될 과목들을 설정하고 속성을 지정하세요</p>
        </div>

        {/* 통계 카드들 - 가로 한 줄 배치 */}
        <div className="flex flex-wrap gap-8 mb-12 justify-center">
          <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[200px] text-center border border-blue-100 hover:shadow-xl transition-shadow">
            <div className="text-4xl font-bold text-blue-600 mb-3">{subjects.length}</div>
            <div className="text-lg text-gray-700 font-semibold">전체 과목</div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[200px] text-center border border-blue-100 hover:shadow-xl transition-shadow">
            <div className="text-4xl font-bold text-blue-600 mb-3">{subjects.filter(s => s.category === '교과과목').length}</div>
            <div className="text-lg text-gray-700 font-semibold">교과과목</div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[200px] text-center border border-green-100 hover:shadow-xl transition-shadow">
            <div className="text-4xl font-bold text-green-600 mb-3">{subjects.filter(s => s.category === '창의적 체험활동').length}</div>
            <div className="text-lg text-gray-700 font-semibold">창의적 체험활동</div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[200px] text-center border border-orange-100 hover:shadow-xl transition-shadow">
            <div className="text-4xl font-bold text-orange-600 mb-3">{subjects.filter(s => s.is_merged).length}</div>
            <div className="text-lg text-gray-700 font-semibold">병합 과목</div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[200px] text-center border border-red-100 hover:shadow-xl transition-shadow">
            <div className="text-4xl font-bold text-red-600 mb-3">{subjects.filter(s => s.is_space_limited).length}</div>
            <div className="text-lg text-gray-700 font-semibold">공간 제한</div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[200px] text-center border border-purple-100 hover:shadow-xl transition-shadow">
            <div className="text-4xl font-bold text-purple-600 mb-3">{subjects.filter(s => s.requires_co_teaching).length}</div>
            <div className="text-lg text-gray-700 font-semibold">공동 수업</div>
          </div>
        </div>

        {/* 메인 컨텐츠 - 3단 가로 배치 (넓은 데스크탑 레이아웃) */}
        <div className="flex flex-wrap gap-8 items-start mb-12">
          
          {/* 새 과목 추가 카드 */}
          <div className="flex-1 min-w-[400px] bg-white shadow-lg rounded-2xl p-8 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-4 mb-8">
              <span className="text-4xl">➕</span>
              <h3 className="text-2xl font-bold text-gray-800">새 과목 추가</h3>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-3">과목명</label>
                <input
                  type="text"
                  value={newSubject.name}
                  onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
                  placeholder="예: 국어"
                  className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
                />
              </div>
              
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-3">과목 분류</label>
                <select
                  value={newSubject.category}
                  onChange={(e) => setNewSubject({ ...newSubject, category: e.target.value })}
                  className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
                >
                  <option value="교과과목">📚 교과과목</option>
                  <option value="창의적 체험활동">🎨 창의적 체험활동</option>
                </select>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button 
                  className="flex-1 bg-blue-500 text-white px-6 py-4 rounded-xl text-lg font-semibold hover:bg-blue-600 hover:shadow-lg transition-all"
                  onClick={addSubject}
                >
                  과목 추가
                </button>
                <button 
                  className="flex-1 bg-gray-500 text-white px-6 py-4 rounded-xl text-lg font-semibold hover:bg-gray-600 hover:shadow-lg transition-all"
                  onClick={loadDefaultSubjects}
                >
                  기본 과목
                </button>
              </div>

              <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <h4 className="text-lg font-semibold text-blue-800 mb-2">💡 추가 후 설정</h4>
                <p className="text-base text-blue-700">
                  과목을 추가한 후 <strong>등록된 과목 목록</strong>에서 병합 수업, 공간 제한, 공동 수업 등의 속성을 체크할 수 있습니다.
                </p>
              </div>
            </div>
          </div>

          {/* 과목 목록 카드 */}
          <div className="flex-1 min-w-[500px] bg-white shadow-lg rounded-2xl p-8 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-4 mb-8">
              <span className="text-4xl">📋</span>
              <h3 className="text-2xl font-bold text-gray-800">등록된 과목 목록</h3>
            </div>
            
            {subjects.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <div className="text-8xl mb-6">📚</div>
                <p className="text-2xl mb-3 font-semibold">등록된 과목이 없습니다</p>
                <p className="text-lg text-gray-400">새 과목을 추가하거나 기본 과목을 불러와주세요</p>
              </div>
            ) : (
              <div className="space-y-6 max-h-[500px] overflow-y-auto">
                {/* 교과과목 섹션 */}
                <div>
                  <h4 className="text-lg font-bold text-blue-800 mb-3 flex items-center gap-2">
                    <span className="text-2xl">📚</span>
                    교과과목 ({subjects.filter(s => s.category === '교과과목').length}개)
                  </h4>
                  <div className="space-y-3">
                    {subjects.filter(subject => subject.category === '교과과목').map((subject, index) => {
                      const originalIndex = subjects.findIndex(s => s === subject);
                      return (
                        <div key={originalIndex} className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200 hover:shadow-md hover:bg-blue-100 transition-all">
                          <div className="flex-1 flex items-center gap-6">
                            <input
                              type="text"
                              value={subject.name}
                              onChange={(e) => updateSubject(originalIndex, 'name', e.target.value)}
                              className="font-semibold text-lg bg-transparent border-none focus:outline-none min-w-[120px]"
                              title={subject.name}
                            />
                            
                            <div className="flex items-center gap-4">
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={subject.is_merged}
                                  onChange={(e) => updateSubject(originalIndex, 'is_merged', e.target.checked)}
                                  className="w-4 h-4"
                                />
                                <span className="text-orange-600 font-semibold">병합</span>
                              </label>
                              
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={subject.is_space_limited}
                                  onChange={(e) => updateSubject(originalIndex, 'is_space_limited', e.target.checked)}
                                  className="w-4 h-4"
                                />
                                <span className="text-red-600 font-semibold">공간제한</span>
                              </label>
                              
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={subject.requires_co_teaching || false}
                                  onChange={(e) => updateSubject(originalIndex, 'requires_co_teaching', e.target.checked)}
                                  className="w-4 h-4"
                                />
                                <span className="text-purple-600 font-semibold">공동수업</span>
                              </label>
                              
                              {subject.is_space_limited && (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-600">최대</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max={getTotalClassesFromBase()}
                                    value={subject.max_classes_at_once}
                                    onChange={(e) => updateSubject(originalIndex, 'max_classes_at_once', parseInt(e.target.value) || 1)}
                                    className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:border-blue-500"
                                  />
                                  <span className="text-sm text-gray-600">반</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <button 
                            className="ml-4 bg-red-500 text-white px-3 py-2 rounded text-sm font-semibold hover:bg-red-600 hover:shadow-lg transition-all"
                            onClick={() => removeSubject(originalIndex)}
                          >
                            삭제
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 창의적 체험활동 섹션 */}
                <div>
                  <h4 className="text-lg font-bold text-green-800 mb-3 flex items-center gap-2">
                    <span className="text-2xl">🎨</span>
                    창의적 체험활동 ({subjects.filter(s => s.category === '창의적 체험활동').length}개)
                  </h4>
                  <div className="space-y-3">
                    {subjects.filter(subject => subject.category === '창의적 체험활동').map((subject, index) => {
                      const originalIndex = subjects.findIndex(s => s === subject);
                      return (
                        <div key={originalIndex} className="flex items-center justify-between p-4 bg-green-50 rounded-xl border border-green-200 hover:shadow-md hover:bg-green-100 transition-all">
                          <div className="flex-1 flex items-center gap-6">
                            <input
                              type="text"
                              value={subject.name}
                              onChange={(e) => updateSubject(originalIndex, 'name', e.target.value)}
                              className="font-semibold text-lg bg-transparent border-none focus:outline-none min-w-[120px]"
                              title={subject.name}
                            />
                            
                            <div className="flex items-center gap-4">
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={subject.is_merged}
                                  onChange={(e) => updateSubject(originalIndex, 'is_merged', e.target.checked)}
                                  className="w-4 h-4"
                                />
                                <span className="text-orange-600 font-semibold">병합</span>
                              </label>
                              
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={subject.is_space_limited}
                                  onChange={(e) => updateSubject(originalIndex, 'is_space_limited', e.target.checked)}
                                  className="w-4 h-4"
                                />
                                <span className="text-red-600 font-semibold">공간제한</span>
                              </label>
                              
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={subject.requires_co_teaching || false}
                                  onChange={(e) => updateSubject(originalIndex, 'requires_co_teaching', e.target.checked)}
                                  className="w-4 h-4"
                                />
                                <span className="text-purple-600 font-semibold">공동수업</span>
                              </label>
                              
                              {subject.is_space_limited && (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-600">최대</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max={getTotalClassesFromBase()}
                                    value={subject.max_classes_at_once}
                                    onChange={(e) => updateSubject(originalIndex, 'max_classes_at_once', parseInt(e.target.value) || 1)}
                                    className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:border-blue-500"
                                  />
                                  <span className="text-sm text-gray-600">반</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <button 
                            className="ml-4 bg-red-500 text-white px-3 py-2 rounded text-sm font-semibold hover:bg-red-600 hover:shadow-lg transition-all"
                            onClick={() => removeSubject(originalIndex)}
                          >
                            삭제
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 설정 가이드 카드 */}
          <div className="flex-1 min-w-[400px] bg-white shadow-lg rounded-2xl p-8 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-4 mb-8">
              <span className="text-4xl">💡</span>
              <h3 className="text-2xl font-bold text-gray-800">설정 가이드</h3>
            </div>
            
            <div className="space-y-8">
              {/* 현재 현황 */}
              <div>
                <h4 className="text-xl font-semibold text-blue-800 mb-4">📊 현재 현황</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-lg text-gray-700">전체 과목:</span>
                    <span className="text-xl font-bold text-blue-600">{subjects.length}개</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-lg text-gray-700">교과과목:</span>
                    <span className="text-xl font-bold text-blue-600">{subjects.filter(s => s.category === '교과과목').length}개</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-lg text-gray-700">창의적 체험활동:</span>
                    <span className="text-xl font-bold text-green-600">{subjects.filter(s => s.category === '창의적 체험활동').length}개</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-lg text-gray-700">병합 과목:</span>
                    <span className="text-xl font-bold text-orange-600">{subjects.filter(s => s.is_merged).length}개</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-lg text-gray-700">공간제한:</span>
                    <span className="text-xl font-bold text-red-600">{subjects.filter(s => s.is_space_limited).length}개</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-lg text-gray-700">공동수업:</span>
                    <span className="text-xl font-bold text-purple-600">{subjects.filter(s => s.requires_co_teaching).length}개</span>
                  </div>
                </div>
              </div>
              
              {/* 설정 팁 */}
              <div>
                <h4 className="text-xl font-semibold text-green-800 mb-4">✅ 설정 팁</h4>
                <ul className="space-y-3 text-base text-gray-700">
                  <li className="flex items-start gap-3">
                    <span className="text-blue-500 text-xl">📚</span>
                    <span><strong>교과과목:</strong> 국어, 수학, 영어 등 기본 교과</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 text-xl">🎨</span>
                    <span><strong>창의적 체험활동:</strong> 진로와직업, 동아리, 스포츠</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-orange-500 text-xl">🔶</span>
                    <span><strong>병합 수업:</strong> 체육, 음악, 미술</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-500 text-xl">🔴</span>
                    <span><strong>공간 제한:</strong> 특별실 필요 과목</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-500 text-xl">🟣</span>
                    <span><strong>공동 수업:</strong> 실험, 실습 과목</span>
                  </li>
                </ul>
              </div>

              {/* 등록된 과목 요약 */}
              {subjects.length > 0 && (
                <div>
                  <h4 className="text-xl font-semibold text-indigo-800 mb-4">📚 과목 요약</h4>
                  <div className="p-4 bg-gray-50 rounded-lg border">
                    <p className="text-base text-gray-800 leading-relaxed">
                      {getSubjectSummaryText() || '등록된 과목이 없습니다.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 네비게이션 */}
        <div className="flex justify-between items-center pt-8 border-t border-gray-200">
          <button 
            className="bg-gray-500 text-white px-10 py-5 rounded-xl text-xl font-semibold hover:bg-gray-600 hover:shadow-lg transition-all flex items-center gap-3"
            onClick={prevStep}
          >
            ← 이전 단계
          </button>
          <button 
            className="bg-blue-500 text-white px-10 py-5 rounded-xl text-xl font-semibold hover:bg-blue-600 hover:shadow-lg transition-all flex items-center gap-3 disabled:bg-gray-300 disabled:cursor-not-allowed"
            onClick={handleNext}
            disabled={subjects.length === 0}
          >
            다음 단계 →
          </button>
        </div>
      </div>
    </div>
  );
}

export default SubjectSettings; 