import React, { useState, useEffect } from 'react';
import StartScreen from './components/StartScreen';
import BasicSettings from './components/BasicSettings';
import SubjectSettings from './components/SubjectSettings';
import TeacherSettings from './components/TeacherSettings';
import ConstraintSettings from './components/ConstraintSettings';
import FixedClassSettings from './components/FixedClassSettings';
import FinalReview from './components/review/FinalReview';
import TimetableGeneration from './components/TimetableGenerationUI.tsx';
import ReviewAndExport from './components/ReviewAndExport';

const STEPS = [
  { id: 0, name: '시작', component: StartScreen, icon: '🚀', description: '시간표 제작을 시작합니다' },
  { id: 1, name: '기본 설정', component: BasicSettings, icon: '⚙️', description: '학년, 학급, 교시 설정' },
  { id: 2, name: '과목 설정', component: SubjectSettings, icon: '📚', description: '과목별 시수 및 제약조건' },
  { id: 3, name: '교사 설정', component: TeacherSettings, icon: '👨‍🏫', description: '교사별 담당 과목 설정' },
  { id: 4, name: '제약 조건', component: ConstraintSettings, icon: '🎯', description: '시간표 생성 제약조건' },
  { id: 5, name: '고정 수업', component: FixedClassSettings, icon: '📌', description: '고정할 수업 시간 설정' },
  { id: 6, name: '최종 확인', component: FinalReview, icon: '✅', description: '설정 내용 최종 확인' },
  { id: 7, name: '시간표 생성', component: TimetableGeneration, icon: '🎲', description: '자동 시간표 생성' },
  { id: 8, name: '검토 및 내보내기', component: ReviewAndExport, icon: '📊', description: '완성된 시간표 검토 및 저장' }
];

