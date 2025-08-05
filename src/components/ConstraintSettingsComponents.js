import React from 'react';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 드래그 가능한 조건 아이템 컴포넌트
export function SortableConstraintItem({ constraint, index, priority, onRemove, getConstraintTypeName }) {
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
  const textColor = priority === 'must' ? '#dc3545' : '#fd7e14';

  // 삭제 버튼 클릭 핸들러 (이벤트 전파 중지)
  const handleDelete = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onRemove(priority, index);
  };

  return (
    <div 
      ref={setNodeRef} 
      className="card" 
      style={{ 
        marginBottom: '10px', 
        border: `2px solid ${borderColor}`,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* 드래그 핸들과 컨텐츠 영역 */}
        <div 
          {...attributes} 
          {...listeners}
          style={{ 
            flex: 1, 
            minWidth: 0, 
            cursor: 'grab',
            padding: '5px 0'
          }}
        >
          <h4 className="text-ellipsis" style={{ color: textColor, marginBottom: '5px' }} title={getConstraintTypeName(constraint.type)}>
            {getConstraintTypeName(constraint.type)}
          </h4>
          {constraint.subject && (
            <p className="text-ellipsis">
              <strong>{constraint.type === 'block_period_requirement' ? '교사' : '과목'}:</strong> <span title={constraint.subject === 'all' ? '모든 수업에 해당' : constraint.subject}>
                {constraint.subject === 'all' ? '모든 수업에 해당' : constraint.subject}
              </span>
            </p>
          )}
          {constraint.subjects && constraint.subjects.length > 0 && (
            <p className="text-ellipsis">
              <strong>고정수업 전용 과목:</strong> <span title={constraint.subjects.join(', ')}>
                {constraint.subjects.length > 3 ? 
                  `${constraint.subjects.slice(0, 3).join(', ')}... (${constraint.subjects.length}개)` : 
                  constraint.subjects.join(', ')
                }
              </span>
            </p>
          )}
          {constraint.day && <p className="text-ellipsis"><strong>시간:</strong> {constraint.day}요일 {constraint.period}교시</p>}
          {constraint.mainTeacher && (
            <p className="text-ellipsis">
              <strong>주교사:</strong> <span title={constraint.mainTeacher}>{constraint.mainTeacher}</span>
            </p>
          )}
          {constraint.coTeachers && constraint.coTeachers.length > 0 && (
            <p className="text-ellipsis">
              <strong>부교사:</strong> <span title={constraint.coTeachers.join(', ')}>{constraint.coTeachers.join(', ')}</span>
            </p>
          )}
          {constraint.class && <p className="text-ellipsis"><strong>학급:</strong> {constraint.class}</p>}
          {constraint.maxPeriods && <p className="text-ellipsis"><strong>최대 교시:</strong> {constraint.maxPeriods}교시</p>}
          {constraint.description && (
            <p className="text-ellipsis" style={{ fontSize: '0.9em', color: '#666' }}>
              {constraint.description}
            </p>
          )}
        </div>
        
        {/* 삭제 버튼 */}
        <button
          onClick={handleDelete}
          style={{
            background: 'none',
            border: 'none',
            color: '#dc3545',
            cursor: 'pointer',
            fontSize: '1.2em',
            padding: '5px',
            marginLeft: '10px'
          }}
          title="삭제"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// 조건 타입 선택 컴포넌트
export function ConstraintTypeSelector({ constraintType, onTypeChange, constraintTypes }) {
  return (
    <div className="form-group">
      <label htmlFor="constraintType">조건 타입:</label>
      <select
        id="constraintType"
        className="form-control"
        value={constraintType}
        onChange={(e) => onTypeChange(e.target.value)}
      >
        <option value="">조건 타입을 선택하세요</option>
        {constraintTypes.map(type => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>
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
  const renderInputFields = () => {
    switch (constraintType) {
      case 'block_period_requirement':
        return (
          <>
            <div className="form-group">
              <label htmlFor="subject">교사:</label>
              <select
                id="subject"
                className="form-control"
                value={newConstraint.subject || ''}
                onChange={(e) => onConstraintChange('subject', e.target.value)}
              >
                <option value="">교사를 선택하세요</option>
                {teachers.map(teacher => (
                  <option key={teacher.name} value={teacher.name}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="day">요일:</label>
              <select
                id="day"
                className="form-control"
                value={newConstraint.day || ''}
                onChange={(e) => onConstraintChange('day', e.target.value)}
              >
                <option value="">요일을 선택하세요</option>
                {days.map(day => (
                  <option key={day} value={day}>{day}요일</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="period">교시:</label>
              <select
                id="period"
                className="form-control"
                value={newConstraint.period || ''}
                onChange={(e) => onConstraintChange('period', parseInt(e.target.value))}
              >
                <option value="">교시를 선택하세요</option>
                {[1, 2, 3, 4, 5, 6, 7].map(period => (
                  <option key={period} value={period}>{period}교시</option>
                ))}
              </select>
            </div>
          </>
        );

      case 'co_teaching_requirement':
        return (
          <>
            <div className="form-group">
              <label htmlFor="mainTeacher">주교사:</label>
              <select
                id="mainTeacher"
                className="form-control"
                value={newConstraint.mainTeacher || ''}
                onChange={(e) => onConstraintChange('mainTeacher', e.target.value)}
              >
                <option value="">주교사를 선택하세요</option>
                {teachers.map(teacher => (
                  <option key={teacher.name} value={teacher.name}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="coTeachers">부교사 (쉼표로 구분):</label>
              <input
                type="text"
                id="coTeachers"
                className="form-control"
                value={newConstraint.coTeachers || ''}
                onChange={(e) => onConstraintChange('coTeachers', e.target.value)}
                placeholder="예: 김교사, 이교사"
              />
            </div>
            <div className="form-group">
              <label htmlFor="class">학급:</label>
              <select
                id="class"
                className="form-control"
                value={newConstraint.class || ''}
                onChange={(e) => onConstraintChange('class', e.target.value)}
              >
                <option value="">학급을 선택하세요</option>
                {classes.map(className => (
                  <option key={className} value={className}>{className}</option>
                ))}
              </select>
            </div>
          </>
        );

      case 'class_daily_subject_once':
        return (
          <div className="form-group">
            <label htmlFor="subject">과목:</label>
            <select
              id="subject"
              className="form-control"
              value={newConstraint.subject || ''}
              onChange={(e) => onConstraintChange('subject', e.target.value)}
            >
              <option value="">과목을 선택하세요</option>
              {subjects.map(subject => (
                <option key={subject.name} value={subject.name}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>
        );

      case 'teacher_unavailable_time':
        return (
          <>
            <div className="form-group">
              <label htmlFor="subject">교사:</label>
              <select
                id="subject"
                className="form-control"
                value={newConstraint.subject || ''}
                onChange={(e) => onConstraintChange('subject', e.target.value)}
              >
                <option value="">교사를 선택하세요</option>
                {teachers.map(teacher => (
                  <option key={teacher.name} value={teacher.name}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="day">요일:</label>
              <select
                id="day"
                className="form-control"
                value={newConstraint.day || ''}
                onChange={(e) => onConstraintChange('day', e.target.value)}
              >
                <option value="">요일을 선택하세요</option>
                {days.map(day => (
                  <option key={day} value={day}>{day}요일</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="period">교시:</label>
              <select
                id="period"
                className="form-control"
                value={newConstraint.period || ''}
                onChange={(e) => onConstraintChange('period', parseInt(e.target.value))}
              >
                <option value="">교시를 선택하세요</option>
                {[1, 2, 3, 4, 5, 6, 7].map(period => (
                  <option key={period} value={period}>{period}교시</option>
                ))}
              </select>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="constraint-input-form">
      {renderInputFields()}
      <div className="form-group">
        <label htmlFor="description">설명 (선택사항):</label>
        <input
          type="text"
          id="description"
          className="form-control"
          value={newConstraint.description || ''}
          onChange={(e) => onConstraintChange('description', e.target.value)}
          placeholder="조건에 대한 추가 설명"
        />
      </div>
    </div>
  );
} 