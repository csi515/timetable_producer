import React from 'react';

// 교사 목록 컴포넌트
export const TeacherList = ({ teachers, onEdit, onRemove }) => {
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
              
              <div>
                <span className="text-base text-gray-600">동시수업 제한: </span>
                <span className="text-lg font-semibold text-orange-600">
                  {teacher.mutual_exclusions?.length || 0}명
                </span>
              </div>
              
              <div>
                <span className="text-base text-gray-600">학년별 순차: </span>
                <span className="text-lg font-semibold text-purple-600">
                  {teacher.sequential_grade_teaching ? '적용' : '미적용'}
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
export const AddTeacherForm = ({ newTeacher, setNewTeacher, subjects, onAdd }) => {
  const toggleSubject = (subjectName) => {
    const updatedSubjects = newTeacher.subjects.includes(subjectName)
      ? newTeacher.subjects.filter(s => s !== subjectName)
      : [...newTeacher.subjects, subjectName];
    setNewTeacher({ ...newTeacher, subjects: updatedSubjects });
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
      <div className="flex items-center gap-4 mb-6">
        <span className="text-4xl">➕</span>
        <h3 className="text-2xl font-bold text-gray-800">새 교사 추가</h3>
      </div>
      
      <div className="space-y-6">
        {/* 교사명 입력 */}
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-3">교사명</label>
          <input
            type="text"
            value={newTeacher.name}
            onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
            className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
            placeholder="교사명을 입력하세요"
          />
        </div>

        {/* 담당 과목 선택 */}
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-3">담당 과목</label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {subjects?.map((subject, index) => {
              const isSelected = newTeacher.subjects.includes(subject.name);
              return (
                <button
                  key={index}
                  onClick={() => toggleSubject(subject.name)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    isSelected 
                      ? 'bg-blue-50 border-blue-300 text-blue-800 shadow-md' 
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="font-medium">{subject.name}</div>
                  <div className="text-sm text-gray-500">{subject.weekly_hours}시간/주</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 최대 시수 설정 */}
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-3">주간 최대 수업 시수</label>
          <input
            type="number"
            min="1"
            max="40"
            value={newTeacher.maxHours}
            onChange={(e) => setNewTeacher({ ...newTeacher, maxHours: parseInt(e.target.value) || 25 })}
            className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
          />
        </div>

        {/* 동시수업 가능 여부 */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="allow_parallel"
            checked={newTeacher.allow_parallel}
            onChange={(e) => setNewTeacher({ ...newTeacher, allow_parallel: e.target.checked })}
            className="mr-3 w-5 h-5"
          />
          <label htmlFor="allow_parallel" className="text-lg font-medium text-gray-800">
            동시수업 가능 (여러 학급에서 동시에 수업 가능)
          </label>
        </div>

        {/* 추가 버튼 */}
        <button
          onClick={onAdd}
          className="w-full bg-blue-500 text-white py-4 rounded-xl text-xl font-semibold hover:bg-blue-600 hover:shadow-lg transition-all"
        >
          교사 추가
        </button>
      </div>
    </div>
  );
};

// 통계 카드 컴포넌트
export const StatisticsCards = ({ teachers }) => {
  return (
    <div className="flex flex-wrap gap-8 mb-12 justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[240px] text-center border border-blue-100 hover:shadow-xl transition-shadow">
        <div className="text-4xl font-bold text-blue-600 mb-3">{teachers.length}</div>
        <div className="text-lg text-gray-700 font-semibold">등록된 교사</div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[240px] text-center border border-green-100 hover:shadow-xl transition-shadow">
        <div className="text-4xl font-bold text-green-600 mb-3">{teachers.reduce((sum, teacher) => sum + teacher.subjects.length, 0)}</div>
        <div className="text-lg text-gray-700 font-semibold">총 담당 과목</div>
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
      <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[240px] text-center border border-orange-100 hover:shadow-xl transition-shadow">
        <div className="text-4xl font-bold text-orange-600 mb-3">
          {teachers.reduce((sum, teacher) => sum + (teacher.mutual_exclusions?.length || 0), 0)}
        </div>
        <div className="text-lg text-gray-700 font-semibold">동시수업 제한</div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[240px] text-center border border-purple-100 hover:shadow-xl transition-shadow">
        <div className="text-4xl font-bold text-purple-600 mb-3">
          {teachers.filter(t => t.sequential_grade_teaching).length}
        </div>
        <div className="text-lg text-gray-700 font-semibold">학년별 순차</div>
      </div>
    </div>
  );
}; 