function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState({
    base: {
      grades: 3,
      classes_per_grade: [4, 4, 4], // 각 학년별 학급 수 배열로 변경
      periods_per_day: {
        '월': 6,
        '화': 6,
        '수': 6,
        '목': 6,
        '금': 6
      }
    },
    subjects: [],
    teachers: [],
    constraints: {
      must: [],
      optional: []
    },
    fixedClasses: [],
    classWeeklyHours: {},
    schedule: {},
    metadata: {
      created_at: new Date().toISOString(),
      last_modified: new Date().toISOString()
    }
  });

  // 로컬 스토리지에서 데이터 로드
  useEffect(() => {
    const savedData = localStorage.getItem('timetable-data');
    const savedStep = localStorage.getItem('timetable-step');
    
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        // 기존 데이터 구조 호환성 체크
        if (typeof parsedData.base.classes_per_grade === 'number') {
          // 기존 단일 값을 배열로 변환
          const singleValue = parsedData.base.classes_per_grade;
          parsedData.base.classes_per_grade = Array(parsedData.base.grades).fill(singleValue);
        }
        setData(parsedData);
      } catch (error) {
        console.error('저장된 데이터 로드 실패:', error);
      }
    }
    
    if (savedStep) {
      setCurrentStep(parseInt(savedStep));
    }
  }, []);

  // 데이터 변경 시 로컬 스토리지에 저장
  useEffect(() => {
    localStorage.setItem('timetable-data', JSON.stringify(data));
    localStorage.setItem('timetable-step', currentStep.toString());
  }, [data, currentStep]);

  const updateData = (section, newData) => {
    setData(prev => ({
      ...prev,
      [section]: newData,
      metadata: {
        ...prev.metadata,
        last_modified: new Date().toISOString()
      }
    }));
  };

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step) => {
    setCurrentStep(step);
  };

  const resetData = () => {
    setData({
      base: {
        grades: 3,
        classes_per_grade: [4, 4, 4], // 배열로 초기화
        periods_per_day: {
          '월': 6,
          '화': 6,
          '수': 6,
          '목': 6,
          '금': 6
        }
      },
      subjects: [],
      teachers: [],
      constraints: {
        must: [],
        optional: []
      },
      fixedClasses: [],
      classWeeklyHours: {},
      schedule: {},
      metadata: {
        created_at: new Date().toISOString(),
        last_modified: new Date().toISOString()
      }
    });
    setCurrentStep(0);
    localStorage.removeItem('timetable-data');
    localStorage.removeItem('timetable-step');
  };

  const loadFromJSON = (jsonData) => {
    try {
      const parsedData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      
      // 전체 설정 JSON 파일인지 확인 (metadata가 있는 경우)
      if (parsedData.metadata && parsedData.metadata.description === "시간표 생성기 전체 설정 데이터") {
        // 전체 설정 파일인 경우 - 모든 데이터를 로드하고 5단계로 이동
        const fullSettings = {
          base: parsedData.base || data.base,
          subjects: parsedData.subjects || [],
          teachers: parsedData.teachers || [],
          constraints: parsedData.constraints || { must: [], optional: [] },
          fixedClasses: parsedData.fixedClasses || [],
          classWeeklyHours: parsedData.classWeeklyHours || {},
          schedule: {},
          metadata: {
            created_at: new Date().toISOString(),
            last_modified: new Date().toISOString(),
            imported_from: parsedData.metadata.exportDate
          }
        };
        
        // 기존 데이터 구조 호환성 체크
        if (typeof fullSettings.base.classes_per_grade === 'number') {
          const singleValue = fullSettings.base.classes_per_grade;
          fullSettings.base.classes_per_grade = Array(fullSettings.base.grades).fill(singleValue);
        }
        
        setData(fullSettings);
        setCurrentStep(6); // 최종 확인 단계로 이동
        alert(`전체 설정을 성공적으로 불러왔습니다!\n\n📊 불러온 데이터:\n• 과목: ${fullSettings.subjects.length}개\n• 교사: ${fullSettings.teachers.length}명\n• 제약조건: ${(fullSettings.constraints.must?.length || 0) + (fullSettings.constraints.optional?.length || 0)}개\n• 고정수업: ${fullSettings.fixedClasses.length}개`);
      } else {
        // 기존 형식의 JSON 파일인 경우
        // 기존 데이터 구조 호환성 체크
        if (typeof parsedData.base.classes_per_grade === 'number') {
          const singleValue = parsedData.base.classes_per_grade;
          parsedData.base.classes_per_grade = Array(parsedData.base.grades).fill(singleValue);
        }
        
        setData(parsedData);
        setCurrentStep(1); // 기본 설정부터 시작
      }
    } catch (error) {
      console.error('JSON 로드 실패:', error);
      alert('유효하지 않은 JSON 파일입니다.');
    }
  };

  const CurrentStepComponent = STEPS[currentStep].component;

  // 프로젝트 진행률 계산
  const progressPercentage = ((currentStep + 1) / STEPS.length) * 100;

  // 총 학급 수 계산
  const totalClasses = Array.isArray(data.base.classes_per_grade) 
    ? data.base.classes_per_grade.reduce((sum, count) => sum + count, 0)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* 헤더 */}
      <div className="header">
        <h1>🎓 시간표 제작 시스템</h1>
        <p className="text-lg opacity-90">PC 환경에 최적화된 전문적인 시간표 제작 도구</p>
        
        {/* 진행률 표시 */}
        {currentStep > 0 && (
          <div className="mt-6 max-w-2xl mx-auto">
            <div className="flex justify-between text-sm mb-2">
              <span>진행률</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <div className="w-full bg-white bg-opacity-30 rounded-full h-3">
              <div 
                className="bg-white h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* 메인 레이아웃 */}
      <div className="container">
        {currentStep === 0 ? (
          // 시작 화면은 기존대로 전체 화면 사용
          <CurrentStepComponent
            data={data}
            updateData={updateData}
            nextStep={nextStep}
            prevStep={prevStep}
            goToStep={goToStep}
            resetData={resetData}
            loadFromJSON={loadFromJSON}
          />
        ) : (
          // 나머지 단계는 가로 방향 레이아웃 적용
          <div className="desktop-layout">
            {/* 사이드바 - 단계 표시기 및 요약 정보 */}
            <div className="sidebar">
              <div className="card-header">
                <h3 className="card-title">
                  <span className="card-icon">📋</span>
                  진행 단계
                </h3>
              </div>
              
              {/* 단계 표시기 */}
              <div className="space-y-4 mb-8">
                {STEPS.slice(1).map((step) => {
                  const isActive = step.id === currentStep;
                  const isCompleted = step.id < currentStep;
                  const isPending = step.id > currentStep;
                  
                  return (
                    <div
                      key={step.id}
                      className={`progress-step ${
                        isActive ? 'active' : isCompleted ? 'completed' : 'pending'
                      }`}
                      onClick={() => step.id <= currentStep && goToStep(step.id)}
                      style={{ cursor: step.id <= currentStep ? 'pointer' : 'default' }}
                    >
                      <div className="progress-number">
                        {isCompleted ? '✓' : step.id}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-lg">{step.name}</div>
                        <div className="text-sm opacity-80">{step.description}</div>
                      </div>
                      <div className="text-2xl">{step.icon}</div>
                    </div>
                  );
                })}
              </div>

              {/* 프로젝트 요약 정보 */}
              <div className="section-card">
                <div className="card-header">
                  <h4 className="card-title">
                    <span className="card-icon">📊</span>
                    프로젝트 요약
                  </h4>
                </div>
                <div className="space-y-4">
                  <div className="stat-card">
                    <div className="stat-number">{data.base.grades}</div>
                    <div className="stat-label">학년 수</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-number">{totalClasses}</div>
                    <div className="stat-label">총 학급</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-number">{data.subjects.length}</div>
                    <div className="stat-label">과목 수</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-number">{data.teachers.length}</div>
                    <div className="stat-label">교사 수</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-number">
                      {(data.constraints.must?.length || 0) + (data.constraints.optional?.length || 0)}
                    </div>
                    <div className="stat-label">제약 조건</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-number">{data.fixedClasses.length}</div>
                    <div className="stat-label">고정 수업</div>
                  </div>
                </div>
              </div>

              {/* 빠른 액션 */}
              <div className="mt-8 space-y-4">
                <button 
                  className="btn btn-warning w-full"
                  onClick={resetData}
                >
                  🔄 전체 초기화
                </button>
                <div className="text-center text-sm text-gray-500">
                  마지막 수정: {new Date(data.metadata.last_modified).toLocaleString('ko-KR')}
                </div>
              </div>
            </div>

            {/* 메인 콘텐츠 */}
            <div className="main-content">
              <CurrentStepComponent
                data={data}
                updateData={updateData}
                nextStep={nextStep}
                prevStep={prevStep}
                goToStep={goToStep}
                resetData={resetData}
                loadFromJSON={loadFromJSON}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App; 