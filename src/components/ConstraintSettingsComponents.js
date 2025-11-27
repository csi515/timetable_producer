import React from 'react';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getConstraintTypeName } from './ConstraintSettingsHelpers';

// 드래그 가능한 조건 아이템 컴포넌트
export function SortableConstraintItem({ constraint, index, priority, onRemove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${priority}-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const borderColor = priority === 'must' ? '#dc3545' : '#fd7e14';
  const bgColor = priority === 'must' ? '#fef2f2' : '#fff7ed';
  const textColor = priority === 'must' ? '#dc3545' : '#fd7e14';

  // 삭제 버튼 클릭 핸들러 (이벤트 전파 중지)
  const handleDelete = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onRemove();
  };

  // 제약조건 타입 이름 가져오기
  const getConstraintTypeDisplayName = (type) => {
    const typeNames = {
      'no_duplicate_teachers': '👥 교사 중복 배정 금지',
      'no_duplicate_classes': '📚 학급 중복 배정 금지',
      'class_max_daily_periods': '⏰ 학급 일일 최대 교시 수 제한',
      'subject_weekly_hours': '📅 과목 주당 시수 고정',
      'space_constraint': '🏫 특별실 공간 제약',
      'teacher_same_class_daily_limit': '👨‍🏫 교사 일일 학급 중복 금지',
      'class_daily_subject_once': '📖 학급 일일 과목 중복 금지',
      'specific_teacher_co_teaching': '🤝 특정 교사 공동수업 설정',
      'subject_fixed_only': '🔒 특정 과목 고정 수업만 허용',
      'block_period_requirement': '🔗 블록 수업 요구사항',
      'teacher_mutual_exclusion': '❌ 교사 상호 배제',
      'teacher_unavailable_times': '🚫 교사 불가능 시간대',
      'teacher_hours_limit': '⏱️ 교사 주당 최대 수업 시간',
      'sequential_grade_teaching': '📈 교사 연속 학년 수업',
      'special_room_conflict': '🏢 특별실 사용 충돌 방지',
      'co_teaching_requirement': '👥 공동수업 요구사항'
    };
    return typeNames[type] || getConstraintTypeName(type);
  };

  return (
    <div 
      ref={setNodeRef} 
      className="bg-white rounded-xl border-2 shadow-md hover:shadow-lg transition-all duration-200"
      style={{
        borderColor: borderColor,
        backgroundColor: bgColor,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <div className="p-6">
        {/* 헤더 영역 */}
        <div className="flex items-center justify-between mb-4">
          <div 
            {...attributes} 
            {...listeners}
            className="flex-1 cursor-grab active:cursor-grabbing"
          >
            <h4 className="text-lg font-bold" style={{ color: textColor }}>
              {getConstraintTypeDisplayName(constraint.type)}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span 
                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  priority === 'must' 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {priority === 'must' ? '🔴 필수' : '🟡 선택'}
              </span>
              {constraint.description && (
                <span className="text-sm text-gray-600">
                  {constraint.description}
                </span>
              )}
            </div>
          </div>
          
          <button 
            onClick={handleDelete}
            className="ml-4 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            title="제약조건 삭제"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* 상세 정보 영역 */}
        <div className="space-y-3">
          {constraint.subject && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">
                {['block_period_requirement', 'teacher_unavailable_time'].includes(constraint.type) ? '교사:' : '과목:'}
              </span>
              <span className="text-sm text-gray-600 bg-white px-2 py-1 rounded border">
                {constraint.subject === 'all' ? '모든 수업에 해당' : constraint.subject}
              </span>
            </div>
          )}
          
          {constraint.subjects && constraint.subjects.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">고정수업 전용 과목:</span>
              <div className="flex flex-wrap gap-1">
                {constraint.subjects.slice(0, 3).map((subject, idx) => (
                  <span key={idx} className="text-sm text-gray-600 bg-white px-2 py-1 rounded border">
                    {subject}
                  </span>
                ))}
                {constraint.subjects.length > 3 && (
                  <span className="text-sm text-gray-500">
                    ... (+{constraint.subjects.length - 3}개)
                  </span>
                )}
              </div>
            </div>
          )}
          
          {constraint.day && constraint.period && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">시간:</span>
              <span className="text-sm text-gray-600 bg-white px-2 py-1 rounded border">
                {constraint.day}요일 {constraint.period}교시
              </span>
            </div>
          )}
          
          {constraint.mainTeacher && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">주교사:</span>
              <span className="text-sm text-gray-600 bg-white px-2 py-1 rounded border">
                {constraint.mainTeacher}
              </span>
            </div>
          )}
          
          {constraint.coTeachers && constraint.coTeachers.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">부교사:</span>
              <div className="flex flex-wrap gap-1">
                {constraint.coTeachers.map((teacher, idx) => (
                  <span key={idx} className="text-sm text-gray-600 bg-white px-2 py-1 rounded border">
                    {teacher}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {constraint.teacher1 && constraint.teacher2 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">제한 교사:</span>
              <span className="text-sm text-gray-600 bg-white px-2 py-1 rounded border">
                {constraint.teacher1} ↔ {constraint.teacher2}
              </span>
            </div>
          )}
          
          {constraint.maxPeriods && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">최대 교시:</span>
              <span className="text-sm text-gray-600 bg-white px-2 py-1 rounded border">
                {constraint.maxPeriods}교시
              </span>
            </div>
          )}
        </div>

        {/* 드래그 안내 */}
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
            <span>드래그하여 순서 변경</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 조건 타입 선택 컴포넌트
export function ConstraintTypeSelector({ constraintTypes, selectedType, onTypeChange }) {
  // JSON 파일의 제약조건들을 포함한 확장된 제약조건 타입들
  const extendedConstraintTypes = [
    // 기본 제약조건들
    { value: 'no_duplicate_teachers', label: '👥 교사 중복 배정 금지', category: '기본' },
    { value: 'no_duplicate_classes', label: '📚 학급 중복 배정 금지', category: '기본' },
    { value: 'class_max_daily_periods', label: '⏰ 학급 일일 최대 교시 수 제한', category: '기본' },
    { value: 'subject_weekly_hours', label: '📅 과목 주당 시수 고정', category: '기본' },
    { value: 'space_constraint', label: '🏫 특별실 공간 제약', category: '기본' },
    
    // 교사 관련 제약조건들
    { value: 'teacher_same_class_daily_limit', label: '👨‍🏫 교사 일일 학급 중복 금지', category: '교사' },
    { value: 'teacher_unavailable_times', label: '🚫 교사 불가능 시간대', category: '교사' },
    { value: 'teacher_hours_limit', label: '⏱️ 교사 주당 최대 수업 시간', category: '교사' },
    { value: 'teacher_mutual_exclusion', label: '❌ 교사 상호 배제', category: '교사' },
    { value: 'sequential_grade_teaching', label: '📈 교사 연속 학년 수업', category: '교사' },
    
    // 과목 관련 제약조건들
    { value: 'class_daily_subject_once', label: '📖 학급 일일 과목 중복 금지', category: '과목' },
    { value: 'subject_fixed_only', label: '🔒 특정 과목 고정 수업만 허용', category: '과목' },
    { value: 'block_period_requirement', label: '🔗 블록 수업 요구사항', category: '과목' },
    { value: 'special_room_conflict', label: '🏢 특별실 사용 충돌 방지', category: '과목' },
    
    // 공동수업 관련 제약조건들
    { value: 'specific_teacher_co_teaching', label: '🤝 특정 교사 공동수업 설정', category: '공동수업' },
    { value: 'co_teaching_requirement', label: '👥 공동수업 요구사항', category: '공동수업' },
    
    // JSON 파일에서 추가된 제약조건들
    { value: 'teacher_same_class_daily_limit', label: '👨‍🏫 교사 일일 학급 중복 금지 (JSON)', category: 'JSON' },
    { value: 'class_daily_subject_once', label: '📖 학급 일일 과목 중복 금지 (JSON)', category: 'JSON' },
    { value: 'subject_fixed_only', label: '🔒 특정 과목 고정 수업만 허용 (JSON)', category: 'JSON' },
    { value: 'block_period_requirement', label: '🔗 블록 수업 요구사항 (JSON)', category: 'JSON' },
    { value: 'teacher_mutual_exclusion', label: '❌ 교사 상호 배제 (JSON)', category: 'JSON' },
    { value: 'specific_teacher_co_teaching', label: '🤝 특정 교사 공동수업 설정 (JSON)', category: 'JSON' }
  ];

  // 카테고리별로 그룹화
  const groupedTypes = extendedConstraintTypes.reduce((acc, type) => {
    if (!acc[type.category]) {
      acc[type.category] = [];
    }
    acc[type.category].push(type);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <select
        value={selectedType}
        onChange={(e) => onTypeChange(e.target.value)}
        className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
      >
        <option value="">제약조건 유형을 선택하세요</option>
        {Object.entries(groupedTypes).map(([category, types]) => (
          <optgroup key={category} label={`${category} 제약조건`}>
            {types.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      
      {/* 제약조건 카테고리 설명 */}
      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
        <div className="p-3 bg-gray-50 rounded-lg">
          <h4 className="font-semibold text-gray-800 mb-2">🔧 기본 제약조건</h4>
          <p>시간표 생성의 기본 규칙들</p>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-blue-800 mb-2">👨‍🏫 교사 제약조건</h4>
          <p>교사 관련 특별 규칙들</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg">
          <h4 className="font-semibold text-green-800 mb-2">📚 과목 제약조건</h4>
          <p>과목 배치 관련 규칙들</p>
        </div>
        <div className="p-3 bg-purple-50 rounded-lg">
          <h4 className="font-semibold text-purple-800 mb-2">🤝 공동수업 제약조건</h4>
          <p>공동수업 관련 규칙들</p>
        </div>
      </div>
    </div>
  );
}

// 조건 입력 폼 컴포넌트
export function ConstraintInputForm({ 
  constraintType, 
  newConstraint, 
  onConstraintChange, 
  subjects, 
  teachers, 
  classes,
  days 
}) {
  // constraintType이 없으면 아무것도 렌더링하지 않음
  if (!constraintType) {
    return null;
  }

  const renderInputFields = () => {
    switch (constraintType) {
      case 'block_period_requirement':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-3">교사</label>
              <select
                value={newConstraint.subject || ''}
                onChange={(e) => onConstraintChange('subject', e.target.value)}
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
              >
                <option value="">교사를 선택하세요</option>
                {teachers.map(teacher => (
                  <option key={teacher.name} value={teacher.name}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-3">요일</label>
              <select
                value={newConstraint.day || ''}
                onChange={(e) => onConstraintChange('day', e.target.value)}
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
              >
                <option value="">요일을 선택하세요</option>
                {days.map(day => (
                  <option key={day} value={day}>{day}요일</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-3">교시</label>
              <select
                value={newConstraint.period || ''}
                onChange={(e) => onConstraintChange('period', parseInt(e.target.value))}
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
              >
                <option value="">교시를 선택하세요</option>
                {[1, 2, 3, 4, 5, 6, 7].map(period => (
                  <option key={period} value={period}>{period}교시</option>
                ))}
              </select>
            </div>
          </div>
        );

      case 'co_teaching_requirement':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-3">주교사</label>
              <select
                value={newConstraint.mainTeacher || ''}
                onChange={(e) => onConstraintChange('mainTeacher', e.target.value)}
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
              >
                <option value="">주교사를 선택하세요</option>
                {teachers.map(teacher => (
                  <option key={teacher.name} value={teacher.name}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-3">부교사 (쉼표로 구분)</label>
              <input
                type="text"
                value={newConstraint.coTeachers || ''}
                onChange={(e) => onConstraintChange('coTeachers', e.target.value)}
                placeholder="예: 김교사, 이교사"
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
              />
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-3">학급</label>
              <select
                value={newConstraint.class || ''}
                onChange={(e) => onConstraintChange('class', e.target.value)}
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
              >
                <option value="">학급을 선택하세요</option>
                {classes.map(className => (
                  <option key={className} value={className}>
                    {className}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 'teacher_mutual_exclusion':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-3">교사 1</label>
              <select
                value={newConstraint.teacher1 || ''}
                onChange={(e) => onConstraintChange('teacher1', e.target.value)}
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
              >
                <option value="">교사를 선택하세요</option>
                {teachers.map(teacher => (
                  <option key={teacher.name} value={teacher.name}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-3">교사 2</label>
              <select
                value={newConstraint.teacher2 || ''}
                onChange={(e) => onConstraintChange('teacher2', e.target.value)}
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
              >
                <option value="">교사를 선택하세요</option>
                {teachers.map(teacher => (
                  <option key={teacher.name} value={teacher.name}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 'subject_fixed_only':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-3">고정 수업만 허용할 과목들</label>
              <div className="space-y-3">
                {subjects.map(subject => (
                  <label key={subject.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newConstraint.subjects?.includes(subject.name) || false}
                      onChange={(e) => {
                        const currentSubjects = newConstraint.subjects || [];
                        if (e.target.checked) {
                          onConstraintChange('subjects', [...currentSubjects, subject.name]);
                        } else {
                          onConstraintChange('subjects', currentSubjects.filter(s => s !== subject.name));
                        }
                      }}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-lg">{subject.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'specific_teacher_co_teaching':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-3">주교사</label>
              <select
                value={newConstraint.mainTeacher || ''}
                onChange={(e) => onConstraintChange('mainTeacher', e.target.value)}
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
              >
                <option value="">주교사를 선택하세요</option>
                {teachers.map(teacher => (
                  <option key={teacher.name} value={teacher.name}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-3">부교사들</label>
              <div className="space-y-3">
                {teachers.map(teacher => (
                  <label key={teacher.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newConstraint.coTeachers?.includes(teacher.name) || false}
                      onChange={(e) => {
                        const currentCoTeachers = newConstraint.coTeachers || [];
                        if (e.target.checked) {
                          onConstraintChange('coTeachers', [...currentCoTeachers, teacher.name]);
                        } else {
                          onConstraintChange('coTeachers', currentCoTeachers.filter(t => t !== teacher.name));
                        }
                      }}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-lg">{teacher.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'class_daily_subject_once':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-3">적용할 과목</label>
              <select
                value={newConstraint.subject || ''}
                onChange={(e) => onConstraintChange('subject', e.target.value)}
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
              >
                <option value="">과목을 선택하세요</option>
                <option value="all">모든 과목</option>
                {subjects.map(subject => (
                  <option key={subject.name} value={subject.name}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      default:
        return (
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-blue-800">
              <strong>설정 완료:</strong> 이 제약조건은 추가 설정이 필요하지 않습니다.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
        <h4 className="text-lg font-semibold text-gray-800 mb-2">제약조건 설정</h4>
        <p className="text-sm text-gray-600">
          선택한 제약조건에 필요한 추가 정보를 입력해주세요.
        </p>
      </div>
      
      {renderInputFields()}
    </div>
  );
} 