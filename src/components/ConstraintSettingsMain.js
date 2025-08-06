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
  getConstraintTypeName,
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
    maxTeachers: 2
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

    const validationResult = validateConstraintData(newConstraint, data);
    if (!validationResult.isValid) {
      alert(validationResult.message);
      return;
    }

    const updatedConstraints = addConstraint(constraints, newConstraint);
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
      maxTeachers: 2
    });
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
          type: 'no_duplicate_teachers',
          description: '교사 중복 금지 (기본)',
          priority: 'must'
        },
        {
          type: 'teacher_same_class_daily_limit',
          description: '교사 일일 학급 중복 금지 (기본)',
          priority: 'must'
        }
      ],
      optional: []
    };

    setConstraints(defaultConstraints);
    updateData('constraints', defaultConstraints);
    alert('기본 제약조건이 로드되었습니다.');
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">제약조건 설정</h2>
        
        {/* 기본 제약조건 로드 버튼 */}
        <div className="mb-6">
          <button
            onClick={loadDefaultConstraints}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            기본 제약조건 로드
          </button>
        </div>

        {/* 새 제약조건 추가 */}
        <div className="mb-8 p-6 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">새 제약조건 추가</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 제약조건 유형 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                제약조건 유형
              </label>
              <ConstraintTypeSelector
                constraintTypes={constraintTypes}
                selectedType={newConstraint.type}
                onTypeChange={handleConstraintTypeChange}
              />
            </div>

            {/* 우선순위 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                우선순위
              </label>
              <select
                value={newConstraint.priority}
                onChange={(e) => setNewConstraint(prev => ({ ...prev, priority: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="must">필수 (must)</option>
                <option value="optional">선택 (optional)</option>
              </select>
            </div>
          </div>

          {/* 제약조건 입력 폼 */}
          {newConstraint.type && (
            <div className="mt-6">
              <ConstraintInputForm
                constraintType={newConstraint.type}
                constraintData={newConstraint}
                onDataChange={setNewConstraint}
                data={data}
              />
            </div>
          )}

          {/* 추가 버튼 */}
          <div className="mt-6">
            <button
              onClick={handleAddConstraint}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              제약조건 추가
            </button>
          </div>
        </div>

        {/* 기존 제약조건 목록 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 필수 제약조건 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm mr-2">필수</span>
              필수 제약조건 ({constraints.must.length}개)
            </h3>
            
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={constraints.must.map((_, index) => `must-${index}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {constraints.must.map((constraint, index) => (
                    <SortableConstraintItem
                      key={`must-${index}`}
                      id={`must-${index}`}
                      constraint={constraint}
                      constraintTypeName={getConstraintTypeName(constraint.type)}
                      onRemove={() => handleRemoveConstraint('must', index)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* 선택 제약조건 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm mr-2">선택</span>
              선택 제약조건 ({constraints.optional.length}개)
            </h3>
            
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={constraints.optional.map((_, index) => `optional-${index}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {constraints.optional.map((constraint, index) => (
                    <SortableConstraintItem
                      key={`optional-${index}`}
                      id={`optional-${index}`}
                      constraint={constraint}
                      constraintTypeName={getConstraintTypeName(constraint.type)}
                      onRemove={() => handleRemoveConstraint('optional', index)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>

        {/* 네비게이션 버튼 */}
        <div className="flex justify-between mt-8">
          <button
            onClick={prevStep}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            이전 단계
          </button>
          
          <button
            onClick={nextStep}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            다음 단계
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConstraintSettings; 