import React from 'react';

function StartScreen({ data, resetData, nextStep }) {

  const handleNewTimetable = () => {
    resetData();
    nextStep();
  };

  const hasExistingData = () => {
    return data.subjects.length > 0 || data.teachers.length > 0 || Object.keys(data.schedule).length > 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-8">
      <div className="max-w-7xl w-full">
        {/* 메인 타이틀 */}
        <div className="feature-card text-center mb-12 bg-gradient-to-br from-white to-blue-50 border-2 border-blue-200">
          <h2 className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6">
            🎓 시간표 제작 시스템
          </h2>
          <p className="text-2xl text-gray-600 mb-4">PC 환경에 최적화된 전문적인 시간표 제작 도구</p>
          <p className="text-lg text-gray-500">단계별 가이드를 통해 쉽고 정확한 시간표를 만들어보세요</p>
        </div>
        
        {/* 메인 액션 카드 - 2단 컬럼 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* 새 시간표 만들기 */}
          <div className="feature-card bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 hover:border-emerald-400 transition-all duration-300 transform hover:-translate-y-2">
            <div className="text-center">
              <div className="text-8xl mb-8">✨</div>
              <h3 className="text-3xl font-bold text-emerald-700 mb-6">
                새 시간표 만들기
              </h3>
              <p className="text-gray-600 mb-10 leading-relaxed text-lg">
                처음부터 새로운 시간표를<br />
                단계별로 제작합니다.<br />
                <span className="text-emerald-600 font-semibold text-lg mt-4 block">
                  🚀 8단계 과정으로 완벽한 시간표 완성!
                </span>
              </p>
              <button 
                className="btn btn-success text-xl px-10 py-5 hover:scale-105 transition-transform shadow-xl"
                onClick={handleNewTimetable}
              >
                🚀 새로 시작하기
              </button>
            </div>
          </div>

          {/* 주요 기능 소개 */}
          <div className="feature-card bg-gradient-to-br from-indigo-50 to-purple-100 border-2 border-indigo-200">
            <div className="text-center mb-8">
              <div className="text-8xl mb-6">💡</div>
              <h3 className="text-3xl font-bold text-indigo-700 mb-6">
                주요 기능
              </h3>
            </div>
            <div className="space-y-6">
              {[
                { icon: '⚙️', title: '기본 설정', desc: '학년, 학급, 교시 설정', color: 'blue' },
                { icon: '📚', title: '과목 관리', desc: '과목별 시수 및 제약조건', color: 'emerald' },
                { icon: '👨‍🏫', title: '교사 관리', desc: '교사별 담당 과목 설정', color: 'purple' },
                { icon: '🎯', title: '자동 생성', desc: '조건에 맞는 시간표 생성', color: 'amber' },
                { icon: '📊', title: 'Excel 내보내기', desc: '완성된 시간표 저장', color: 'green' }
              ].map((feature, index) => (
                <div key={index} className="flex items-center p-6 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <span className="text-4xl mr-6">{feature.icon}</span>
                  <div className="flex-1">
                    <div className="font-bold text-gray-800 text-xl mb-2">{feature.title}</div>
                    <div className="text-gray-600 text-lg">{feature.desc}</div>
                  </div>
                  <div className={`w-3 h-3 rounded-full bg-${feature.color}-500`}></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 시스템 정보 */}
        <div className="content-grid mb-12">
          <div className="feature-card bg-gradient-to-br from-amber-50 to-orange-100 border-2 border-amber-200">
            <div className="text-center">
              <div className="text-6xl mb-6">🖥️</div>
              <h3 className="text-2xl font-bold text-amber-700 mb-4">PC 최적화</h3>
              <p className="text-gray-600 text-lg">
                넓은 화면을 활용한 효율적인 레이아웃<br />
                사이드바와 메인 콘텐츠 분리<br />
                마우스와 키보드 최적화
              </p>
            </div>
          </div>

          <div className="feature-card bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200">
            <div className="text-center">
              <div className="text-6xl mb-6">⚡</div>
              <h3 className="text-2xl font-bold text-green-700 mb-4">빠른 작업</h3>
              <p className="text-gray-600 text-lg">
                단계별 진행 상황 실시간 확인<br />
                프로젝트 요약 정보 제공<br />
                빠른 단계 이동 지원
              </p>
            </div>
          </div>

          <div className="feature-card bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200">
            <div className="text-center">
              <div className="text-6xl mb-6">🎨</div>
              <h3 className="text-2xl font-bold text-purple-700 mb-4">직관적 UI</h3>
              <p className="text-gray-600 text-lg">
                현대적이고 깔끔한 디자인<br />
                색상과 아이콘으로 구분<br />
                사용자 친화적 인터페이스
              </p>
            </div>
          </div>
        </div>

        {/* 기존 진행 데이터 감지 */}
        {hasExistingData() && (
          <div className="alert alert-warning max-w-4xl mx-auto">
            <div className="flex items-center mb-6">
              <span className="text-4xl mr-4">🔍</span>
              <h4 className="text-2xl font-bold">진행 중인 작업이 감지되었습니다</h4>
            </div>
            <p className="mb-8 text-gray-700 text-lg">이전에 작업하던 시간표 데이터가 브라우저에 저장되어 있습니다.</p>
            <div className="flex gap-6 justify-center">
              <button 
                className="btn btn-primary px-10 py-4 text-lg"
                onClick={nextStep}
              >
                기존 작업 계속하기
              </button>
              <button 
                className="btn btn-secondary px-10 py-4 text-lg"
                onClick={handleNewTimetable}
              >
                새로 시작하기
              </button>
            </div>
          </div>
        )}

        {/* 푸터 정보 */}
        <div className="text-center mt-12 text-gray-500">
          <p className="text-lg">© 2024 시간표 제작 시스템 - PC 환경에 최적화된 전문 도구</p>
        </div>
      </div>
    </div>
  );
}

export default StartScreen; 