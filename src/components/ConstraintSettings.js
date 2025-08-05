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

// 분리된 컴포넌트 사용

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
  const constraintTypes = [
    // 🧑‍🏫 교사 관련 제약조건
    {
      id: 'no_duplicate_teachers',
      name: '교사 중복 금지',
      description: '한 교사가 같은 시간에 여러 반을 가르칠 수 없음',
      hasSubject: false,
      hasTime: false
    },
    {
      id: 'teacher_same_class_daily_limit',
      name: '교사 일일 학급 중복 금지',
      description: '같은 교사가 하루에 한 학급에 두 번 이상 들어갈 수 없음',
      hasSubject: false,
      hasTime: false
    },
    {
      id: 'teacher_consecutive_restriction',
      name: '교사 연속 수업 금지',
      description: '한 교사가 하루에 연속으로 수업하지 않도록 함',
      hasSubject: false,
      hasTime: false
    },
    {
      id: 'teacher_unavailable_time',
      name: '교사 수업 불가 시간',
      description: '특정 교사의 특정 요일·교시 수업 불가능',
      hasSubject: false,
      hasTime: true
    },
    {
      id: 'teacher_max_daily_hours',
      name: '교사 일일 최대 수업 수',
      description: '한 교사의 하루 최대 수업 수 제한',
      hasSubject: false,
      hasTime: false
    },
    {
      id: 'teacher_subject_conflict',
      name: '교사 과목 충돌 방지',
      description: '두 과목을 가르치는 교사의 과목이 동시에 열리지 않도록 함',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'teacher_preferred_time',
      name: '교사 선호 시간대',
      description: '특정 교사의 선호 시간대에 수업 배정',
      hasSubject: false,
      hasTime: true
    },
    {
      id: 'teacher_class_restriction',
      name: '교사-학급 배정 제한',
      description: '특정 교사가 특정 반을 가르치지 않도록 함',
      hasSubject: false,
      hasTime: false
    },
    {
      id: 'co_teaching_requirement',
      name: '공동 수업 요구사항',
      description: '특정 교사가 다른 교사와 함께 수업해야 함',
      hasSubject: false,
      hasTime: true
    },
    {
      id: 'specific_teacher_co_teaching',
      name: '특정 교사의 공동수업',
      description: '특정 교사가 반드시 다른 교사와 함께 수업해야 함 (부교사 후보들을 골고루 배분)',
      hasSubject: false,
      hasTime: false
    },
    // 🏫 학급 관련 제약조건
    {
      id: 'no_duplicate_classes',
      name: '학급 중복 금지',
      description: '한 학급이 같은 시간에 여러 과목을 들을 수 없음',
      hasSubject: false,
      hasTime: false
    },
    {
      id: 'class_daily_subject_limit',
      name: '학급 일일 과목 중복 금지',
      description: '하루에 특정 과목이 중복되지 않도록 함',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'class_max_daily_periods',
      name: '학급 일일 최대 교시 수',
      description: '한 학급의 하루 최대 교시 수 제한',
      hasSubject: false,
      hasTime: false
    },
    {
      id: 'class_consecutive_subject_restriction',
      name: '학급 연속 과목 제한',
      description: '한 과목의 수업이 연속된 시간으로 배정되지 않도록 함',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'class_daily_subject_once',
      name: '학급 일일 과목 1회 제한',
      description: '체육, 음악, 실험 등 특정 과목은 하루에 한 번만 편성',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'class_daily_distribution',
      name: '학급 일일 과목 분산',
      description: '한 학급의 하루 시간표가 과도하게 치우치지 않도록 분산 배정',
      hasSubject: false,
      hasTime: false
    },
    // 📚 과목 관련 제약조건
    {
      id: 'subject_weekly_hours',
      name: '과목 주당 시수 고정',
      description: '주당 시수가 고정되어 있어야 함',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'subject_fixed_time',
      name: '과목 고정 시간',
      description: '특정 과목은 반드시 특정 요일/교시에 배정',
      hasSubject: true,
      hasTime: true
    },
    {
      id: 'subject_consecutive_periods',
      name: '과목 연속 교시 필요',
      description: '특정 과목은 연속 2교시 이상이 필요',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'subject_teacher_requirement',
      name: '과목-교사 배정 제한',
      description: '특정 과목은 특정 교사만 담당',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'subject_fixed_only',
      name: '고정수업 전용 과목',
      description: '특정 과목들을 고정수업으로만 배치하고 랜덤 배치 제외',
      hasSubject: false,
      hasTime: false,
      hasSubjects: true
    },
    {
      id: 'subject_blocked_period',
      name: '과목별 시간 제한',
      description: '특정 과목을 특정 시간에 배치하지 않음',
      hasSubject: true,
      hasTime: true
    },
    {
      id: 'avoid_consecutive_subjects',
      name: '연속 수업 금지',
      description: '같은 과목이 연속으로 배치되지 않도록 함',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'morning_priority_subjects',
      name: '오전 우선 과목',
      description: '특정 과목을 오전 시간에 우선 배치',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'afternoon_priority_subjects',
      name: '오후 우선 과목',
      description: '특정 과목을 오후 시간에 우선 배치',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'max_daily_subject_hours',
      name: '일일 과목 시수 제한',
      description: '하루에 같은 과목을 최대 몇 시간까지만 배치',
      hasSubject: true,
      hasTime: false
    },
    // 🧰 기타 조건
    {
      id: 'space_constraint',
      name: '공간 제약',
      description: '특별실 사용 과목의 동시 수업 제한',
      hasSubject: false,
      hasTime: false
    },
    {
      id: 'free_period',
      name: '공강 시간 설정',
      description: '특정 시간은 공강 시간으로 설정',
      hasSubject: false,
      hasTime: true
    },
    {
      id: 'pe_concurrent_limit',
      name: '체육 동시 수업 제한',
      description: '체육 수업은 학년별 동시 수용 가능한 최대 학급 수를 넘지 않도록 함',
      hasSubject: false,
      hasTime: false
    },
    {
      id: 'subject_exclusive_time',
      name: '과목 배타적 시간',
      description: '특정 과목은 같은 시간에 여러 반에서 동시에 배정되면 안 됨',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'first_last_period_limit',
      name: '첫/마지막 교시 제한',
      description: '교사 또는 학급의 첫/마지막 수업이 너무 이르거나 늦지 않도록 함',
      hasSubject: false,
      hasTime: false
    },
    {
      id: 'similar_subject_conflict',
      name: '유사 과목 충돌 방지',
      description: '비슷한 과목이 동일 시간에 배정되지 않도록 함',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'classroom_requirement',
      name: '교실 배정 제한',
      description: '특정 수업은 특정 교실에서만 진행 가능',
      hasSubject: true,
      hasTime: false
    },
    {
      id: 'fourth_period_distribution',
      name: '4교시 수업 분산 제약',
      description: '한 교사에게 4교시 수업이 과도하게 집중되지 않도록 분산 배정',
      hasSubject: false,
      hasTime: false
    },
    // 🎯 블록제 수업 제약조건
    {
      id: 'block_period_requirement',
      name: '블록제 수업',
      description: '특정 수업은 연속된 두 교시에 배치되어야 함 (예: 실험, 체육, 프로젝트 등)',
      hasSubject: true,
      hasTime: false
    }
  ];

  const handleAddConstraint = () => {
    const updatedConstraints = addConstraint(constraints, newConstraint, newConstraint.priority, updateData);
    if (updatedConstraints) {
      setConstraints(updatedConstraints);
      
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
        coTeachers: []
      });
    }
  };

  const handleRemoveConstraint = (priority, index) => {
    const updatedConstraints = removeConstraint(constraints, priority, index, updateData);
    setConstraints(updatedConstraints);
  };

  // 드래그 앤 드롭 핸들러
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!active || !over || active.id === over.id) {
      return;
    }

    const [activePriority, activeIndex] = active.id.split('-');
    const [overPriority, overIndex] = over.id.split('-');
    
    if (activePriority === overPriority) {
      // 같은 섹션 내에서 순서 변경
      const items = arrayMove(
        constraints[activePriority],
        parseInt(activeIndex),
        parseInt(overIndex)
      );
      
      const updatedConstraints = {
        ...constraints,
        [activePriority]: items
      };
      setConstraints(updatedConstraints);
      updateData('constraints', updatedConstraints);
    } else {
      // 다른 섹션으로 이동
      const sourceItems = [...constraints[activePriority]];
      const targetItems = [...constraints[overPriority]];
      
      const [movedItem] = sourceItems.splice(parseInt(activeIndex), 1);
      targetItems.splice(parseInt(overIndex), 0, movedItem);
      
      const updatedConstraints = {
        ...constraints,
        [activePriority]: sourceItems,
        [overPriority]: targetItems
      };
      setConstraints(updatedConstraints);
      updateData('constraints', updatedConstraints);
    }
  };

  // 분리된 헬퍼 함수들 사용

    const loadDefaultConstraints = () => {
    const defaultConstraints = {
      must: [
        { id: 1, type: 'no_duplicate_teachers', description: '교사 중복 배정 금지' },
        { id: 2, type: 'no_duplicate_classes', description: '학급 중복 배정 금지' },
        { id: 3, type: 'teacher_same_class_daily_limit', description: '교사 일일 학급 중복 금지' },
        { id: 4, type: 'class_max_daily_periods', description: '학급 일일 최대 교시 수 제한' },
        { id: 5, type: 'subject_weekly_hours', description: '과목 주당 시수 고정' },
        { id: 6, type: 'space_constraint', description: '특별실 공간 제약' }
      ],
      optional: [
        { id: 7, type: 'fourth_period_distribution', description: '4교시 수업 분산 제약' },
        { id: 8, type: 'class_daily_subject_once', subject: '체육', description: '체육 하루 1회 제한' }
      ]
    };
    
    if (confirm('예시 제약 조건을 불러오시겠습니까? 기존 설정이 덮어씌워집니다.')) {
      setConstraints(defaultConstraints);
      updateData('constraints', defaultConstraints);
    }
  };

  return (
    <div className="card">
      <h2>⚖️ 제약 조건 설정</h2>
      
      {/* 통계 정보 - 가로 카드 레이아웃 */}
      <div className="flex gap-4 mb-8">
        <div className="card flex-1 bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-red-600 mb-1">{constraints.must.length}</h3>
              <p className="text-red-700 font-medium">필수 조건</p>
            </div>
            <div className="text-red-500 text-3xl">🚫</div>
          </div>
        </div>
        
        <div className="card flex-1 bg-gradient-to-br from-orange-50 to-orange-100 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-orange-600 mb-1">{constraints.optional.length}</h3>
              <p className="text-orange-700 font-medium">선택 조건</p>
            </div>
            <div className="text-orange-500 text-3xl">💡</div>
          </div>
        </div>
        
        <div className="card flex-1 bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-blue-600 mb-1">
                {constraints.must.length + constraints.optional.length}
              </h3>
              <p className="text-blue-700 font-medium">총 제약 조건</p>
            </div>
            <div className="text-blue-500 text-3xl">📊</div>
          </div>
        </div>
        
        <div className="card flex-1 bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-green-600 mb-1">{constraintTypes.length}</h3>
              <p className="text-green-700 font-medium">사용 가능한 유형</p>
            </div>
            <div className="text-green-500 text-3xl">🔧</div>
          </div>
        </div>
      </div>

      {/* 새 제약 조건 추가 */}
      <div className="card" style={{ marginBottom: '30px' }}>
        <h3>➕ 새 제약 조건 추가</h3>
        
        <div className="grid grid-2" style={{ marginTop: '20px' }}>
          <div className="form-group">
            <label>제약 조건 유형</label>
            <select
              value={newConstraint.type}
              onChange={(e) => setNewConstraint({ ...newConstraint, type: e.target.value })}
            >
              <option value="">제약 조건 선택</option>
              {constraintTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.name} ({type.description})
                </option>
              ))}
            </select>
            {getCurrentConstraintType() && (
              <small style={{ color: '#666', fontSize: '14px', marginTop: '5px', display: 'block' }}>
                {getCurrentConstraintType().description}
              </small>
            )}
          </div>

          <div className="form-group">
            <label>우선순위</label>
            <select
              value={newConstraint.priority}
              onChange={(e) => setNewConstraint({ ...newConstraint, priority: e.target.value })}
            >
              <option value="must">필수 조건 (반드시 지켜야 함)</option>
              <option value="optional">선택 조건 (가능하면 지킴)</option>
            </select>
          </div>
        </div>

        {/* 조건별 추가 설정 */}
        {getCurrentConstraintType()?.hasSubject && newConstraint.type !== 'block_period_requirement' && (
          <div className="form-group">
            <label>대상 과목</label>
            <select
              value={newConstraint.subject}
              onChange={(e) => setNewConstraint({ ...newConstraint, subject: e.target.value })}
            >
              <option value="">과목 선택</option>
              <option value="all">모든 수업에 해당</option>
              {data.subjects.map((subject, index) => (
                <option key={index} value={subject.name}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 블록제 수업 제약조건 - 교사 선택 */}
        {newConstraint.type === 'block_period_requirement' && (
          <div className="form-group">
            <label>대상 교사</label>
            <select
              value={newConstraint.subject}
              onChange={(e) => setNewConstraint({ ...newConstraint, subject: e.target.value })}
            >
              <option value="">교사 선택</option>
              {data.teachers.map((teacher, index) => (
                <option key={index} value={teacher.name}>
                  {teacher.name} ({teacher.subjects.join(', ')})
                </option>
              ))}
            </select>
          </div>
        )}

        {getCurrentConstraintType()?.hasSubjects && (
          <div className="form-group">
            <label>고정수업 전용 과목들</label>
            <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {data.subjects.map((subject, index) => (
                <div key={index} style={{ marginBottom: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={newConstraint.subjects?.includes(subject.name) || false}
                      onChange={(e) => {
                        const currentSubjects = newConstraint.subjects || [];
                        if (e.target.checked) {
                          setNewConstraint({ 
                            ...newConstraint, 
                            subjects: [...currentSubjects, subject.name] 
                          });
                        } else {
                          setNewConstraint({ 
                            ...newConstraint, 
                            subjects: currentSubjects.filter(s => s !== subject.name) 
                          });
                        }
                      }}
                      style={{ marginRight: '8px' }}
                    />
                    {subject.name}
                  </label>
                </div>
              ))}
            </div>
            {newConstraint.subjects && newConstraint.subjects.length > 0 && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                선택된 과목: {newConstraint.subjects.join(', ')}
              </div>
            )}
          </div>
        )}

        {getCurrentConstraintType()?.hasTime && (
          <div className="grid grid-2">
            <div className="form-group">
              <label>요일</label>
              <select
                value={newConstraint.day}
                onChange={(e) => setNewConstraint({ ...newConstraint, day: e.target.value })}
              >
                <option value="">요일 선택</option>
                {days.map(day => (
                  <option key={day} value={day}>
                    {day}요일
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>교시</label>
              <select
                value={newConstraint.period}
                onChange={(e) => setNewConstraint({ ...newConstraint, period: e.target.value })}
              >
                <option value="">교시 선택</option>
                {Array.from({ length: Math.max(...Object.values(data.base.periods_per_day)) }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}교시
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* 공동 수업 설정 */}
        {(newConstraint.type === 'co_teaching_requirement' || newConstraint.type === 'specific_teacher_co_teaching') && (
          <div className="bg-blue-50 p-6 rounded-xl border-2 border-blue-200 mb-6">
            <h4 className="text-lg font-semibold text-blue-800 mb-4">🤝 공동 수업 설정</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 주교사 선택 */}
              <div className="form-group">
                <label className="block text-base font-semibold text-gray-700 mb-3">주교사 선택</label>
                <select
                  value={newConstraint.mainTeacher}
                  onChange={(e) => setNewConstraint({ ...newConstraint, mainTeacher: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
                >
                  <option value="">주교사 선택</option>
                  {data.teachers.map((teacher, index) => (
                    <option key={index} value={teacher.name}>
                      {teacher.name} ({teacher.subjects.join(', ')})
                    </option>
                  ))}
                </select>
              </div>

              {/* 부교사 선택 */}
              <div className="form-group">
                <label className="block text-base font-semibold text-gray-700 mb-3">부교사 후보 선택 (다중 선택 가능)</label>
                <div className="bg-white p-4 rounded-xl border-2 border-gray-200 max-h-48 overflow-y-auto">
                  <div className="space-y-2">
                    {data.teachers
                      .filter(teacher => teacher.name !== newConstraint.mainTeacher)
                      .map((teacher, index) => (
                        <label key={index} className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                          <input
                            type="checkbox"
                            checked={newConstraint.coTeachers.includes(teacher.name)}
                            onChange={(e) => {
                              const updatedCoTeachers = e.target.checked
                                ? [...newConstraint.coTeachers, teacher.name]
                                : newConstraint.coTeachers.filter(name => name !== teacher.name);
                              setNewConstraint({ ...newConstraint, coTeachers: updatedCoTeachers });
                            }}
                            className="mr-3 w-4 h-4"
                          />
                          <span className="flex-1 font-medium">{teacher.name}</span>
                          <span className="text-sm text-gray-500">({teacher.subjects.join(', ')})</span>
                        </label>
                      ))}
                  </div>
                </div>
                {newConstraint.coTeachers.length > 0 && (
                  <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-700">
                      <strong>선택된 부교사 후보:</strong> {newConstraint.coTeachers.join(', ')}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      * 선택된 부교사 후보들 중에서 골고루 배분하여 주교사와 함께 수업에 참여합니다.
                    </p>
                  </div>
                )}
              </div>

              {/* 최대 교사 수 설정 */}
              <div className="form-group">
                <label className="block text-base font-semibold text-gray-700 mb-3">
                  한 수업당 최대 교사 수 (주교사 + 부교사 포함)
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    min="2"
                    max="5"
                    value={newConstraint.maxTeachers}
                    onChange={(e) => setNewConstraint(prev => ({
                      ...prev,
                      maxTeachers: parseInt(e.target.value) || 2
                    }))}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-sm text-gray-600">명 (기본값: 2명)</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  주교사 1명 + 부교사 {newConstraint.maxTeachers - 1}명까지 가능
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  * 부교사 후보가 {newConstraint.maxTeachers - 1}명보다 많아도 한 수업에는 최대 {newConstraint.maxTeachers}명만 참여합니다.
                </p>
              </div>
            </div>

            {/* 충돌 검사 결과 */}
            {newConstraint.mainTeacher && newConstraint.coTeachers.length > 0 && newConstraint.day && newConstraint.period && (
              <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h5 className="font-semibold text-yellow-800 mb-2">⚠️ 충돌 검사</h5>
                <div className="text-sm text-yellow-700">
                  {(() => {
                    const conflicts = [];
                    const allTeachers = [newConstraint.mainTeacher, ...newConstraint.coTeachers];
                    
                    // 각 교사의 수업 불가 시간 확인
                    allTeachers.forEach(teacherName => {
                      const teacher = data.teachers.find(t => t.name === teacherName);
                      if (teacher && teacher.unavailable) {
                        const isUnavailable = teacher.unavailable.some(
                          slot => slot[0] === newConstraint.day && slot[1] === parseInt(newConstraint.period)
                        );
                        if (isUnavailable) {
                          conflicts.push(`${teacherName} 교사는 ${newConstraint.day}요일 ${newConstraint.period}교시에 수업 불가`);
                        }
                      }
                    });
                    
                    if (conflicts.length > 0) {
                      return (
                        <div>
                          <p className="font-semibold mb-2">다음 충돌이 발견되었습니다:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {conflicts.map((conflict, index) => (
                              <li key={index}>{conflict}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    } else {
                      return <p className="text-green-600">✅ 충돌 없음 - 공동 수업 가능</p>;
                    }
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <label>설명 (선택사항)</label>
          <input
            type="text"
            value={newConstraint.description}
            onChange={(e) => setNewConstraint({ ...newConstraint, description: e.target.value })}
            placeholder="이 제약 조건에 대한 설명을 입력하세요"
          />
        </div>
        
        <div>
                          <button className="btn btn-primary" onClick={handleAddConstraint}>
            제약 조건 추가
          </button>
          <button className="btn btn-secondary" onClick={loadDefaultConstraints}>
            예시 제약 조건 불러오기
          </button>
        </div>
      </div>

      {/* 조건 목록 - 가로 레이아웃 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6" style={{ minHeight: '400px' }}>
          {/* 필수 조건 목록 */}
          <div className="card flex-1">
            <h3 style={{ color: '#dc3545' }}>🚫 필수 조건 (Must-have)</h3>
            <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
              시간표 생성 시 반드시 지켜져야 하는 조건들입니다. 이 조건들이 충족되지 않으면 시간표 생성이 실패할 수 있습니다.
            </p>
            
            <SortableContext
              items={constraints.must.map((_, index) => `must-${index}`)}
              strategy={verticalListSortingStrategy}
            >
              {constraints.must.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666', border: '2px dashed #dc3545', borderRadius: '8px' }}>
                  <p>설정된 필수 조건이 없습니다.</p>
                  <p style={{ fontSize: '12px', marginTop: '5px' }}>드래그하여 조건을 이동할 수 있습니다</p>
                </div>
              ) : (
                <div>
                  {constraints.must.map((constraint, index) => (
                    <SortableConstraintItem
                      key={`must-${index}`}
                      constraint={constraint}
                      index={index}
                      priority="must"
                      onRemove={handleRemoveConstraint}
                      getConstraintTypeName={getConstraintTypeName}
                    />
                  ))}
                </div>
              )}
            </SortableContext>
          </div>

          {/* 선택 조건 목록 */}
          <div className="card flex-1">
            <h3 style={{ color: '#fd7e14' }}>💡 선택 조건 (Nice-to-have)</h3>
            <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
              가능하면 지켜지는 조건들입니다. 시간표 생성 시 이 조건들을 최대한 만족시키려고 노력하지만, 불가능한 경우 무시될 수 있습니다.
            </p>
            
            <SortableContext
              items={constraints.optional.map((_, index) => `optional-${index}`)}
              strategy={verticalListSortingStrategy}
            >
              {constraints.optional.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666', border: '2px dashed #fd7e14', borderRadius: '8px' }}>
                  <p>설정된 선택 조건이 없습니다.</p>
                  <p style={{ fontSize: '12px', marginTop: '5px' }}>드래그하여 조건을 이동할 수 있습니다</p>
                </div>
              ) : (
                <div>
                  {constraints.optional.map((constraint, index) => (
                    <SortableConstraintItem
                      key={`optional-${index}`}
                      constraint={constraint}
                      index={index}
                      priority="optional"
                      onRemove={handleRemoveConstraint}
                      getConstraintTypeName={getConstraintTypeName}
                    />
                  ))}
                </div>
              )}
            </SortableContext>
          </div>
        </div>
      </DndContext>

      {/* 제약 조건 유형 설명 */}
      <div className="card" style={{ backgroundColor: '#f8f9fa' }}>
        <h3>📖 제약 조건 유형 설명</h3>
        <div className="grid grid-2" style={{ marginTop: '20px' }}>
          {constraintTypes.map(type => (
            <div key={type.id} style={{ marginBottom: '15px' }}>
              <h4 style={{ color: '#667eea', fontSize: '16px' }}>{type.name}</h4>
              <p style={{ color: '#666', fontSize: '14px' }}>{type.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 네비게이션 */}
      <div className="navigation">
        <button className="btn btn-secondary" onClick={prevStep}>
          ← 이전 단계
        </button>
        <button className="btn btn-primary" onClick={nextStep}>
          다음 단계 →
        </button>
      </div>
    </div>
  );
}

export default ConstraintSettings; 