import React, { useState } from 'react';

function TeacherSettings({ data, updateData, nextStep, prevStep }) {
  const [teachers, setTeachers] = useState(data.teachers || []);
  const [newTeacher, setNewTeacher] = useState({
    name: '',
    subjects: [],
    unavailable: [],
    allow_parallel: false,
    co_teaching_with: '',
    maxHours: 25,
    weeklyHoursByGrade: {},
    subjectHours: {}
  });
  
  // 편집 모달 상태
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [editingIndex, setEditingIndex] = useState(-1);

  const days = ['월', '화', '수', '목', '금'];
  const maxPeriods = Math.max(...Object.values(data.base.periods_per_day));

  const addTeacher = () => {
    if (newTeacher.name.trim() && newTeacher.subjects.length > 0) {
      const updatedTeachers = [...teachers, { ...newTeacher, id: Date.now() }];
      setTeachers(updatedTeachers);
      updateData('teachers', updatedTeachers);
      setNewTeacher({
        name: '',
        subjects: [],
        unavailable: [],
        allow_parallel: false,
        co_teaching_with: '',
        maxHours: 25,
        weeklyHoursByGrade: {},
        subjectHours: {}
      });
    } else {
      alert('교사명과 담당 과목을 입력해주세요.');
    }
  };

  const updateTeacher = (index, field, value) => {
    const updatedTeachers = teachers.map((teacher, i) => 
      i === index ? { ...teacher, [field]: value } : teacher
    );
    setTeachers(updatedTeachers);
    updateData('teachers', updatedTeachers);
  };

  const removeTeacher = (index) => {
    const updatedTeachers = teachers.filter((_, i) => i !== index);
    setTeachers(updatedTeachers);
    updateData('teachers', updatedTeachers);
  };

  // 편집 모달 관련 함수들
  const openEditModal = (teacher, index) => {
    setEditingTeacher({ ...teacher });
    setEditingIndex(index);
  };

  const closeEditModal = () => {
    setEditingTeacher(null);
    setEditingIndex(-1);
  };

  const saveEditedTeacher = () => {
    if (editingTeacher && editingIndex >= 0) {
      const updatedTeachers = teachers.map((teacher, i) => 
        i === editingIndex ? editingTeacher : teacher
      );
      setTeachers(updatedTeachers);
      updateData('teachers', updatedTeachers);
      closeEditModal();
    }
  };

  const addUnavailableTime = (day, period) => {
    const timeSlot = [day, period];
    const isAlreadyAdded = editingTeacher.unavailable.some(
      slot => slot[0] === day && slot[1] === period
    );
    
    if (!isAlreadyAdded) {
      const updatedUnavailable = [...editingTeacher.unavailable, timeSlot];
      setEditingTeacher({ ...editingTeacher, unavailable: updatedUnavailable });
    }
  };

  const removeUnavailableTime = (day, period) => {
    const updatedUnavailable = editingTeacher.unavailable.filter(
      slot => !(slot[0] === day && slot[1] === period)
    );
    setEditingTeacher({ ...editingTeacher, unavailable: updatedUnavailable });
  };

  const isTimeUnavailable = (day, period) => {
    return editingTeacher.unavailable.some(slot => slot[0] === day && slot[1] === period);
  };

  const toggleSubjectInEdit = (subjectName) => {
    const updatedSubjects = editingTeacher.subjects.includes(subjectName)
      ? editingTeacher.subjects.filter(s => s !== subjectName)
      : [...editingTeacher.subjects, subjectName];
    setEditingTeacher({ ...editingTeacher, subjects: updatedSubjects });
  };

  // JSON 파일 업로드 기능
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        
        if (jsonData.teachers && Array.isArray(jsonData.teachers)) {
          // JSON 데이터를 현재 형식으로 변환
          const convertedTeachers = jsonData.teachers.map(teacher => {
            // unavailableTimes를 현재 형식으로 변환
            const unavailable = teacher.unavailableTimes ? teacher.unavailableTimes.map(time => {
              const day = time.charAt(0); // '월', '화', '수', '목', '금'
              const period = parseInt(time.substring(1)); // '7' -> 7
              return [day, period];
            }) : [];

            return {
              name: teacher.name,
              subjects: [teacher.subject], // 단일 과목을 배열로 변환
              unavailable: unavailable,
              allow_parallel: false, // 기본값
              co_teaching_with: '',
              maxHours: teacher.maxHours || teacher.weeklyHours || 25, // 주간 최대 시수
              weeklyHoursByGrade: teacher.weeklyHoursByGrade || {}, // 학급별 주간 시수
              id: Date.now() + Math.random() // 고유 ID 생성
            };
          });

          if (confirm(`JSON 파일에서 ${convertedTeachers.length}명의 교사를 불러오시겠습니까? 기존 교사 데이터가 덮어씌워집니다.`)) {
            setTeachers(convertedTeachers);
            updateData('teachers', convertedTeachers);
            alert(`${convertedTeachers.length}명의 교사가 성공적으로 불러와졌습니다.`);
          }
        } else {
          alert('올바른 교사 데이터 형식이 아닙니다.');
        }
      } catch (error) {
        alert('JSON 파일을 읽는 중 오류가 발생했습니다: ' + error.message);
      }
    };
    reader.readAsText(file);
  };

  const handleNext = () => {
    if (teachers.length === 0) {
      alert('최소 1명 이상의 교사를 추가해주세요.');
      return;
    }
    nextStep();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 py-8">
      {/* 전체 컨테이너 - 데스크탑 최적화 넓은 레이아웃 */}
      <div className="max-w-[1600px] mx-auto px-8">
        
        {/* 헤더 */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-4 mb-6">
            <span className="text-6xl">👨‍🏫</span>
            <h1 className="text-5xl font-bold text-gray-800">교사 설정</h1>
          </div>
          <p className="text-xl text-gray-600">교사 정보와 담당 과목, 수업 불가 시간을 설정하세요</p>
        </div>

        {/* 통계 카드들 - 가로 한 줄 배치 */}
        <div className="flex flex-wrap gap-8 mb-12 justify-center">
          <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[240px] text-center border border-blue-100 hover:shadow-xl transition-shadow">
            <div className="text-4xl font-bold text-blue-600 mb-3">{teachers.length}</div>
            <div className="text-lg text-gray-700 font-semibold">등록된 교사</div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[240px] text-center border border-green-100 hover:shadow-xl transition-shadow">
            <div className="text-4xl font-bold text-green-600 mb-3">{data.subjects?.length || 0}</div>
            <div className="text-lg text-gray-700 font-semibold">등록된 과목</div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[240px] text-center border border-orange-100 hover:shadow-xl transition-shadow">
            <div className="text-4xl font-bold text-orange-600 mb-3">
              {teachers.reduce((sum, teacher) => sum + teacher.unavailable.length, 0)}
            </div>
            <div className="text-lg text-gray-700 font-semibold">수업불가 시간</div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[240px] text-center border border-purple-100 hover:shadow-xl transition-shadow">
            <div className="text-4xl font-bold text-purple-600 mb-3">
              {teachers.filter(t => t.allow_parallel).length}
            </div>
            <div className="text-lg text-gray-700 font-semibold">동시수업 가능</div>
          </div>
        </div>

        {/* 메인 컨텐츠 - 3단 가로 배치 (넓은 데스크탑 레이아웃) */}
        <div className="flex flex-wrap gap-8 items-start mb-12">
          
          {/* 새 교사 추가 카드 */}
          <div className="flex-1 min-w-[400px] bg-white shadow-lg rounded-2xl p-8 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-4 mb-8">
              <span className="text-4xl">➕</span>
              <h3 className="text-2xl font-bold text-gray-800">새 교사 추가</h3>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-3">교사명</label>
                <input
                  type="text"
                  value={newTeacher.name}
                  onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
                  placeholder="예: 김선생"
                  className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-3">담당 과목</label>
                {data.subjects?.length === 0 || !data.subjects ? (
                  <div className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-300 rounded-xl">
                    <div className="text-4xl mb-2">📚</div>
                    <p className="text-lg mb-1">등록된 과목이 없습니다</p>
                    <p className="text-sm text-gray-400">과목 설정에서 먼저 과목을 등록해주세요</p>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded-xl max-h-64 overflow-y-auto border-2 border-gray-200">
                    <div className="space-y-3">
                      {data.subjects.map((subject, index) => {
                        const isSelected = newTeacher.subjects.includes(subject.name);
                        const subjectHours = newTeacher.subjectHours?.[subject.name] || 0;
                        
                        return (
                          <div key={index} className={`p-3 rounded-lg border transition-all ${
                            isSelected 
                              ? 'bg-white border-blue-300 shadow-sm' 
                              : 'bg-gray-100 border-gray-200'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    const updatedSubjects = isSelected
                                      ? newTeacher.subjects.filter(s => s !== subject.name)
                                      : [...newTeacher.subjects, subject.name];
                                    setNewTeacher({ ...newTeacher, subjects: updatedSubjects });
                                  }}
                                  className="mr-3 w-4 h-4"
                                />
                                <span className="font-medium text-gray-800">{subject.name}</span>
                              </div>
                              
                              {isSelected && (
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-gray-600">시수:</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    value={subjectHours}
                                    onChange={(e) => {
                                      const newValue = parseInt(e.target.value) || 0;
                                      const updatedSubjectHours = {
                                        ...newTeacher.subjectHours,
                                        [subject.name]: newValue
                                      };
                                      setNewTeacher({
                                        ...newTeacher,
                                        subjectHours: updatedSubjectHours
                                      });
                                    }}
                                    className="w-16 px-2 py-1 text-center border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                                    placeholder="0"
                                  />
                                  <span className="text-xs text-gray-500">시간</span>
                                </div>
                              )}
                            </div>
                            
                            {isSelected && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-600">기본 시수:</span>
                                  <span className="text-gray-800">{subject.weekly_hours || 1}시간</span>
                                </div>
                                <div className="flex items-center justify-between text-xs mt-1">
                                  <span className="text-gray-600">설정 시수:</span>
                                  <span className={`font-medium ${
                                    subjectHours > 0 ? 'text-green-600' : 'text-red-500'
                                  }`}>
                                    {subjectHours}시간
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* 선택된 과목 요약 */}
                    {newTeacher.subjects.length > 0 && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="text-xs font-semibold text-blue-800 mb-2">선택된 과목:</div>
                        <div className="space-y-1">
                          {newTeacher.subjects.map(subjectName => {
                            const subject = data.subjects.find(s => s.name === subjectName);
                            const subjectHours = newTeacher.subjectHours?.[subjectName] || 0;
                            const defaultHours = subject?.weekly_hours || 1;
                            const totalHours = subjectHours > 0 ? subjectHours : defaultHours;
                            
                            return (
                              <div key={subjectName} className="flex items-center justify-between text-xs">
                                <span className="text-gray-700">{subjectName}</span>
                                <span className="text-blue-600 font-medium">
                                  {subjectHours > 0 ? `${subjectHours}시간` : `기본 ${defaultHours}시간`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-2 pt-2 border-t border-blue-200">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-blue-800">총 시수:</span>
                            <span className="font-bold text-blue-600">
                              {newTeacher.subjects.reduce((sum, subjectName) => {
                                const subject = data.subjects.find(s => s.name === subjectName);
                                const subjectHours = newTeacher.subjectHours?.[subjectName] || 0;
                                const defaultHours = subject?.weekly_hours || 1;
                                return sum + (subjectHours > 0 ? subjectHours : defaultHours);
                              }, 0)}시간
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-3">주간 최대 수업시수</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="40"
                    value={newTeacher.maxHours}
                    onChange={(e) => setNewTeacher({ ...newTeacher, maxHours: parseInt(e.target.value) || 25 })}
                    className="flex-1 px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
                    placeholder="25"
                  />
                  <span className="text-lg text-gray-600 font-medium">시간/주</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">일반적으로 20-30시간/주가 적정합니다. 공동수업이 많은 경우 더 높게 설정할 수 있습니다.</p>
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-3">학급별 주간 수업시수 (선택사항)</label>
                <p className="text-sm text-gray-500 mb-3">각 학급에서 담당하는 시수를 설정하려면 편집 모달을 사용하세요.</p>
                <div className="bg-gray-50 p-4 rounded-xl border-2 border-gray-200">
                  <div className="text-center text-gray-500">
                    <div className="text-2xl mb-2">📚</div>
                    <p className="text-sm">교사 추가 후 편집 버튼을 클릭하여</p>
                    <p className="text-sm">학급별 상세 시수를 설정할 수 있습니다</p>
                  </div>
                </div>
              </div>



              <button 
                className="w-full bg-blue-500 text-white px-6 py-4 rounded-xl text-lg font-semibold hover:bg-blue-600 hover:shadow-lg transition-all disabled:bg-gray-300 disabled:cursor-not-allowed"
                onClick={addTeacher}
                disabled={!newTeacher.name.trim() || newTeacher.subjects.length === 0}
              >
                교사 추가
              </button>

              <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <h4 className="text-lg font-semibold text-blue-800 mb-2">💡 추가 후 설정</h4>
                <p className="text-base text-blue-700">
                  교사를 추가한 후 <strong>교사 목록</strong>에서 편집 버튼을 클릭하여 수업 불가 시간을 설정할 수 있습니다.
                </p>
              </div>
            </div>
          </div>

          {/* 교사 목록 카드 */}
          <div className="flex-[2] min-w-[600px] bg-white shadow-lg rounded-2xl p-8 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <span className="text-4xl">📋</span>
                <h3 className="text-2xl font-bold text-gray-800">등록된 교사 목록</h3>
              </div>
              
              {/* JSON 업로드 버튼 */}
              <div className="flex items-center gap-3">
                <label className="bg-green-500 text-white px-4 py-3 rounded-lg text-base font-semibold hover:bg-green-600 hover:shadow-lg transition-all cursor-pointer">
                  📁 JSON 업로드
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <span className="text-sm text-gray-500">총 {teachers.length}명</span>
              </div>
            </div>
            
            {teachers.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <div className="text-8xl mb-6">👨‍🏫</div>
                <p className="text-2xl mb-3 font-semibold">등록된 교사가 없습니다</p>
                <p className="text-lg text-gray-400 mb-8">새 교사를 추가하거나 JSON 파일을 업로드해주세요</p>
                
                {/* JSON 업로드 안내 */}
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 max-w-md mx-auto">
                  <h4 className="text-lg font-semibold text-blue-800 mb-3">💡 빠른 설정</h4>
                  <p className="text-base text-blue-700 mb-4">
                    기존 교사 데이터가 있다면 JSON 파일로 한 번에 불러올 수 있습니다.
                  </p>
                  <label className="bg-blue-500 text-white px-6 py-3 rounded-lg text-base font-semibold hover:bg-blue-600 hover:shadow-lg transition-all cursor-pointer inline-block">
                    📁 JSON 파일 업로드
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {teachers.map((teacher, index) => (
                  <div key={index} className="flex items-center justify-between p-5 bg-gray-50 rounded-xl border border-gray-200 hover:shadow-md hover:bg-white transition-all">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-3">
                        <h4 className="text-xl font-semibold text-gray-800">{teacher.name}</h4>
                        {teacher.allow_parallel && (
                          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                            동시수업가능
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div>
                          <span className="text-base text-gray-600">담당 과목: </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {teacher.subjects.length > 0 ? teacher.subjects.map((subject, subjectIndex) => (
                              <span 
                                key={subjectIndex}
                                className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium"
                              >
                                {subject}
                              </span>
                            )) : (
                              <span className="text-gray-400 text-sm">담당 과목 없음</span>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <span className="text-base text-gray-600">수업 불가: </span>
                          <span className="text-lg font-semibold text-red-600">
                            {teacher.unavailable.length}개 시간
                          </span>
                        </div>
                        
                        <div>
                          <span className="text-base text-gray-600">최대 시수: </span>
                          <span className="text-lg font-semibold text-blue-600">
                            {teacher.maxHours || 25}시간/주
                          </span>
                        </div>
                        
                        <div>
                          <span className="text-base text-gray-600">학급별 시수: </span>
                          <span className="text-lg font-semibold text-green-600">
                            {Object.values(teacher.weeklyHoursByGrade || {}).reduce((sum, hours) => sum + hours, 0)}시간
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 ml-6">
                      <button 
                        className="bg-blue-500 text-white px-4 py-3 rounded-lg text-base font-semibold hover:bg-blue-600 hover:shadow-lg transition-all"
                        onClick={() => openEditModal(teacher, index)}
                      >
                        편집
                      </button>
                      <button 
                        className="bg-red-500 text-white px-4 py-3 rounded-lg text-base font-semibold hover:bg-red-600 hover:shadow-lg transition-all"
                        onClick={() => removeTeacher(index)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            disabled={teachers.length === 0}
          >
            다음 단계 →
          </button>
        </div>
      </div>

      {/* 편집 모달 */}
      {editingTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-800">
                  👨‍🏫 {editingTeacher.name} 편집
                </h3>
                <button 
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                  onClick={closeEditModal}
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-8">
              {/* 기본 정보 */}
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-4">교사명</label>
                <input
                  type="text"
                  value={editingTeacher.name}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, name: e.target.value })}
                  className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
                />
              </div>

              {/* 담당 과목 설정 */}
              <div>
                <h4 className="text-xl font-semibold text-gray-800 mb-4">📚 담당 과목 설정</h4>
                <div className="bg-gray-50 p-6 rounded-xl border-2 border-gray-200">
                  <div className="space-y-4">
                    {data.subjects?.map((subject, index) => {
                      const isSelected = editingTeacher.subjects.includes(subject.name);
                      const subjectHours = editingTeacher.subjectHours?.[subject.name] || 0;
                      
                      return (
                        <div key={index} className={`p-4 rounded-lg border-2 transition-all ${
                          isSelected 
                            ? 'bg-white border-blue-300 shadow-md' 
                            : 'bg-gray-100 border-gray-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSubjectInEdit(subject.name)}
                                className="mr-3 w-5 h-5"
                              />
                              <span className="font-medium text-gray-800">{subject.name}</span>
                            </div>
                            
                            {isSelected && (
                              <div className="flex items-center gap-3">
                                <label className="text-sm text-gray-600">주간시수:</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="10"
                                  value={subjectHours}
                                  onChange={(e) => {
                                    const newValue = parseInt(e.target.value) || 0;
                                    const updatedSubjectHours = {
                                      ...editingTeacher.subjectHours,
                                      [subject.name]: newValue
                                    };
                                    setEditingTeacher({
                                      ...editingTeacher,
                                      subjectHours: updatedSubjectHours
                                    });
                                  }}
                                  className="w-20 px-3 py-2 text-center border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                  placeholder="0"
                                />
                                <span className="text-sm text-gray-500">시간</span>
                              </div>
                            )}
                          </div>
                          
                          {isSelected && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">과목 기본 시수:</span>
                                <span className="font-medium text-gray-800">{subject.weekly_hours || 1}시간</span>
                              </div>
                              <div className="flex items-center justify-between text-sm mt-1">
                                <span className="text-gray-600">설정 시수:</span>
                                <span className={`font-bold ${
                                  subjectHours > 0 ? 'text-green-600' : 'text-red-500'
                                }`}>
                                  {subjectHours}시간
                                </span>
                              </div>
                              {subjectHours === 0 && (
                                <p className="text-xs text-red-500 mt-1">
                                  ⚠️ 시수를 설정하지 않으면 기본 시수가 적용됩니다.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* 선택된 과목 요약 */}
                  {editingTeacher.subjects.length > 0 && (
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h5 className="font-semibold text-blue-800 mb-3">📋 선택된 과목 요약</h5>
                      <div className="space-y-2">
                        {editingTeacher.subjects.map(subjectName => {
                          const subject = data.subjects.find(s => s.name === subjectName);
                          const subjectHours = editingTeacher.subjectHours?.[subjectName] || 0;
                          const defaultHours = subject?.weekly_hours || 1;
                          const totalHours = subjectHours > 0 ? subjectHours : defaultHours;
                          
                          return (
                            <div key={subjectName} className="flex items-center justify-between text-sm">
                              <span className="text-gray-700">{subjectName}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500">
                                  {subjectHours > 0 ? `${subjectHours}시간` : `기본 ${defaultHours}시간`}
                                </span>
                                <span className="text-blue-600 font-medium">
                                  (총 {totalHours}시간)
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-blue-800">총 과목 시수:</span>
                          <span className="text-lg font-bold text-blue-600">
                            {editingTeacher.subjects.reduce((sum, subjectName) => {
                              const subject = data.subjects.find(s => s.name === subjectName);
                              const subjectHours = editingTeacher.subjectHours?.[subjectName] || 0;
                              const defaultHours = subject?.weekly_hours || 1;
                              return sum + (subjectHours > 0 ? subjectHours : defaultHours);
                            }, 0)}시간
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 주간 최대 수업시수 설정 */}
              <div>
                <h4 className="text-xl font-semibold text-gray-800 mb-4">⏰ 주간 최대 수업시수 설정</h4>
                <div className="bg-gray-50 p-6 rounded-xl border-2 border-gray-200">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-base font-semibold text-gray-700 mb-3">최대 수업시수</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="1"
                          max="40"
                          value={editingTeacher.maxHours || 25}
                          onChange={(e) => setEditingTeacher({ 
                            ...editingTeacher, 
                            maxHours: parseInt(e.target.value) || 25 
                          })}
                          className="flex-1 px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
                          placeholder="25"
                        />
                        <span className="text-lg text-gray-600 font-medium">시간/주</span>
                      </div>
                    </div>
                    
                    <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <div className="text-2xl font-bold text-blue-600">
                        {editingTeacher.maxHours || 25}
                      </div>
                      <div className="text-sm text-blue-700">시간/주</div>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <h5 className="font-semibold text-yellow-800 mb-2">💡 시수 설정 가이드</h5>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      <li>• 일반 교사: 20-25시간/주</li>
                      <li>• 공동수업 담당: 25-30시간/주</li>
                      <li>• 과목 담당이 많은 교사: 30-35시간/주</li>
                      <li>• 공동수업이 많은 경우 시수가 높게 나올 수 있습니다</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 학급별 주간 수업시수 설정 */}
              <div>
                <h4 className="text-xl font-semibold text-gray-800 mb-4">📚 학급별 주간 수업시수 설정</h4>
                <div className="bg-gray-50 p-6 rounded-xl border-2 border-gray-200">
                  <p className="text-base text-gray-600 mb-4">각 학급에서 담당하는 주간 수업시수를 설정하세요.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: data.base.grades }, (_, gradeIndex) => {
                      const grade = gradeIndex + 1;
                      const classCount = data.base.classes_per_grade[gradeIndex];
                      
                      return (
                        <div key={grade} className="bg-white p-4 rounded-lg border border-gray-200">
                          <h5 className="font-semibold text-gray-800 mb-3">{grade}학년</h5>
                          <div className="space-y-2">
                            {Array.from({ length: classCount }, (_, classIndex) => {
                              const classNum = classIndex + 1;
                              const className = `${grade}학년-${classNum}`;
                              const currentHours = editingTeacher.weeklyHoursByGrade?.[className] || 0;
                              
                              return (
                                <div key={classNum} className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600">{classNum}반</span>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min="0"
                                      max="10"
                                      value={currentHours}
                                      onChange={(e) => {
                                        const newValue = parseInt(e.target.value) || 0;
                                        const updatedWeeklyHours = {
                                          ...editingTeacher.weeklyHoursByGrade,
                                          [className]: newValue
                                        };
                                        setEditingTeacher({
                                          ...editingTeacher,
                                          weeklyHoursByGrade: updatedWeeklyHours
                                        });
                                      }}
                                      className="w-16 px-2 py-1 text-center border border-gray-300 rounded text-sm"
                                    />
                                    <span className="text-xs text-gray-500">시간</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-green-800">총 설정 시수:</span>
                      <span className="text-lg font-bold text-green-600">
                        {Object.values(editingTeacher.weeklyHoursByGrade || {}).reduce((sum, hours) => sum + hours, 0)}시간
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 수업 불가 시간 설정 */}
              <div>
                <h4 className="text-xl font-semibold text-gray-800 mb-4">⏰ 수업 불가 시간 설정</h4>
                <p className="text-base text-gray-600 mb-4">수업할 수 없는 시간을 클릭하여 설정하세요.</p>
                
                <div className="overflow-x-auto bg-white border-2 border-gray-200 rounded-xl">
                  <table className="w-full text-base border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-4 border-r border-gray-300 font-semibold text-gray-700">교시</th>
                        {days.map(day => (
                          <th key={day} className="p-4 border-r border-gray-300 font-semibold text-gray-700 last:border-r-0">
                            {day}요일
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: maxPeriods }, (_, periodIndex) => (
                        <tr key={periodIndex} className="border-b border-gray-200 last:border-b-0">
                          <td className="p-4 border-r border-gray-300 text-center font-semibold bg-gray-50">
                            {periodIndex + 1}교시
                          </td>
                          {days.map(day => {
                            const isAvailable = data.base.periods_per_day[day] > periodIndex;
                            const isUnavailable = isTimeUnavailable(day, periodIndex + 1);
                            
                            return (
                              <td key={day} className="p-2 border-r border-gray-300 last:border-r-0">
                                <button
                                  className={`w-full h-12 rounded-lg text-base font-semibold transition-all ${
                                    !isAvailable 
                                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                      : isUnavailable
                                        ? 'bg-red-200 text-red-800 hover:bg-red-300 border-2 border-red-400'
                                        : 'bg-green-100 text-green-800 hover:bg-green-200 border-2 border-green-300'
                                  }`}
                                  disabled={!isAvailable}
                                  onClick={() => {
                                    if (isUnavailable) {
                                      removeUnavailableTime(day, periodIndex + 1);
                                    } else {
                                      addUnavailableTime(day, periodIndex + 1);
                                    }
                                  }}
                                >
                                  {!isAvailable ? '-' : isUnavailable ? '불가' : '가능'}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-6 flex items-center gap-6 text-base">
                  <div className="flex items-center">
                    <div className="w-6 h-6 bg-green-100 border-2 border-green-300 rounded mr-3"></div>
                    <span>수업 가능</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-6 h-6 bg-red-200 border-2 border-red-400 rounded mr-3"></div>
                    <span>수업 불가</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-6 h-6 bg-gray-200 border rounded mr-3"></div>
                    <span>해당 교시 없음</span>
                  </div>
                </div>

                {/* 현재 설정된 수업 불가 시간 요약 */}
                {editingTeacher.unavailable.length > 0 && (
                  <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
                    <h5 className="font-semibold text-red-800 mb-2">
                      현재 설정된 수업 불가 시간 ({editingTeacher.unavailable.length}개)
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {editingTeacher.unavailable.map(([day, period], index) => (
                        <span 
                          key={index}
                          className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium"
                        >
                          {day} {period}교시
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 모달 하단 버튼 */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 rounded-b-2xl">
              <div className="flex gap-4 justify-end">
                <button 
                  className="bg-gray-500 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-600 transition-all"
                  onClick={closeEditModal}
                >
                  취소
                </button>
                <button 
                  className="bg-blue-500 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-blue-600 transition-all"
                  onClick={saveEditedTeacher}
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherSettings; 