import React from 'react';

const TeacherHoursSummary = ({ data }) => {
  const { teachers, subjects } = data;
  
  // 학급 이름 생성
  const generateClassNames = () => {
    const classNames = [];
    const grades = data.base?.grades || 3;
    const classesPerGrade = data.base?.classes_per_grade || [];

    const gradeArray = Array.isArray(grades) ? grades : Array.from({ length: grades }, (_, i) => i + 1);

    gradeArray.forEach((grade) => {
      const classCount = classesPerGrade[grade - 1] || 0;
      for (let classNum = 1; classNum <= classCount; classNum++) {
        classNames.push(`${grade}학년 ${classNum}반`);
      }
    });

    return classNames;
  };

  const classNames = generateClassNames();
  
  // 창의적 체험활동 과목들
  const creativeSubjects = subjects?.filter(subject => subject.category === '창의적 체험활동') || [];
  
  // 각 교사의 메인 수업 총 시수 계산
  const getMainSubjectTotal = (teacher) => {
    return Object.values(teacher.weeklyHoursByGrade || {}).reduce((sum, hours) => sum + hours, 0);
  };
  
  // 각 교사의 창의적 체험활동 총 시수 계산
  const getCreativeSubjectTotal = (teacher) => {
    return creativeSubjects.reduce((sum, subject) => {
      return sum + (teacher.subjectHours?.[subject.name] || 0);
    }, 0);
  };
  
  // 각 교사의 전체 총 시수 계산
  const getGrandTotal = (teacher) => {
    return getMainSubjectTotal(teacher) + getCreativeSubjectTotal(teacher);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 py-8">
      <div className="max-w-[1800px] mx-auto px-8">
        
        {/* 헤더 */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-4 mb-6">
            <span className="text-6xl">📊</span>
            <h1 className="text-5xl font-bold text-gray-800">교사별 학급당 시수 요약</h1>
          </div>
          <p className="text-xl text-gray-600">각 교사가 담당하는 학급별 시수와 창의적 체험활동 시수를 확인하세요</p>
        </div>

        {/* 통계 카드 */}
        <div className="flex flex-wrap gap-6 mb-8 justify-center">
          <div className="bg-white rounded-2xl shadow-lg p-6 min-w-[200px] text-center border border-blue-100">
            <div className="text-3xl font-bold text-blue-600 mb-2">{teachers.length}</div>
            <div className="text-lg text-gray-700 font-semibold">총 교사 수</div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6 min-w-[200px] text-center border border-green-100">
            <div className="text-3xl font-bold text-green-600 mb-2">{classNames.length}</div>
            <div className="text-lg text-gray-700 font-semibold">총 학급 수</div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6 min-w-[200px] text-center border border-purple-100">
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {teachers.reduce((sum, teacher) => sum + getMainSubjectTotal(teacher), 0)}
            </div>
            <div className="text-lg text-gray-700 font-semibold">총 메인 수업 시수</div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6 min-w-[200px] text-center border border-orange-100">
            <div className="text-3xl font-bold text-orange-600 mb-2">
              {teachers.reduce((sum, teacher) => sum + getCreativeSubjectTotal(teacher), 0)}
            </div>
            <div className="text-lg text-gray-700 font-semibold">총 창의적 체험활동</div>
          </div>
        </div>

        {/* 메인 테이블 */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="p-4 text-left font-semibold text-gray-700 border-r border-gray-200 sticky left-0 bg-gray-100 z-10">
                    교사명
                  </th>
                  
                  {/* 학년별 헤더 */}
                  {[1, 2, 3].map(grade => {
                    const classCount = data.base?.classes_per_grade?.[grade - 1] || 0;
                    return (
                      <th key={grade} colSpan={classCount} className="p-2 text-center font-semibold text-gray-700 border-r border-gray-200">
                        {grade}학년
                        <div className="text-xs text-gray-500 mt-1">
                          {Array.from({ length: classCount }, (_, i) => i + 1).map(num => (
                            <span key={num} className="inline-block w-8 text-center">{num}</span>
                          ))}
                        </div>
                      </th>
                    );
                  })}
                  
                  <th className="p-4 text-center font-semibold text-gray-700 border-r border-gray-200 bg-blue-50">
                    계
                  </th>
                  
                  {/* 창의적 체험활동 헤더 */}
                  <th colSpan={creativeSubjects.length} className="p-2 text-center font-semibold text-gray-700 border-r border-gray-200 bg-green-50">
                    창체
                    <div className="text-xs text-gray-500 mt-1">
                      {creativeSubjects.map(subject => (
                        <span key={subject.name} className="inline-block w-12 text-center">{subject.name}</span>
                      ))}
                    </div>
                  </th>
                  
                  <th className="p-4 text-center font-semibold text-gray-700 border-r border-gray-200 bg-green-50">
                    창체합계
                  </th>
                  
                  <th className="p-4 text-center font-semibold text-gray-700 bg-purple-50">
                    총계
                  </th>
                </tr>
              </thead>
              
              <tbody>
                {teachers.map((teacher, index) => (
                  <tr key={teacher.id || index} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-4 font-semibold text-gray-800 border-r border-gray-200 sticky left-0 bg-white z-10">
                      {teacher.name}
                    </td>
                    
                    {/* 학년별 데이터 */}
                    {[1, 2, 3].map(grade => {
                      const classCount = data.base?.classes_per_grade?.[grade - 1] || 0;
                      return (
                        <React.Fragment key={grade}>
                          {Array.from({ length: classCount }, (_, i) => {
                            const className = `${grade}학년 ${i + 1}반`;
                            const hours = teacher.weeklyHoursByGrade?.[className] || 0;
                            return (
                              <td key={i} className="p-2 text-center border-r border-gray-200">
                                {hours > 0 ? hours : '-'}
                              </td>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                    
                    {/* 메인 수업 총계 */}
                    <td className="p-4 text-center font-semibold text-blue-600 border-r border-gray-200 bg-blue-50">
                      {getMainSubjectTotal(teacher)}
                    </td>
                    
                    {/* 창의적 체험활동 데이터 */}
                    {creativeSubjects.map(subject => (
                      <td key={subject.name} className="p-2 text-center border-r border-gray-200 bg-green-50">
                        {teacher.subjectHours?.[subject.name] || 0}
                      </td>
                    ))}
                    
                    {/* 창의적 체험활동 총계 */}
                    <td className="p-4 text-center font-semibold text-green-600 border-r border-gray-200 bg-green-50">
                      {getCreativeSubjectTotal(teacher)}
                    </td>
                    
                    {/* 전체 총계 */}
                    <td className="p-4 text-center font-bold text-purple-600 bg-purple-50">
                      {getGrandTotal(teacher)}
                    </td>
                  </tr>
                ))}
                
                {/* 합계 행 */}
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
                  <td className="p-4 text-left text-gray-800 border-r border-gray-200 sticky left-0 bg-gray-100 z-10">
                    합계
                  </td>
                  
                  {/* 학년별 합계 */}
                  {[1, 2, 3].map(grade => {
                    const classCount = data.base?.classes_per_grade?.[grade - 1] || 0;
                    return (
                      <React.Fragment key={grade}>
                        {Array.from({ length: classCount }, (_, i) => {
                          const className = `${grade}학년 ${i + 1}반`;
                          const totalHours = teachers.reduce((sum, teacher) => {
                            return sum + (teacher.weeklyHoursByGrade?.[className] || 0);
                          }, 0);
                          return (
                            <td key={i} className="p-2 text-center border-r border-gray-200 text-blue-600">
                              {totalHours}
                            </td>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                  
                  {/* 메인 수업 총합계 */}
                  <td className="p-4 text-center text-blue-600 border-r border-gray-200 bg-blue-100">
                    {teachers.reduce((sum, teacher) => sum + getMainSubjectTotal(teacher), 0)}
                  </td>
                  
                  {/* 창의적 체험활동 합계 */}
                  {creativeSubjects.map(subject => {
                    const totalHours = teachers.reduce((sum, teacher) => {
                      return sum + (teacher.subjectHours?.[subject.name] || 0);
                    }, 0);
                    return (
                      <td key={subject.name} className="p-2 text-center border-r border-gray-200 bg-green-100 text-green-600">
                        {totalHours}
                      </td>
                    );
                  })}
                  
                  {/* 창의적 체험활동 총합계 */}
                  <td className="p-4 text-center text-green-600 border-r border-gray-200 bg-green-100">
                    {teachers.reduce((sum, teacher) => sum + getCreativeSubjectTotal(teacher), 0)}
                  </td>
                  
                  {/* 전체 총합계 */}
                  <td className="p-4 text-center text-purple-600 bg-purple-100">
                    {teachers.reduce((sum, teacher) => sum + getGrandTotal(teacher), 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 범례 */}
        <div className="mt-8 p-6 bg-white rounded-2xl shadow-lg">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">📋 범례</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
              <span className="text-sm text-gray-700">메인 수업 (교과과목)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
              <span className="text-sm text-gray-700">창의적 체험활동</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-purple-100 border border-purple-300 rounded"></div>
              <span className="text-sm text-gray-700">전체 총계</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></div>
              <span className="text-sm text-gray-700">합계 행</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherHoursSummary; 