import React from 'react';

// 학급 이름 생성 함수 (helpers에서 가져온 로직)
const generateClassNames = (data) => {
  const classNames = [];
  const grades = data.base?.grades || 3;
  const classesPerGrade = data.base?.classes_per_grade || [];

  // grades가 숫자인 경우 배열로 변환
  const gradeArray = Array.isArray(grades) ? grades : Array.from({ length: grades }, (_, i) => i + 1);

  gradeArray.forEach((grade) => {
    const classCount = classesPerGrade[grade - 1] || 0;
    for (let classNum = 1; classNum <= classCount; classNum++) {
      classNames.push(`${grade}학년 ${classNum}반`);
    }
  });

  return classNames;
};

// 교사 목록 컴포넌트
export const TeacherList = ({ teachers, onEdit, onRemove, data }) => {
  if (teachers.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <div className="text-8xl mb-6">👨‍🏫</div>
        <p className="text-2xl mb-3 font-semibold">등록된 교사가 없습니다</p>
        <p className="text-lg text-gray-400 mb-8">새 교사를 추가하거나 JSON 파일을 업로드해주세요</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[500px] overflow-y-auto">
      {teachers.map((teacher, index) => (
        <div key={index} className="flex items-center justify-between p-5 bg-gray-50 rounded-xl border border-gray-200 hover:shadow-md hover:bg-white transition-all">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-3">
              <h4 className="text-xl font-semibold text-gray-800">{teacher.name}</h4>
            </div>
            
            <div className="flex items-center gap-6">
              <div>
                <span className="text-base text-gray-600">담당 과목: </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {teacher.subjects.length > 0 ? teacher.subjects.map((subject, subjectIndex) => {
                    const subjectData = data.subjects?.find(s => s.name === subject);
                    const isCreative = subjectData?.category === '창의적 체험활동';
                    return (
                      <span 
                        key={subjectIndex}
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          isCreative 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {subject}
                        {isCreative && <span className="ml-1 text-xs">🎨</span>}
                      </span>
                    );
                  }) : (
                    <span className="text-gray-400 text-sm">담당 과목 없음</span>
                  )}
                </div>
              </div>
              
              <div>
                <span className="text-base text-gray-600">수업 불가: </span>
                <span className="text-lg font-semibold text-red-600">
                  {(teacher.unavailable || []).length}개 시간
                </span>
              </div>
              
              <div>
                <span className="text-base text-gray-600">최대 시수: </span>
                <span className="text-lg font-semibold text-blue-600">
                  {teacher.maxHours || 25}시간/주
                </span>
              </div>
              
              <div>
                <span className="text-base text-gray-600">메인 수업 시수: </span>
                <span className="text-lg font-semibold text-blue-600">
                  {Object.values(teacher.weeklyHoursByGrade || {}).reduce((sum, hours) => sum + hours, 0)}시간
                </span>
                {Object.keys(teacher.weeklyHoursByGrade || {}).length > 0 && (
                  <div className="mt-1 text-xs text-gray-500">
                    {Object.entries(teacher.weeklyHoursByGrade || {})
                      .filter(([_, hours]) => hours > 0)
                      .map(([className, hours]) => `${className}: ${hours}시간`)
                      .join(', ')}
                  </div>
                )}
              </div>
              
              <div>
                <span className="text-base text-gray-600">창의적 체험활동: </span>
                <span className="text-lg font-semibold text-green-600">
                  {(() => {
                    const creativeSubjects = data.subjects?.filter(subject => subject.category === '창의적 체험활동') || [];
                    return creativeSubjects.reduce((sum, subject) => {
                      return sum + (teacher.subjectHours?.[subject.name] || 0);
                    }, 0);
                  })()}시간
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 ml-6">
            <button 
              className="bg-blue-500 text-white px-4 py-3 rounded-lg text-base font-semibold hover:bg-blue-600 hover:shadow-lg transition-all"
              onClick={() => onEdit(teacher, index)}
            >
              편집
            </button>
            <button 
              className="bg-red-500 text-white px-4 py-3 rounded-lg text-base font-semibold hover:bg-red-600 hover:shadow-lg transition-all"
              onClick={() => onRemove(index)}
            >
              삭제
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// 교사 추가 폼 컴포넌트
export const AddTeacherModal = ({ isOpen, onClose, newTeacher, setNewTeacher, subjects, onAdd, days, maxPeriods, addUnavailableTime, removeUnavailableTime, isTimeUnavailable, teachers, data }) => {
  const toggleSubject = (subjectName) => {
    const updatedSubjects = newTeacher.subjects.includes(subjectName)
      ? newTeacher.subjects.filter(s => s !== subjectName)
      : [...newTeacher.subjects, subjectName];
    setNewTeacher({ ...newTeacher, subjects: updatedSubjects });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-gray-800">
              ➕ 새 교사 추가
            </h3>
            <button 
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              onClick={onClose}
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
              value={newTeacher.name}
              onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
              className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
              placeholder="교사명을 입력하세요"
            />
          </div>

          {/* 담당 과목 설정 */}
          <div>
            <h4 className="text-xl font-semibold text-gray-800 mb-4">📚 담당 과목 설정</h4>
            <div className="bg-gray-50 p-6 rounded-xl border-2 border-gray-200">
              {/* 메인 수업 (교과과목) */}
              <div className="mb-6">
                <h5 className="text-lg font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <span className="text-2xl">📚</span>
                  메인 수업 (교과과목)
                </h5>
                <div className="space-y-4">
                  {subjects?.filter(subject => subject.category === '교과과목').map((subject, index) => {
                    const isSelected = newTeacher.subjects.includes(subject.name);
                    const subjectHours = newTeacher.subjectHours?.[subject.name] || 0;
                    
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
                              onChange={() => toggleSubject(subject.name)}
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
                                  const updatedSubjectHours = { ...newTeacher.subjectHours };
                                  updatedSubjectHours[subject.name] = parseInt(e.target.value) || 0;
                                  setNewTeacher({ ...newTeacher, subjectHours: updatedSubjectHours });
                                }}
                                className="w-20 px-3 py-2 border border-gray-300 rounded text-center"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 창의적 체험활동 */}
              <div>
                <h5 className="text-lg font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <span className="text-2xl">🎨</span>
                  창의적 체험활동
                </h5>
                <div className="space-y-4">
                  {subjects?.filter(subject => subject.category === '창의적 체험활동').map((subject, index) => {
                    const isSelected = newTeacher.subjects.includes(subject.name);
                    const subjectHours = newTeacher.subjectHours?.[subject.name] || 0;
                    
                    return (
                      <div key={index} className={`p-4 rounded-lg border-2 transition-all ${
                        isSelected 
                          ? 'bg-white border-green-300 shadow-md' 
                          : 'bg-gray-100 border-gray-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSubject(subject.name)}
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
                                  const updatedSubjectHours = { ...newTeacher.subjectHours };
                                  updatedSubjectHours[subject.name] = parseInt(e.target.value) || 0;
                                  setNewTeacher({ ...newTeacher, subjectHours: updatedSubjectHours });
                                }}
                                className="w-20 px-3 py-2 border border-gray-300 rounded text-center"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 학급별 주간시수 설정 */}
          <div>
            <h4 className="text-xl font-semibold text-gray-800 mb-4">📊 학급별 주간시수 설정 (메인 수업)</h4>
            <div className="bg-blue-50 p-6 rounded-xl border-2 border-blue-200">
              <p className="text-base text-gray-600 mb-4">각 학급별로 담당할 메인 수업(교과과목)의 주간 시수를 설정하세요. 창의적 체험활동은 제외됩니다.</p>
              
              {/* 학년별로 그룹화된 학급 설정 */}
              {(() => {
                const classNames = generateClassNames(data);
                const gradeGroups = {};
                
                // 학년별로 학급 그룹화
                classNames.forEach(className => {
                  const grade = className.split('학년')[0];
                  if (!gradeGroups[grade]) {
                    gradeGroups[grade] = [];
                  }
                  gradeGroups[grade].push(className);
                });
                
                return (
                  <div className="space-y-6">
                    {Object.entries(gradeGroups).map(([grade, classes]) => (
                      <div key={grade} className="bg-white p-4 rounded-lg border border-blue-200">
                        <h5 className="text-lg font-semibold text-blue-800 mb-3 flex items-center gap-2">
                          <span className="text-2xl">📚</span>
                          {grade}학년 ({classes.length}개 반)
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {classes.map((className) => (
                            <div key={className} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <label className="font-semibold text-gray-800 text-sm">{className}</label>
                                <span className="text-xs text-gray-500">
                                  {newTeacher.weeklyHoursByGrade?.[className] || 0}시간
                                </span>
                              </div>
                              <input
                                type="number"
                                min="0"
                                max="10"
                                value={newTeacher.weeklyHoursByGrade?.[className] || 0}
                                onChange={(e) => {
                                  const updatedWeeklyHours = { ...newTeacher.weeklyHoursByGrade };
                                  updatedWeeklyHours[className] = parseInt(e.target.value) || 0;
                                  setNewTeacher({ ...newTeacher, weeklyHoursByGrade: updatedWeeklyHours });
                                }}
                                className="w-full px-3 py-2 border border-blue-300 rounded text-center focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                placeholder="0"
                              />
                            </div>
                          ))}
                        </div>
                        {/* 학년별 총 시수 */}
                        <div className="mt-3 p-2 bg-blue-100 rounded-lg">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-blue-800 font-semibold">{grade}학년 총 시수:</span>
                            <span className="text-blue-800 font-bold">
                              {classes.reduce((sum, className) => sum + (newTeacher.weeklyHoursByGrade?.[className] || 0), 0)}시간
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              
              {/* 전체 요약 */}
              <div className="mt-6 p-4 bg-blue-100 rounded-lg border border-blue-300">
                <div className="flex justify-between items-center text-base">
                  <span className="text-blue-800 font-semibold">전체 학급 총 설정 시수:</span>
                  <span className="text-blue-800 font-bold text-lg">
                    {Object.values(newTeacher.weeklyHoursByGrade || {}).reduce((sum, hours) => sum + hours, 0)}시간
                  </span>
                </div>
                <div className="mt-2 text-sm text-blue-700">
                  메인 수업 시수: {(() => {
                    const mainSubjects = data.subjects?.filter(subject => subject.category === '교과과목') || [];
                    return mainSubjects.reduce((sum, subject) => {
                      return sum + (newTeacher.subjectHours?.[subject.name] || 0);
                    }, 0);
                  })()}시간
                </div>
                <div className="mt-1 text-sm text-green-700">
                  창의적 체험활동 시수: {(() => {
                    const creativeSubjects = data.subjects?.filter(subject => subject.category === '창의적 체험활동') || [];
                    return creativeSubjects.reduce((sum, subject) => {
                      return sum + (newTeacher.subjectHours?.[subject.name] || 0);
                    }, 0);
                  })()}시간
                </div>
              </div>
              
              {/* 설정 팁 */}
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <h6 className="text-sm font-semibold text-yellow-800 mb-2">💡 설정 팁</h6>
                <ul className="text-xs text-yellow-700 space-y-1">
                  <li>• 학급별 시수는 해당 학급에서 담당할 메인 수업(교과과목) 시간입니다</li>
                  <li>• 창의적 체험활동(동아리, 스포츠, 진로)은 별도로 관리됩니다</li>
                  <li>• 과목별 시수와 학급별 시수가 일치하도록 설정하세요</li>
                  <li>• 0으로 설정하면 해당 학급을 담당하지 않습니다</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 수업 불가 시간 설정 */}
          <div>
            <h4 className="text-xl font-semibold text-gray-800 mb-4">⏰ 수업 불가 시간 설정</h4>
            <div className="bg-red-50 p-6 rounded-xl border-2 border-red-200">
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
                          const isAvailable = true; // 새 교사는 모든 시간이 기본적으로 가능
                          const isUnavailable = isTimeUnavailable(newTeacher, day, periodIndex + 1);
                          
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
                                    removeUnavailableTime(newTeacher, day, periodIndex + 1);
                                  } else {
                                    addUnavailableTime(newTeacher, day, periodIndex + 1);
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
              </div>

              {/* 현재 설정된 수업 불가 시간 요약 */}
              {(newTeacher.unavailable || []).length > 0 && (
                <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
                  <h5 className="font-semibold text-red-800 mb-2">
                    현재 설정된 수업 불가 시간 ({(newTeacher.unavailable || []).length}개)
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {(newTeacher.unavailable || []).map(([day, period], index) => (
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


        </div>

        {/* 모달 하단 버튼 */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 rounded-b-2xl">
          <div className="flex gap-4 justify-end">
            <button 
              className="bg-gray-500 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-600 transition-all"
              onClick={onClose}
            >
              취소
            </button>
            <button 
              className="bg-blue-500 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-blue-600 transition-all"
              onClick={() => {
                onAdd();
                onClose();
              }}
            >
              교사 추가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 교사 편집 모달 컴포넌트
export const EditTeacherModal = ({ isOpen, onClose, editingTeacher, setEditingTeacher, subjects, onSave, days, maxPeriods, addUnavailableTime, removeUnavailableTime, isTimeUnavailable, data }) => {
  const toggleSubject = (subjectName) => {
    const updatedSubjects = editingTeacher.subjects.includes(subjectName)
      ? editingTeacher.subjects.filter(s => s !== subjectName)
      : [...editingTeacher.subjects, subjectName];
    setEditingTeacher({ ...editingTeacher, subjects: updatedSubjects });
  };

  if (!isOpen || !editingTeacher) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-gray-800">
              ✏️ 교사 정보 편집
            </h3>
            <button 
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              onClick={onClose}
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
              placeholder="교사명을 입력하세요"
            />
          </div>

          {/* 담당 과목 설정 */}
          <div>
            <h4 className="text-xl font-semibold text-gray-800 mb-4">📚 담당 과목 설정</h4>
            <div className="bg-gray-50 p-6 rounded-xl border-2 border-gray-200">
              {/* 메인 수업 (교과과목) */}
              <div className="mb-6">
                <h5 className="text-lg font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <span className="text-2xl">📚</span>
                  메인 수업 (교과과목)
                </h5>
                <div className="space-y-4">
                  {subjects?.filter(subject => subject.category === '교과과목').map((subject, index) => {
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
                              onChange={() => toggleSubject(subject.name)}
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
                                  const updatedSubjectHours = { ...editingTeacher.subjectHours };
                                  updatedSubjectHours[subject.name] = parseInt(e.target.value) || 0;
                                  setEditingTeacher({ ...editingTeacher, subjectHours: updatedSubjectHours });
                                }}
                                className="w-20 px-3 py-2 border border-gray-300 rounded text-center"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 창의적 체험활동 */}
              <div>
                <h5 className="text-lg font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <span className="text-2xl">🎨</span>
                  창의적 체험활동
                </h5>
                <div className="space-y-4">
                  {subjects?.filter(subject => subject.category === '창의적 체험활동').map((subject, index) => {
                    const isSelected = editingTeacher.subjects.includes(subject.name);
                    const subjectHours = editingTeacher.subjectHours?.[subject.name] || 0;
                    
                    return (
                      <div key={index} className={`p-4 rounded-lg border-2 transition-all ${
                        isSelected 
                          ? 'bg-white border-green-300 shadow-md' 
                          : 'bg-gray-100 border-gray-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSubject(subject.name)}
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
                                  const updatedSubjectHours = { ...editingTeacher.subjectHours };
                                  updatedSubjectHours[subject.name] = parseInt(e.target.value) || 0;
                                  setEditingTeacher({ ...editingTeacher, subjectHours: updatedSubjectHours });
                                }}
                                className="w-20 px-3 py-2 border border-gray-300 rounded text-center"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 학급별 주간시수 설정 */}
          <div>
            <h4 className="text-xl font-semibold text-gray-800 mb-4">📊 학급별 주간시수 설정 (메인 수업)</h4>
            <div className="bg-blue-50 p-6 rounded-xl border-2 border-blue-200">
              <p className="text-base text-gray-600 mb-4">각 학급별로 담당할 메인 수업(교과과목)의 주간 시수를 설정하세요. 창의적 체험활동은 제외됩니다.</p>
              
              {/* 학년별로 그룹화된 학급 설정 */}
              {(() => {
                const classNames = generateClassNames(data);
                const gradeGroups = {};
                
                // 학년별로 학급 그룹화
                classNames.forEach(className => {
                  const grade = className.split('학년')[0];
                  if (!gradeGroups[grade]) {
                    gradeGroups[grade] = [];
                  }
                  gradeGroups[grade].push(className);
                });
                
                return (
                  <div className="space-y-6">
                    {Object.entries(gradeGroups).map(([grade, classes]) => (
                      <div key={grade} className="bg-white p-4 rounded-lg border border-blue-200">
                        <h5 className="text-lg font-semibold text-blue-800 mb-3 flex items-center gap-2">
                          <span className="text-2xl">📚</span>
                          {grade}학년 ({classes.length}개 반)
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {classes.map((className) => (
                            <div key={className} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <label className="font-semibold text-gray-800 text-sm">{className}</label>
                                <span className="text-xs text-gray-500">
                                  {editingTeacher.weeklyHoursByGrade?.[className] || 0}시간
                                </span>
                              </div>
                              <input
                                type="number"
                                min="0"
                                max="10"
                                value={editingTeacher.weeklyHoursByGrade?.[className] || 0}
                                onChange={(e) => {
                                  const updatedWeeklyHours = { ...editingTeacher.weeklyHoursByGrade };
                                  updatedWeeklyHours[className] = parseInt(e.target.value) || 0;
                                  setEditingTeacher({ ...editingTeacher, weeklyHoursByGrade: updatedWeeklyHours });
                                }}
                                className="w-full px-3 py-2 border border-blue-300 rounded text-center focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                placeholder="0"
                              />
                            </div>
                          ))}
                        </div>
                        {/* 학년별 총 시수 */}
                        <div className="mt-3 p-2 bg-blue-100 rounded-lg">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-blue-800 font-semibold">{grade}학년 총 시수:</span>
                            <span className="text-blue-800 font-bold">
                              {classes.reduce((sum, className) => sum + (editingTeacher.weeklyHoursByGrade?.[className] || 0), 0)}시간
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              
              {/* 전체 요약 */}
              <div className="mt-6 p-4 bg-blue-100 rounded-lg border border-blue-300">
                <div className="flex justify-between items-center text-base">
                  <span className="text-blue-800 font-semibold">전체 학급 총 설정 시수:</span>
                  <span className="text-blue-800 font-bold text-lg">
                    {Object.values(editingTeacher.weeklyHoursByGrade || {}).reduce((sum, hours) => sum + hours, 0)}시간
                  </span>
                </div>
                <div className="mt-2 text-sm text-blue-700">
                  메인 수업 시수: {(() => {
                    const mainSubjects = data.subjects?.filter(subject => subject.category === '교과과목') || [];
                    return mainSubjects.reduce((sum, subject) => {
                      return sum + (editingTeacher.subjectHours?.[subject.name] || 0);
                    }, 0);
                  })()}시간
                </div>
                <div className="mt-1 text-sm text-green-700">
                  창의적 체험활동 시수: {(() => {
                    const creativeSubjects = data.subjects?.filter(subject => subject.category === '창의적 체험활동') || [];
                    return creativeSubjects.reduce((sum, subject) => {
                      return sum + (editingTeacher.subjectHours?.[subject.name] || 0);
                    }, 0);
                  })()}시간
                </div>
              </div>
              
              {/* 설정 팁 */}
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <h6 className="text-sm font-semibold text-yellow-800 mb-2">💡 설정 팁</h6>
                <ul className="text-xs text-yellow-700 space-y-1">
                  <li>• 학급별 시수는 해당 학급에서 담당할 메인 수업(교과과목) 시간입니다</li>
                  <li>• 창의적 체험활동(동아리, 스포츠, 진로)은 별도로 관리됩니다</li>
                  <li>• 과목별 시수와 학급별 시수가 일치하도록 설정하세요</li>
                  <li>• 0으로 설정하면 해당 학급을 담당하지 않습니다</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 수업 불가 시간 설정 */}
          <div>
            <h4 className="text-xl font-semibold text-gray-800 mb-4">⏰ 수업 불가 시간 설정</h4>
            <div className="bg-red-50 p-6 rounded-xl border-2 border-red-200">
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
                          const isUnavailable = isTimeUnavailable(editingTeacher, day, periodIndex + 1);
                          
                          return (
                            <td key={day} className="p-2 border-r border-gray-300 last:border-r-0">
                              <button
                                className={`w-full h-12 rounded-lg text-base font-semibold transition-all ${
                                  isUnavailable
                                    ? 'bg-red-200 text-red-800 hover:bg-red-300 border-2 border-red-400'
                                    : 'bg-green-100 text-green-800 hover:bg-green-200 border-2 border-green-300'
                                }`}
                                onClick={() => {
                                  if (isUnavailable) {
                                    removeUnavailableTime(editingTeacher, day, periodIndex + 1);
                                  } else {
                                    addUnavailableTime(editingTeacher, day, periodIndex + 1);
                                  }
                                }}
                              >
                                {isUnavailable ? '불가' : '가능'}
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
              </div>

              {/* 현재 설정된 수업 불가 시간 요약 */}
              {(editingTeacher.unavailable || []).length > 0 && (
                <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
                  <h5 className="font-semibold text-red-800 mb-2">
                    현재 설정된 수업 불가 시간 ({(editingTeacher.unavailable || []).length}개)
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {(editingTeacher.unavailable || []).map(([day, period], index) => (
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
        </div>

        {/* 모달 하단 버튼 */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 rounded-b-2xl">
          <div className="flex gap-4 justify-end">
            <button 
              className="bg-gray-500 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-600 transition-all"
              onClick={onClose}
            >
              취소
            </button>
            <button 
              className="bg-blue-500 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-blue-600 transition-all"
              onClick={() => {
                onSave();
                onClose();
              }}
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 통계 카드 컴포넌트
export const StatisticsCards = ({ teachers, data }) => {
  const totalWeeklyHours = teachers.reduce((sum, teacher) => {
    return sum + Object.values(teacher.weeklyHoursByGrade || {}).reduce((classSum, hours) => classSum + hours, 0);
  }, 0);

  const teachersWithWeeklyHours = teachers.filter(teacher => 
    Object.keys(teacher.weeklyHoursByGrade || {}).length > 0
  );

  const averageWeeklyHours = teachersWithWeeklyHours.length > 0 
    ? Math.round(totalWeeklyHours / teachersWithWeeklyHours.length * 10) / 10 
    : 0;

  const totalMainSubjectHours = teachers.reduce((sum, teacher) => {
    const mainSubjects = data.subjects?.filter(subject => subject.category === '교과과목') || [];
    return sum + mainSubjects.reduce((subjectSum, subject) => {
      return subjectSum + (teacher.subjectHours?.[subject.name] || 0);
    }, 0);
  }, 0);

  const totalCreativeSubjectHours = teachers.reduce((sum, teacher) => {
    const creativeSubjects = data.subjects?.filter(subject => subject.category === '창의적 체험활동') || [];
    return sum + creativeSubjects.reduce((subjectSum, subject) => {
      return subjectSum + (teacher.subjectHours?.[subject.name] || 0);
    }, 0);
  }, 0);

  const mainSubjectCount = teachers.reduce((sum, teacher) => {
    const mainSubjects = data.subjects?.filter(subject => subject.category === '교과과목') || [];
    return sum + mainSubjects.filter(subject => teacher.subjects.includes(subject.name)).length;
  }, 0);

  const creativeSubjectCount = teachers.reduce((sum, teacher) => {
    const creativeSubjects = data.subjects?.filter(subject => subject.category === '창의적 체험활동') || [];
    return sum + creativeSubjects.filter(subject => teacher.subjects.includes(subject.name)).length;
  }, 0);

  return (
    <div className="flex flex-wrap gap-8 mb-12 justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[240px] text-center border border-blue-100 hover:shadow-xl transition-shadow">
        <div className="text-4xl font-bold text-blue-600 mb-3">{teachers.length}</div>
        <div className="text-lg text-gray-700 font-semibold">등록된 교사</div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[240px] text-center border border-blue-100 hover:shadow-xl transition-shadow">
        <div className="text-4xl font-bold text-blue-600 mb-3">{mainSubjectCount}</div>
        <div className="text-lg text-gray-700 font-semibold">메인 수업 담당</div>
        <div className="text-sm text-gray-500 mt-1">교과과목</div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[240px] text-center border border-green-100 hover:shadow-xl transition-shadow">
        <div className="text-4xl font-bold text-green-600 mb-3">{creativeSubjectCount}</div>
        <div className="text-lg text-gray-700 font-semibold">창의적 체험활동</div>
        <div className="text-sm text-gray-500 mt-1">동아리, 스포츠, 진로</div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[240px] text-center border border-indigo-100 hover:shadow-xl transition-shadow">
        <div className="text-4xl font-bold text-indigo-600 mb-3">{totalWeeklyHours}</div>
        <div className="text-lg text-gray-700 font-semibold">총 메인 수업 시수</div>
        <div className="text-sm text-gray-500 mt-1">평균 {averageWeeklyHours}시간/교사</div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[240px] text-center border border-teal-100 hover:shadow-xl transition-shadow">
        <div className="text-4xl font-bold text-teal-600 mb-3">{teachersWithWeeklyHours.length}</div>
        <div className="text-lg text-gray-700 font-semibold">메인 수업 시수 설정</div>
        <div className="text-sm text-gray-500 mt-1">{teachers.length > 0 ? Math.round(teachersWithWeeklyHours.length / teachers.length * 100) : 0}%</div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[240px] text-center border border-orange-100 hover:shadow-xl transition-shadow">
        <div className="text-4xl font-bold text-orange-600 mb-3">
          {teachers.reduce((sum, teacher) => sum + (teacher.unavailable || []).length, 0)}
        </div>
        <div className="text-lg text-gray-700 font-semibold">수업불가 시간</div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[240px] text-center border border-purple-100 hover:shadow-xl transition-shadow">
        <div className="text-4xl font-bold text-purple-600 mb-3">
          {teachers.filter(t => t.allow_parallel).length}
        </div>
        <div className="text-lg text-gray-700 font-semibold">동시수업 가능</div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[240px] text-center border border-yellow-100 hover:shadow-xl transition-shadow">
        <div className="text-4xl font-bold text-yellow-600 mb-3">{totalMainSubjectHours}</div>
        <div className="text-lg text-gray-700 font-semibold">총 메인 수업 시수</div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[240px] text-center border border-green-100 hover:shadow-xl transition-shadow">
        <div className="text-4xl font-bold text-green-600 mb-3">{totalCreativeSubjectHours}</div>
        <div className="text-lg text-gray-700 font-semibold">총 창의적 체험활동</div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[240px] text-center border border-red-100 hover:shadow-xl transition-shadow">
        <div className="text-4xl font-bold text-red-600 mb-3">
          {teachers.reduce((sum, teacher) => sum + (teacher.mutual_exclusions || []).length, 0)}
        </div>
        <div className="text-lg text-gray-700 font-semibold">동시수업 제한</div>
      </div>
    </div>
  );
}; 