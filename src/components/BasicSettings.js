import React, { useState, useEffect } from 'react';

function BasicSettings({ data, updateData, nextStep, prevStep }) {
  const [baseSettings, setBaseSettings] = useState(() => {
    // 기존 데이터가 있으면 사용, 없으면 디폴트 값 사용
    if (data.base) {
      return data.base;
    }
    
    // 디폴트 값 설정
    return {
      grades: 3,
      classes_per_grade: [5, 5, 6],
      periods_per_day: {
        '월': 6,
        '화': 7,
        '수': 6,
        '목': 7,
        '금': 6
      }
    };
  });

  const [uploadedFileName, setUploadedFileName] = useState('');

  const days = ['월', '화', '수', '목', '금'];

  // 컴포넌트 마운트 시 디폴트 값 적용
  useEffect(() => {
    if (!data.base) {
      const defaultSettings = {
        grades: 3,
        classes_per_grade: [5, 5, 6],
        periods_per_day: {
          '월': 6,
          '화': 7,
          '수': 6,
          '목': 7,
          '금': 6
        }
      };
      setBaseSettings(defaultSettings);
      updateData('base', defaultSettings);
    }
  }, []);

  // JSON 파일 업로드 처리 함수
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const uploadedData = JSON.parse(e.target.result);
        
        // 데이터 유효성 검사
        if (!uploadedData.base) {
          alert('올바른 설정 파일이 아닙니다. base 설정이 포함되어 있지 않습니다.');
          return;
        }

        // 기존 데이터와 병합 (base는 덮어쓰기, 나머지는 유지)
        const mergedData = {
          ...data,
          ...uploadedData,
          base: uploadedData.base
        };

        // 모든 데이터 업데이트
        Object.keys(mergedData).forEach(key => {
          updateData(key, mergedData[key]);
        });

        // base 설정 업데이트
        setBaseSettings(uploadedData.base);
        setUploadedFileName(file.name);

        alert('설정 파일이 성공적으로 로드되었습니다!');
      } catch (error) {
        console.error('JSON 파싱 오류:', error);
        alert('파일 형식이 올바르지 않습니다. 올바른 JSON 파일을 선택해주세요.');
      }
    };
    reader.readAsText(file);
  };

  // 파일 업로드 버튼 클릭 핸들러
  const handleUploadClick = () => {
    document.getElementById('json-file-input').click();
  };

  const handleChange = (field, value) => {
    let newSettings = { ...baseSettings };
    
    if (field === 'grades') {
      const newGrades = parseInt(value) || 0;
      // 학년 수가 변경되면 학급 수 배열도 조정
      if (newGrades > 0) {
        const currentClasses = baseSettings.classes_per_grade || [];
        const newClasses = Array(newGrades).fill(0).map((_, index) => 
          currentClasses[index] || [5, 5, 6][index] || 5 // 기본값: 1학년 5반, 2학년 5반, 3학년 6반
        );
        newSettings = {
          ...newSettings,
          grades: newGrades,
          classes_per_grade: newClasses
        };
      } else {
        newSettings[field] = newGrades;
      }
    } else {
      newSettings[field] = value;
    }
    
    setBaseSettings(newSettings);
    updateData('base', newSettings);
  };

  const handleClassesChange = (gradeIndex, classCount) => {
    const newClasses = [...baseSettings.classes_per_grade];
    newClasses[gradeIndex] = parseInt(classCount) || 0;
    const newSettings = {
      ...baseSettings,
      classes_per_grade: newClasses
    };
    setBaseSettings(newSettings);
    updateData('base', newSettings);
  };

  const handlePeriodsChange = (day, periods) => {
    const newPeriodsPerDay = {
      ...baseSettings.periods_per_day,
      [day]: parseInt(periods) || 0
    };
    const newSettings = {
      ...baseSettings,
      periods_per_day: newPeriodsPerDay
    };
    setBaseSettings(newSettings);
    updateData('base', newSettings);
  };

  const getTotalPeriods = () => {
    return Object.values(baseSettings.periods_per_day).reduce((sum, periods) => sum + periods, 0);
  };

  const getTotalClasses = () => {
    if (!Array.isArray(baseSettings.classes_per_grade)) {
      return 0;
    }
    return baseSettings.classes_per_grade.reduce((sum, classes) => sum + classes, 0);
  };

  const getTotalWeeklyHours = () => {
    return getTotalClasses() * getTotalPeriods();
  };

  const handleNext = () => {
    if (baseSettings.grades > 0 && getTotalClasses() > 0 && getTotalPeriods() > 0) {
      nextStep();
    } else {
      alert('모든 필수 항목을 입력해주세요.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="flex items-center">
          <span className="mr-3">📚</span>
          기본 설정
        </h2>
        
        {/* 통계 정보 - 4단 그리드 */}
        <div className="stats-grid mb-8">
          <div className="stat-card">
            <div className="stat-number text-blue-600">{getTotalClasses()}</div>
            <div className="stat-label">총 학급 수</div>
          </div>
          <div className="stat-card">
            <div className="stat-number text-emerald-600">{getTotalPeriods()}</div>
            <div className="stat-label">주당 교시 수</div>
          </div>
          <div className="stat-card">
            <div className="stat-number text-purple-600">{getTotalWeeklyHours()}</div>
            <div className="stat-label">총 수업 시수</div>
          </div>
          <div className="stat-card">
            <div className="stat-number text-indigo-600">
              {getTotalClasses() > 0 ? Math.round(getTotalWeeklyHours() / getTotalClasses()) : 0}
            </div>
            <div className="stat-label">학급당 평균 교시</div>
          </div>
        </div>

        {/* JSON 파일 업로드 섹션 */}
        <div className="mb-8 p-6 bg-green-50 rounded-xl border border-green-200">
          <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
            <span className="text-2xl">📁</span>
            설정 파일 업로드
          </h3>
          <p className="text-green-700 mb-4">
            이전에 내보낸 JSON 설정 파일을 업로드하여 모든 설정을 한 번에 불러올 수 있습니다.
          </p>
          
          {/* 숨겨진 파일 입력 */}
          <input
            id="json-file-input"
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          
          <div className="flex items-center gap-4">
            <button 
              className="bg-green-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-600 hover:shadow-lg transition-all flex items-center gap-2"
              onClick={handleUploadClick}
            >
              <span className="text-xl">📂</span>
              설정 파일 선택
            </button>
            
            {uploadedFileName && (
              <div className="flex items-center gap-2 text-green-700">
                <span className="text-sm">✅</span>
                <span className="text-sm font-medium">{uploadedFileName}</span>
              </div>
            )}
          </div>
          
          <div className="mt-3 p-3 bg-white rounded-lg border border-green-300">
            <h4 className="text-sm font-semibold text-green-800 mb-2">💡 업로드 시 포함되는 데이터:</h4>
            <ul className="text-xs text-green-700 space-y-1">
              <li>• 기본 설정 (학년, 학급, 교시)</li>
              <li>• 과목 설정 (교과과목, 창의적 체험활동)</li>
              <li>• 교사 설정 (담당 과목, 시수 제한)</li>
              <li>• 제약 조건 설정</li>
              <li>• 고정 수업 설정</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 메인 설정 영역 - 3열 구성 */}
      <div className="content-grid">
        {/* 학교 기본 정보 */}
        <div className="feature-card bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
          <h3 className="text-xl font-semibold mb-6 text-blue-800 flex items-center">
            <span className="mr-2">🏫</span>
            학교 정보
          </h3>
          
          <div className="space-y-6">
            <div className="form-group">
              <label className="text-sm font-medium text-gray-700">학년 수</label>
              <input
                type="number"
                min="1"
                max="6"
                value={baseSettings.grades}
                onChange={(e) => handleChange('grades', parseInt(e.target.value) || 0)}
                placeholder="예: 3"
                className="w-full"
              />
              <small className="text-xs text-gray-500 mt-2 block">
                일반적으로 초등학교 6개, 중학교 3개, 고등학교 3개
              </small>
            </div>

            {/* 각 학년별 학급 수 입력 */}
            <div className="form-group">
              <label className="text-sm font-medium text-gray-700">학년별 학급 수</label>
              <div className="space-y-3 mt-3">
                {Array.from({ length: baseSettings.grades }, (_, index) => (
                  <div key={index} className="form-row">
                    <label className="text-sm font-medium text-gray-600 min-w-16">
                      {index + 1}학년:
                    </label>
                    <div className="form-col">
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={baseSettings.classes_per_grade[index] || 0}
                        onChange={(e) => handleClassesChange(index, e.target.value)}
                        placeholder="학급 수"
                        className="text-sm"
                      />
                    </div>
                    <span className="text-xs text-gray-500 min-w-12">개 반</span>
                  </div>
                ))}
              </div>
              <small className="text-xs text-gray-500 mt-3 block">
                각 학년별로 운영할 학급의 수를 개별적으로 설정하세요
              </small>
            </div>
          </div>
        </div>

        {/* 요일별 교시 설정 */}
        <div className="feature-card bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200">
          <h3 className="text-xl font-semibold mb-6 text-emerald-800 flex items-center">
            <span className="mr-2">📅</span>
            요일별 교시 수
          </h3>
          
          <div className="space-y-4">
            {days.map(day => (
              <div key={day} className="form-row">
                <label className="text-sm font-medium text-gray-700 min-w-16">{day}요일</label>
                <div className="form-col">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={baseSettings.periods_per_day[day]}
                    onChange={(e) => handlePeriodsChange(day, e.target.value)}
                    placeholder="교시 수"
                    className="text-sm"
                  />
                </div>
                <span className="text-xs text-gray-500 min-w-8">교시</span>
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-white rounded-xl border border-emerald-200">
            <h4 className="font-semibold text-emerald-700 mb-2">📊 교시 합계</h4>
            <div className="text-2xl font-bold text-emerald-600">
              {getTotalPeriods()}교시
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {days.map(day => baseSettings.periods_per_day[day]).join(' + ')} = {getTotalPeriods()}
            </div>
          </div>
        </div>

        {/* 자동 계산 결과 */}
        <div className="feature-card bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200">
          <h3 className="text-xl font-semibold mb-6 text-purple-800 flex items-center">
            <span className="mr-2">📊</span>
            자동 계산 결과
          </h3>
          
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-purple-200 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">{getTotalClasses()}</div>
              <div className="font-medium text-gray-700 mb-2">총 학급 수</div>
              <div className="text-xs text-gray-500">
                {baseSettings.classes_per_grade.map((count, index) => 
                  `${index + 1}학년: ${count}개`
                ).join(', ')}
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-xl border border-purple-200 text-center">
              <div className="text-3xl font-bold text-emerald-600 mb-2">{getTotalPeriods()}</div>
              <div className="font-medium text-gray-700 mb-2">주당 교시 수</div>
              <div className="text-xs text-gray-500">
                월~금 총 {getTotalPeriods()}교시
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-xl border border-purple-200 text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">{getTotalWeeklyHours()}</div>
              <div className="font-medium text-gray-700 mb-2">총 수업 시수</div>
              <div className="text-xs text-gray-500">
                주당 총 배정 가능한 수업 시수
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 설정 미리보기 - 가로 방향으로 확장 */}
      <div className="card">
        <h3 className="text-xl font-semibold mb-6 flex items-center">
          <span className="mr-2">👀</span>
          설정 미리보기
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 학급 구성 */}
          <div className="section-card">
            <h4 className="font-semibold mb-4 text-gray-700 flex items-center">
              <span className="mr-2">🎯</span>
              학급 구성
            </h4>
            <div className="space-y-4">
              {Array.from({ length: baseSettings.grades }, (_, gradeIndex) => (
                <div key={gradeIndex} className="bg-white p-4 rounded-xl border">
                  <div className="font-medium text-gray-800 mb-3">
                    {gradeIndex + 1}학년 ({baseSettings.classes_per_grade[gradeIndex] || 0}개 반)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: baseSettings.classes_per_grade[gradeIndex] || 0 }, (_, classIndex) => (
                      <span 
                        key={classIndex} 
                        className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm font-medium"
                        title={`${gradeIndex + 1}학년 ${classIndex + 1}반`}
                      >
                        {gradeIndex + 1}-{classIndex + 1}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 주간 시간표 구조 */}
          <div className="section-card">
            <h4 className="font-semibold mb-4 text-gray-700 flex items-center">
              <span className="mr-2">📋</span>
              주간 시간표 구조
            </h4>
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-3 text-left font-medium">요일</th>
                    {days.map(day => (
                      <th key={day} className="px-4 py-3 text-center font-medium">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3 font-medium bg-gray-50">교시 수</td>
                    {days.map(day => (
                      <td key={day} className="px-4 py-3 text-center">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-lg text-xs font-medium">
                          {baseSettings.periods_per_day[day]}
                        </span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 총계 정보 */}
            <div className="mt-4 p-4 bg-gradient-to-r from-indigo-50 to-blue-100 rounded-xl border border-blue-200">
              <h5 className="font-semibold mb-3 text-indigo-800">📈 총계</h5>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">총 학급 수:</span>
                  <span className="font-bold text-indigo-600">{getTotalClasses()}개</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">주당 교시:</span>
                  <span className="font-bold text-indigo-600">{getTotalPeriods()}교시</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">총 수업 시수:</span>
                  <span className="font-bold text-indigo-600">{getTotalWeeklyHours()}시간</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">학급당 평균:</span>
                  <span className="font-bold text-indigo-600">
                    {getTotalClasses() > 0 ? Math.round(getTotalWeeklyHours() / getTotalClasses()) : 0}교시
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 네비게이션 */}
      <div className="navigation">
        <button className="btn btn-secondary flex items-center gap-2" onClick={prevStep}>
          ← 이전 단계
        </button>
        <button 
          className="btn btn-primary flex items-center gap-2" 
          onClick={handleNext}
          disabled={!baseSettings.grades || getTotalClasses() === 0 || getTotalPeriods() === 0}
        >
          다음 단계 →
        </button>
      </div>
    </div>
  );
}

export default BasicSettings; 