"use client";

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { 
  SortableConstraintItem, 
  ConstraintTypeSelector, 
  ConstraintInputForm 
} from './ConstraintSettingsComponents';
import {
  getConstraintTypes,
  addConstraint,
  removeConstraint,
  validateConstraintData,
  generateClassList
} from './ConstraintSettingsHelpers';

function ConstraintSettings({ data, updateData, nextStep, prevStep }) {
  const [constraints, setConstraints] = useState(data.constraints || { must: [], optional: [] });
  const [newConstraint, setNewConstraint] = useState({
    type: '',
    priority: 'must',
    subject: '',
    subjects: [],
    day: '',
    period: '',
    description: '',
    mainTeacher: '',
    coTeachers: [],
    maxTeachers: 2,
    teacher1: '',
    teacher2: '',
    teacher: ''
  });

  // 드래그 앤 드롭 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const days = ['월', '화', '수', '목', '금'];
  const constraintTypes = getConstraintTypes();

  // 제약조건 추가
  const handleAddConstraint = () => {
    if (!newConstraint.type) {
      alert('제약조건 유형을 선택해주세요.');
      return;
    }

    const updatedConstraints = addConstraint(constraints, newConstraint, newConstraint.priority);
    if (updatedConstraints) {
      setConstraints(updatedConstraints);
      updateData('constraints', updatedConstraints);

      // 폼 초기화
      setNewConstraint({
        type: '',
        priority: 'must',
        subject: '',
        subjects: [],
        day: '',
        period: '',
        description: '',
        mainTeacher: '',
        coTeachers: [],
        maxTeachers: 2,
        teacher1: '',
        teacher2: '',
        teacher: ''
      });
    }
  };

  // 제약조건 제거
  const handleRemoveConstraint = (priority, index) => {
    const updatedConstraints = removeConstraint(constraints, priority, index);
    setConstraints(updatedConstraints);
    updateData('constraints', updatedConstraints);
  };

  // 드래그 앤 드롭 처리
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const activePriority = active.id.split('-')[0];
      const overPriority = over.id.split('-')[0];
      
      const activeIndex = parseInt(active.id.split('-')[1]);
      const overIndex = parseInt(over.id.split('-')[1]);

      let updatedConstraints = { ...constraints };

      if (activePriority === overPriority) {
        // 같은 우선순위 내에서 이동
        const constraintList = [...constraints[activePriority]];
        const newIndex = arrayMove(constraintList, activeIndex, overIndex);
        updatedConstraints[activePriority] = newIndex;
      } else {
        // 다른 우선순위로 이동
        const constraint = constraints[activePriority][activeIndex];
        const sourceList = constraints[activePriority].filter((_, index) => index !== activeIndex);
        const targetList = [...constraints[overPriority]];
        targetList.splice(overIndex, 0, constraint);
        
        updatedConstraints[activePriority] = sourceList;
        updatedConstraints[overPriority] = targetList;
      }

      setConstraints(updatedConstraints);
      updateData('constraints', updatedConstraints);
    }
  };

  // 제약조건 유형 변경 시 폼 초기화
  const handleConstraintTypeChange = (type) => {
    setNewConstraint(prev => ({
      ...prev,
      type,
      subject: '',
      subjects: [],
      day: '',
      period: '',
      description: '',
      mainTeacher: '',
      coTeachers: [],
      maxTeachers: 2
    }));
  };

  // 기본 제약조건 로드
  const loadDefaultConstraints = () => {
    const defaultConstraints = {
      must: [
        {
          id: 1,
          type: 'no_duplicate_teachers',
          description: '교사 중복 배정 금지'
        },
        {
          id: 2,
          type: 'no_duplicate_classes',
          description: '학급 중복 배정 금지'
        },
        {
          id: 3,
          type: 'class_max_daily_periods',
          description: '학급 일일 최대 교시 수 제한'
        },
        {
          id: 4,
          type: 'subject_weekly_hours',
          description: '과목 주당 시수 고정'
        },
        {
          id: 5,
          type: 'space_constraint',
          description: '특별실 공간 제약'
        },
        {
          id: 1753967161491,
          type: 'teacher_same_class_daily_limit',
          description: '교사 일일 학급 중복 금지'
        },
        {
          id: 1754212069448,
          type: 'class_daily_subject_once',
          description: '학급 일일 과목 중복 금지',
          subject: 'all'
        }
      ],
      optional: []
    };

    setConstraints(defaultConstraints);
    updateData('constraints', defaultConstraints);
    alert('기본 제약조건이 로드되었습니다.');
  };

  // JSON 파일의 제약조건 로드
  const loadJsonConstraints = () => {
    const jsonConstraints = {
      must: [
        {
          id: 1,
          type: 'no_duplicate_teachers',
          description: '교사 중복 배정 금지'
        },
        {
          id: 2,
          type: 'no_duplicate_classes',
          description: '학급 중복 배정 금지'
        },
        {
          id: 3,
          type: 'class_max_daily_periods',
          description: '학급 일일 최대 교시 수 제한'
        },
        {
          id: 4,
          type: 'subject_weekly_hours',
          description: '과목 주당 시수 고정'
        },
        {
          id: 5,
          type: 'space_constraint',
          description: '특별실 공간 제약'
        },
        {
          id: 1753629716690,
          type: 'specific_teacher_co_teaching',
          description: '특정 교사 공동수업 설정',
          mainTeacher: '음포',
          coTeachers: ['문혜수', '노민영', '민이선', '김희원']
        },
        {
          id: 1753967161491,
          type: 'teacher_same_class_daily_limit',
          description: '교사 일일 학급 중복 금지'
        },
        {
          id: 1754212069448,
          type: 'class_daily_subject_once',
          description: '학급 일일 과목 중복 금지',
          subject: 'all'
        },
        {
          id: 1754227575080,
          type: 'subject_fixed_only',
          description: '특정 과목 고정 수업만 허용',
          subjects: ['동아리', '스포츠']
        },
        {
          id: 1754311481677,
          type: 'block_period_requirement',
          description: '블록 수업 요구사항',
          subject: '나유리',
          subjects: []
        },
        {
          id: 1754480452358,
          type: 'teacher_mutual_exclusion',
          priority: 'must',
          description: '교사 상호 배제',
          teacher1: '주지은',
          teacher2: '허진선'
        },
        {
          id: 1754480474637,
          type: 'teacher_mutual_exclusion',
          priority: 'must',
          description: '교사 상호 배제',
          teacher1: '지희',
          teacher2: '나유리'
        }
      ],
      optional: []
    };

    setConstraints(jsonConstraints);
    updateData('constraints', jsonConstraints);
    alert('JSON 파일의 제약조건이 로드되었습니다.');
  };

  // 제약조건 설명 가져오기
  const getConstraintDescription = (type) => {
    const descriptions = {
      'no_duplicate_teachers': '같은 시간에 한 교사가 여러 학급에 배정되는 것을 방지합니다.',
      'no_duplicate_classes': '같은 시간에 한 학급에 여러 과목이 배정되는 것을 방지합니다.',
      'class_max_daily_periods': '학급별로 하루에 배정할 수 있는 최대 교시 수를 제한합니다.',
      'subject_weekly_hours': '각 과목의 주당 시수를 정확히 맞춥니다.',
      'space_constraint': '특별실이 필요한 과목들의 공간 제약을 관리합니다.',
      'teacher_same_class_daily_limit': '한 교사가 같은 학급에 하루에 여러 번 배정되는 것을 제한합니다.',
      'class_daily_subject_once': '한 학급에 같은 과목이 하루에 여러 번 배정되는 것을 방지합니다.',
      'specific_teacher_co_teaching': '특정 교사와 다른 교사들의 공동수업을 설정합니다.',
      'subject_fixed_only': '특정 과목은 고정 수업 시간에만 배정되도록 제한합니다.',
      'block_period_requirement': '연속된 교시에 같은 과목이 배정되도록 요구합니다.',
      'teacher_mutual_exclusion': '특정 두 교사가 같은 시간에 배정되지 않도록 합니다.',
      'teacher_unavailable_times': '교사의 불가능한 시간대를 설정합니다.',
      'teacher_hours_limit': '교사의 주당 최대 수업 시간을 제한합니다.',
      'sequential_grade_teaching': '교사가 연속된 학년에만 수업하도록 제한합니다.',
      'special_room_conflict': '특별실 사용 시 발생할 수 있는 충돌을 방지합니다.'
    };
    return descriptions[type] || '제약조건에 대한 설명이 없습니다.';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 py-8">
      {/* 전체 컨테이너 - 데스크탑 최적화 넓은 레이아웃 */}
      <div className="max-w-[1600px] mx-auto px-8">
        
        {/* 헤더 */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-4 mb-6">
            <span className="text-6xl">⚙️</span>
            <h1 className="text-5xl font-bold text-gray-800">제약조건 설정</h1>
          </div>
          <p className="text-xl text-gray-600">시간표 생성 시 준수해야 할 규칙들을 설정하세요</p>
        </div>

        {/* 통계 카드들 */}
        <div className="flex flex-wrap gap-8 mb-12 justify-center">
          <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[200px] text-center border border-red-100 hover:shadow-xl transition-shadow">
            <div className="text-4xl font-bold text-red-600 mb-3">{constraints.must.length}</div>
            <div className="text-lg text-gray-700 font-semibold">필수 제약조건</div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[200px] text-center border border-yellow-100 hover:shadow-xl transition-shadow">
            <div className="text-4xl font-bold text-yellow-600 mb-3">{constraints.optional.length}</div>
            <div className="text-lg text-gray-700 font-semibold">선택 제약조건</div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-8 min-w-[200px] text-center border border-blue-100 hover:shadow-xl transition-shadow">
            <div className="text-4xl font-bold text-blue-600 mb-3">{constraints.must.length + constraints.optional.length}</div>
            <div className="text-lg text-gray-700 font-semibold">전체 제약조건</div>
          </div>
        </div>

        {/* 빠른 설정 버튼들 */}
        <div className="flex flex-wrap gap-4 mb-12 justify-center">
          <button
            onClick={loadDefaultConstraints}
            className="px-8 py-4 bg-blue-500 text-white rounded-xl text-lg font-semibold hover:bg-blue-600 hover:shadow-lg transition-all flex items-center gap-3"
          >
            <span className="text-2xl">📋</span>
            기본 제약조건 로드
          </button>
          <button
            onClick={loadJsonConstraints}
            className="px-8 py-4 bg-green-500 text-white rounded-xl text-lg font-semibold hover:bg-green-600 hover:shadow-lg transition-all flex items-center gap-3"
          >
            <span className="text-2xl">📄</span>
            JSON 제약조건 로드
          </button>
        </div>

        {/* 메인 컨텐츠 - 2단 가로 배치 */}
        <div className="flex flex-wrap gap-8 items-start mb-12">
          
          {/* 새 제약조건 추가 카드 */}
          <div className="flex-1 min-w-[500px] bg-white shadow-lg rounded-2xl p-8 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-4 mb-8">
              <span className="text-4xl">➕</span>
              <h3 className="text-2xl font-bold text-gray-800">새 제약조건 추가</h3>
            </div>
            
            <div className="space-y-6">
              {/* 제약조건 유형 선택 */}
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-3">제약조건 유형</label>
                <ConstraintTypeSelector
                  constraintTypes={constraintTypes}
                  selectedType={newConstraint.type}
                  onTypeChange={handleConstraintTypeChange}
                />
                {newConstraint.type && (
                  <div className="mt-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>설명:</strong> {getConstraintDescription(newConstraint.type)}
                    </p>
                  </div>
                )}
              </div>
              
              {/* 우선순위 선택 */}
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-3">우선순위</label>
                <select
                  value={newConstraint.priority}
                  onChange={(e) => setNewConstraint(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
                >
                  <option value="must">🔴 필수 (반드시 지켜야 함)</option>
                  <option value="optional">🟡 선택 (가능하면 지키려 함)</option>
                </select>
              </div>

              {/* 제약조건 입력 폼 */}
              {newConstraint.type && (
                <div className="mt-6">
                  <ConstraintInputForm
                    constraintType={newConstraint.type}
                    newConstraint={newConstraint}
                    onConstraintChange={(field, value) => {
                      setNewConstraint(prev => ({ ...prev, [field]: value }));
                    }}
                    subjects={data.subjects}
                    teachers={data.teachers}
                    classes={generateClassList(data)}
                    days={days}
                  />
                </div>
              )}

              {/* 추가 버튼 */}
              <div className="pt-4">
                <button
                  onClick={handleAddConstraint}
                  className="w-full bg-green-500 text-white px-6 py-4 rounded-xl text-lg font-semibold hover:bg-green-600 hover:shadow-lg transition-all flex items-center justify-center gap-3"
                  disabled={!newConstraint.type}
                >
                  <span className="text-2xl">✅</span>
                  제약조건 추가
                </button>
              </div>
            </div>
          </div>

          {/* 제약조건 가이드 카드 */}
          <div className="flex-1 min-w-[400px] bg-white shadow-lg rounded-2xl p-8 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-4 mb-8">
              <span className="text-4xl">💡</span>
              <h3 className="text-2xl font-bold text-gray-800">제약조건 가이드</h3>
            </div>
            
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-blue-800 mb-4">🔴 필수 제약조건</h4>
                <p className="text-base text-gray-700 mb-3">
                  시간표 생성 시 반드시 지켜야 하는 규칙들입니다. 위반 시 시간표가 생성되지 않을 수 있습니다.
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• 교사 중복 배정 금지</li>
                  <li>• 학급 중복 배정 금지</li>
                  <li>• 과목 주당 시수 고정</li>
                  <li>• 특별실 공간 제약</li>
                </ul>
              </div>
              
              <div>
                <h4 className="text-lg font-semibold text-yellow-800 mb-4">🟡 선택 제약조건</h4>
                <p className="text-base text-gray-700 mb-3">
                  가능하면 지키려고 노력하는 규칙들입니다. 위반해도 시간표는 생성됩니다.
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• 교사 선호 시간대</li>
                  <li>• 과목 배치 선호도</li>
                  <li>• 학급별 특별 요구사항</li>
                </ul>
              </div>

              <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                <h4 className="text-lg font-semibold text-yellow-800 mb-2">💡 팁</h4>
                <p className="text-sm text-yellow-700">
                  제약조건이 많을수록 시간표 생성이 어려워질 수 있습니다. 
                  필수 제약조건은 최소한으로 설정하고, 나머지는 선택 제약조건으로 설정하는 것을 권장합니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 기존 제약조건 목록 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* 필수 제약조건 */}
          <div className="bg-white shadow-lg rounded-2xl p-8 border border-red-100">
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
              <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-semibold">🔴 필수</span>
              필수 제약조건 ({constraints.must.length}개)
            </h3>
            
            {constraints.must.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">📋</div>
                <p className="text-lg mb-2 font-semibold">필수 제약조건이 없습니다</p>
                <p className="text-sm text-gray-400">새 제약조건을 추가하거나 기본 제약조건을 로드해주세요</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={constraints.must.map((_, index) => `must-${index}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {constraints.must.map((constraint, index) => (
                      <SortableConstraintItem
                        key={`must-${index}`}
                        constraint={constraint}
                        index={index}
                        priority="must"
                        onRemove={() => handleRemoveConstraint('must', index)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* 선택 제약조건 */}
          <div className="bg-white shadow-lg rounded-2xl p-8 border border-yellow-100">
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
              <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">🟡 선택</span>
              선택 제약조건 ({constraints.optional.length}개)
            </h3>
            
            {constraints.optional.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">📋</div>
                <p className="text-lg mb-2 font-semibold">선택 제약조건이 없습니다</p>
                <p className="text-sm text-gray-400">새 제약조건을 추가하거나 기본 제약조건을 로드해주세요</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={constraints.optional.map((_, index) => `optional-${index}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {constraints.optional.map((constraint, index) => (
                      <SortableConstraintItem
                        key={`optional-${index}`}
                        constraint={constraint}
                        index={index}
                        priority="optional"
                        onRemove={() => handleRemoveConstraint('optional', index)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
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
            className="bg-blue-500 text-white px-10 py-5 rounded-xl text-xl font-semibold hover:bg-blue-600 hover:shadow-lg transition-all flex items-center gap-3"
            onClick={nextStep}
          >
            다음 단계 →
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConstraintSettings; 