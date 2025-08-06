import React from 'react';
import { useTeacherSettings } from './TeacherSettingsCore';
import { TeacherList, AddTeacherModal, EditTeacherModal, StatisticsCards } from './TeacherSettingsUI';

function TeacherSettings({ data, updateData, nextStep, prevStep }) {
  const {
    teachers,
    newTeacher,
    setNewTeacher,
    editingTeacher,
    setEditingTeacher,
    editingIndex,
    isAddModalOpen,
    days,
    maxPeriods,
    addTeacher,
    updateTeacher,
    removeTeacher,
    openEditModal,
    closeEditModal,
    openAddModal,
    closeAddModal,
    saveEditedTeacher,
    addUnavailableTime,
    removeUnavailableTime,
    isTimeUnavailable,
    addUnavailableTimeForNew,
    removeUnavailableTimeForNew,
    isTimeUnavailableForNew,
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
        <StatisticsCards teachers={teachers} data={data} />

        {/* 메인 컨텐츠 */}
        <div className="space-y-8 mb-12">
          {/* 교사 목록 */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <span className="text-4xl">📋</span>
                <h3 className="text-2xl font-bold text-gray-800">등록된 교사 목록</h3>
              </div>
              
              {/* 버튼 그룹 */}
              <div className="flex items-center gap-3">
                <button
                  onClick={openAddModal}
                  className="bg-blue-500 text-white px-4 py-3 rounded-lg text-base font-semibold hover:bg-blue-600 hover:shadow-lg transition-all"
                >
                  ➕ 교사 추가
                </button>
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
              data={data}
            />
          </div>
        </div>

        {/* 추가 모달 */}
        <AddTeacherModal
          isOpen={isAddModalOpen}
          onClose={closeAddModal}
          data={data}
          newTeacher={newTeacher}
          setNewTeacher={setNewTeacher}
          subjects={data.subjects}
          onAdd={addTeacher}
          days={days}
          maxPeriods={maxPeriods}
          addUnavailableTime={addUnavailableTimeForNew}
          removeUnavailableTime={removeUnavailableTimeForNew}
          isTimeUnavailable={isTimeUnavailableForNew}
          teachers={teachers}
        />

        {/* 편집 모달 */}
        <EditTeacherModal
          isOpen={editingTeacher !== null}
          onClose={closeEditModal}
          data={data}
          editingTeacher={editingTeacher}
          setEditingTeacher={setEditingTeacher}
          subjects={data.subjects}
          onSave={saveEditedTeacher}
          days={days}
          maxPeriods={maxPeriods}
          addUnavailableTime={addUnavailableTime}
          removeUnavailableTime={removeUnavailableTime}
          isTimeUnavailable={isTimeUnavailable}
        />

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
    </div>
  );
}

export default TeacherSettings; 