import React, { useRef } from 'react';

function StartScreen({ data, loadFromJSON, resetData, nextStep }) {
  const fileInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonData = JSON.parse(e.target.result);
          loadFromJSON(jsonData);
        } catch (error) {
          alert('유효하지 않은 JSON 파일입니다.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleNewTimetable = () => {
    resetData();
    nextStep();
  };

  const hasExistingData = () => {
    return data.subjects.length > 0 || data.teachers.length > 0 || Object.keys(data.schedule).length > 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-6">
      <div className="max-w-7xl w-full">
        {/* 메인 타이틀 */}
        <div className="feature-card text-center mb-8">
          <h2 className="text-5xl font-bold text-gray-800 mb-4">
            🎓 시간표 제작 시스템
          </h2>
          <p className="text-xl text-gray-600">환영합니다! PC 환경에 최적화된 간편한 시간표 제작 도구입니다</p>
        </div>
        
        {/* 메인 액션 카드 - 3단 컬럼 */}
        <div className="content-grid mb-8">
          {/* JSON 파일 불러오기 */}
          <div className="feature-card bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 hover:border-blue-300 transition-all duration-300">
            <div className="text-center">
              <div className="text-6xl mb-6">📂</div>
              <h3 className="text-2xl font-bold text-blue-700 mb-4">
                기존 시간표 불러오기
              </h3>
              <p className="text-gray-600 mb-8 leading-relaxed">
                이전에 저장한 JSON 파일을 불러와서<br />
                작업을 계속할 수 있습니다.<br />
                <span className="text-sm text-blue-600 font-medium">
                  💡 5단계에서 저장한 전체 설정 파일도 지원됩니다!
                </span>
              </p>
              <button 
                className="btn btn-primary text-lg px-8 py-4 hover:scale-105 transition-transform"
                onClick={() => fileInputRef.current?.click()}
              >
                📁 JSON 파일 선택
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

          {/* 새 시간표 만들기 */}
          <div className="feature-card bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 hover:border-emerald-300 transition-all duration-300">
            <div className="text-center">
              <div className="text-6xl mb-6">✨</div>
              <h3 className="text-2xl font-bold text-emerald-700 mb-4">
                새 시간표 만들기
              </h3>
              <p className="text-gray-600 mb-8 leading-relaxed">
                처음부터 새로운 시간표를<br />
                단계별로 제작합니다.
              </p>
              <button 
                className="btn btn-success text-lg px-8 py-4 hover:scale-105 transition-transform"
                onClick={handleNewTimetable}
              >
                🚀 새로 시작하기
              </button>
            </div>
          </div>

          {/* 주요 기능 소개 */}
          <div className="feature-card bg-gradient-to-br from-indigo-50 to-purple-100 border-2 border-indigo-200">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">💡</div>
              <h3 className="text-2xl font-bold text-indigo-700 mb-4">
                주요 기능
              </h3>
            </div>
            <div className="space-y-4">
              {[
                { icon: '⚙️', title: '기본 설정', desc: '학년, 학급, 교시 설정' },
                { icon: '📚', title: '과목 관리', desc: '과목별 시수 및 제약조건' },
                { icon: '👨‍🏫', title: '교사 관리', desc: '교사별 담당 과목 설정' },
                { icon: '🎯', title: '자동 생성', desc: '조건에 맞는 시간표 생성' },
                { icon: '📊', title: 'Excel 내보내기', desc: '완성된 시간표 저장' }
              ].map((feature, index) => (
                <div key={index} className="flex items-center p-3 bg-white rounded-xl shadow-sm">
                  <span className="text-2xl mr-3">{feature.icon}</span>
                  <div>
                    <div className="font-semibold text-gray-800">{feature.title}</div>
                    <div className="text-sm text-gray-600">{feature.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>



        {/* 기존 진행 데이터 감지 */}
        {hasExistingData() && (
          <div className="alert alert-warning">
            <div className="flex items-center mb-3">
              <span className="text-3xl mr-3">🔍</span>
              <h4 className="text-xl font-semibold">진행 중인 작업이 감지되었습니다</h4>
            </div>
            <p className="mb-6 text-gray-700">이전에 작업하던 시간표 데이터가 브라우저에 저장되어 있습니다.</p>
            <div className="flex gap-4 justify-center">
              <button 
                className="btn btn-primary px-8 py-3"
                onClick={nextStep}
              >
                기존 작업 계속하기
              </button>
              <button 
                className="btn btn-secondary px-8 py-3"
                onClick={handleNewTimetable}
              >
                새로 시작하기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StartScreen; 