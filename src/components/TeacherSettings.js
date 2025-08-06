import React from 'react';
import { useTeacherSettings } from './TeacherSettingsCore';
import { TeacherList, AddTeacherForm, StatisticsCards } from './TeacherSettingsUI';

function TeacherSettings({ data, updateData, nextStep, prevStep }) {
  const {
    teachers,
    newTeacher,
    setNewTeacher,
    editingTeacher,
    setEditingTeacher,
    editingIndex,
    days,
    maxPeriods,
    addTeacher,
    updateTeacher,
    removeTeacher,
    openEditModal,
    closeEditModal,
    saveEditedTeacher,
    addUnavailableTime,
    removeUnavailableTime,
    isTimeUnavailable,
    toggleSubjectInEdit,
    handleFileUpload,
    handleNext
  } = useTeacherSettings(data, updateData);

  const handleNextStep = () => {
    if (handleNext()) {
      nextStep();
    }
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

        {/* 통계 카드들 */}
        <StatisticsCards teachers={teachers} />

        {/* 메인 컨텐츠 */}
        <div className="space-y-8 mb-12">
          {/* 교사 추가 폼 */}
          <AddTeacherForm 
            newTeacher={newTeacher}
            setNewTeacher={setNewTeacher}
            subjects={data.subjects}
            onAdd={addTeacher}
          />

          {/* 교사 목록 */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
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
            
            <TeacherList 
              teachers={teachers}
              onEdit={openEditModal}
              onRemove={removeTeacher}
            />
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
            onClick={handleNextStep}
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
                                    const updatedSubjectHours = { ...editingTeacher.subjectHours };
                                    updatedSubjectHours[subject.name] = parseInt(e.target.value) || 0;
                                    setEditingTeacher({ 
                                      ...editingTeacher, 
                                      subjectHours: updatedSubjectHours 
                                    });
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

              {/* 교사 간 동시 수업 제약조건 설정 */}
              <div>
                <h4 className="text-xl font-semibold text-gray-800 mb-4">🚫 교사 간 동시 수업 제약조건</h4>
                <div className="bg-orange-50 p-6 rounded-xl border-2 border-orange-200">
                  <p className="text-base text-gray-600 mb-4">
                    선택한 교사들과는 동시에 수업할 수 없습니다. (같은 시간대에 다른 학급에서 수업 불가)
                  </p>
                  
                  <div className="space-y-3">
                    {teachers.filter(t => t.name !== editingTeacher.name).map((teacher, index) => {
                      const isExcluded = editingTeacher.mutual_exclusions?.includes(teacher.name) || false;
                      
                      return (
                        <div key={index} className={`p-4 rounded-lg border-2 transition-all ${
                          isExcluded 
                            ? 'bg-white border-orange-300 shadow-md' 
                            : 'bg-gray-100 border-gray-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={isExcluded}
                                onChange={() => {
                                  const currentExclusions = editingTeacher.mutual_exclusions || [];
                                  const updatedExclusions = isExcluded
                                    ? currentExclusions.filter(name => name !== teacher.name)
                                    : [...currentExclusions, teacher.name];
                                  setEditingTeacher({ 
                                    ...editingTeacher, 
                                    mutual_exclusions: updatedExclusions 
                                  });
                                }}
                                className="mr-3 w-5 h-5"
                              />
                              <span className="font-medium text-gray-800">{teacher.name}</span>
                              <span className="ml-2 text-sm text-gray-500">
                                ({teacher.subjects.join(', ')})
                              </span>
                            </div>
                            
                            {isExcluded && (
                              <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                                동시수업 불가
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {editingTeacher.mutual_exclusions && editingTeacher.mutual_exclusions.length > 0 && (
                    <div className="mt-4 p-4 bg-orange-50 rounded-xl border border-orange-200">
                      <h5 className="font-semibold text-orange-800 mb-2">
                        현재 설정된 동시수업 제한 교사 ({editingTeacher.mutual_exclusions.length}명)
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {editingTeacher.mutual_exclusions.map((teacherName, index) => (
                          <span 
                            key={index}
                            className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium"
                          >
                            {teacherName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 학년별 순차 수업 배정 제약조건 설정 */}
              <div>
                <h4 className="text-xl font-semibold text-gray-800 mb-4">📚 학년별 순차 수업 배정 제약조건</h4>
                <div className="bg-purple-50 p-6 rounded-xl border-2 border-purple-200">
                  <p className="text-base text-gray-600 mb-4">
                    이 교사는 여러 학년의 수업을 담당하지만, 학년별로 연속적으로 수업하도록 배정됩니다.
                    <br />
                    <strong>예시:</strong> 1~3교시 2학년, 4~6교시 3학년 ✅ (각 학년 수업이 연속적)
                    <br />
                    <strong>금지:</strong> 1~2교시 2학년, 3교시 3학년, 4~5교시 2학년 ❌ (2학년 수업 중간에 3학년 수업이 끼어있음)
                  </p>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="sequential_grade_teaching"
                      checked={editingTeacher.sequential_grade_teaching || false}
                      onChange={(e) => setEditingTeacher({ 
                        ...editingTeacher, 
                        sequential_grade_teaching: e.target.checked 
                      })}
                      className="mr-3 w-5 h-5"
                    />
                    <label htmlFor="sequential_grade_teaching" className="text-lg font-medium text-gray-800">
                      학년별 순차 수업 배정 적용
                    </label>
                  </div>
                  
                  {editingTeacher.sequential_grade_teaching && (
                    <div className="mt-4 p-4 bg-purple-100 rounded-xl border border-purple-300">
                      <h5 className="font-semibold text-purple-800 mb-2">
                        ⚠️ 주의사항
                      </h5>
                      <ul className="text-sm text-purple-700 space-y-1">
                        <li>• 같은 학년 수업은 가능한 한 연속적으로 배정됩니다</li>
                        <li>• 다른 학년 수업이 그 사이에 끼어들지 않도록 합니다</li>
                        <li>• 학년별 배정 순서는 자유롭게 결정됩니다 (3→2→1 또는 2→1→3 등)</li>
                        <li>• 이 제약조건은 시간표 생성 시간을 늘릴 수 있습니다</li>
                      </ul>
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