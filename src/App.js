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
  { id: 0, name: '시작', component: StartScreen },
  { id: 1, name: '기본 설정', component: BasicSettings },
  { id: 2, name: '과목 설정', component: SubjectSettings },
  { id: 3, name: '교사 설정', component: TeacherSettings },
  { id: 4, name: '제약 조건', component: ConstraintSettings },
  { id: 5, name: '고정 수업', component: FixedClassSettings },
  { id: 6, name: '최종 확인', component: FinalReview },
  { id: 7, name: '시간표 생성', component: TimetableGeneration },
  { id: 8, name: '검토 및 내보내기', component: ReviewAndExport }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* 헤더 */}
      <div className="header">
        <h1>🎓 시간표 제작 시스템</h1>
        <p className="text-lg opacity-90">단계별로 시간표를 제작해보세요</p>
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
              <h3 className="text-xl font-bold mb-6 text-gray-800">📋 진행 단계</h3>
              
              {/* 단계 표시기 */}
              <div className="space-y-3 mb-8">
                {STEPS.slice(1).map((step) => (
                  <div
                    key={step.id}
                    className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 shadow-md ${
                      step.id === currentStep 
                        ? 'bg-blue-500 text-white shadow-lg transform scale-105' 
                        : step.id < currentStep 
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200' 
                          : 'bg-white text-gray-500 border border-gray-200'
                    }`}
                    onClick={() => step.id <= currentStep && goToStep(step.id)}
                    style={{ cursor: step.id <= currentStep ? 'pointer' : 'default' }}
                  >
                    <div className="flex items-center">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-3 ${
                        step.id === currentStep 
                          ? 'bg-white text-blue-500' 
                          : step.id < currentStep 
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-200 text-gray-500'
                      }`}>
                        {step.id < currentStep ? '✓' : step.id}
                      </span>
                      <span className="font-semibold">{step.name}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 프로젝트 요약 정보 */}
              <div className="section-card">
                <h4 className="font-semibold mb-4 text-gray-700 flex items-center">
                  <span className="text-indigo-500 mr-2">📊</span>
                  프로젝트 요약
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                    <span className="text-gray-600">학년 수:</span>
                    <span className="font-semibold text-indigo-600">{data.base.grades}개</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                    <span className="text-gray-600">총 학급:</span>
                    <span className="font-semibold text-indigo-600">
                      {Array.isArray(data.base.classes_per_grade) 
                        ? data.base.classes_per_grade.reduce((sum, count) => sum + count, 0)
                        : 0}개
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                    <span className="text-gray-600">과목 수:</span>
                    <span className="font-semibold text-blue-600">{data.subjects.length}개</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                    <span className="text-gray-600">교사 수:</span>
                    <span className="font-semibold text-emerald-600">{data.teachers.length}명</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                    <span className="text-gray-600">제약 조건:</span>
                    <span className="font-semibold text-purple-600">
                      {(data.constraints.must?.length || 0) + (data.constraints.optional?.length || 0)}개
                    </span>
                  </div>
                </div>
              </div>

              {/* 빠른 액션 */}
              <div className="mt-6 space-y-3">
                <button 
                  className="btn btn-secondary w-full text-sm"
                  onClick={resetData}
                >
                  🔄 전체 초기화
                </button>
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