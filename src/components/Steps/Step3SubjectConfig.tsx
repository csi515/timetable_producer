import React, { useState, useEffect } from 'react';
import { Subject } from '../../types/subject';
import { useTimetableStore } from '../../store/timetableStore';

export const Step3SubjectConfig: React.FC = () => {
  const subjects = useTimetableStore((state) => state.subjects);
  const setSubjects = useTimetableStore((state) => state.setSubjects);
  const setStepValidation = useTimetableStore((state) => state.setStepValidation);

  const [name, setName] = useState('');
  const [weeklyHours, setWeeklyHours] = useState(3);
  const [requiresSpecialRoom, setRequiresSpecialRoom] = useState(false);
  const [specialRoomType, setSpecialRoomType] = useState('');
  const [isBlockClass, setIsBlockClass] = useState(false);
  const [blockHours, setBlockHours] = useState(3);
  const [isCoTeaching, setIsCoTeaching] = useState(false);
  const [isExternalInstructor, setIsExternalInstructor] = useState(false);
  const [preferConcentrated, setPreferConcentrated] = useState(false);

  useEffect(() => {
    setStepValidation(3, subjects.length > 0);
  }, [subjects, setStepValidation]);

  const handleAdd = () => {
    if (!name.trim()) {
      alert('과목명을 입력해주세요.');
      return;
    }

    if (subjects.some(s => s.name === name.trim())) {
      alert('이미 등록된 과목입니다.');
      return;
    }

    const newSubject: Subject = {
      id: `subject-${Date.now()}`,
      name: name.trim(),
      weeklyHours,
      requiresSpecialRoom,
      specialRoomType: requiresSpecialRoom ? specialRoomType : undefined,
      isBlockClass,
      blockHours: isBlockClass ? blockHours : undefined,
      isCoTeaching,
      coTeachingTeachers: isCoTeaching ? [] : undefined,
      isExternalInstructor,
      preferConcentrated: isExternalInstructor ? preferConcentrated : false,
      priority: 100
    };

    setSubjects([...subjects, newSubject]);

    // 폼 초기화
    setName('');
    setWeeklyHours(3);
    setRequiresSpecialRoom(false);
    setSpecialRoomType('');
    setIsBlockClass(false);
    setBlockHours(3);
    setIsCoTeaching(false);
    setIsExternalInstructor(false);
    setPreferConcentrated(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('이 과목을 삭제하시겠습니까?')) {
      setSubjects(subjects.filter(s => s.id !== id));
    }
  };

  return (
    <div className="step-content">
      <h2>3단계: 과목 설정</h2>
      <p className="step-description">시간표에 포함할 과목을 추가해주세요.</p>

      <div className="input-form">
        <div className="input-group">
          <label>과목명: <span className="required">*</span></label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 수학, 영어, 과학"
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
        </div>

        <div className="input-group">
          <label>주간 시수: <span className="required">*</span></label>
          <input
            type="number"
            min="1"
            max="10"
            value={weeklyHours}
            onChange={(e) => setWeeklyHours(parseInt(e.target.value) || 1)}
          />
          <span className="input-hint">주당 수업 시수</span>
        </div>

        <div className="input-group">
          <label>
            <input
              type="checkbox"
              checked={requiresSpecialRoom}
              onChange={(e) => setRequiresSpecialRoom(e.target.checked)}
            />
            특별실 필요
          </label>
          {requiresSpecialRoom && (
            <input
              type="text"
              value={specialRoomType}
              onChange={(e) => setSpecialRoomType(e.target.value)}
              placeholder="예: 과학실, 음악실, 컴퓨터실"
              className="special-room-input"
            />
          )}
        </div>

        <div className="input-group">
          <label>
            <input
              type="checkbox"
              checked={isBlockClass}
              onChange={(e) => setIsBlockClass(e.target.checked)}
            />
            블록 수업 (연속 수업)
          </label>
          {isBlockClass && (
            <select
              value={blockHours}
              onChange={(e) => setBlockHours(parseInt(e.target.value))}
            >
              <option value={3}>3교시 연속</option>
              <option value={4}>4교시 연속</option>
            </select>
          )}
        </div>

        <div className="input-group">
          <label>
            <input
              type="checkbox"
              checked={isCoTeaching}
              onChange={(e) => setIsCoTeaching(e.target.checked)}
            />
            공동수업 (여러 교사 필요)
          </label>
        </div>

        <div className="input-group">
          <label>
            <input
              type="checkbox"
              checked={isExternalInstructor}
              onChange={(e) => setIsExternalInstructor(e.target.checked)}
            />
            외부 강사
          </label>
          {isExternalInstructor && (
            <label className="nested-checkbox">
              <input
                type="checkbox"
                checked={preferConcentrated}
                onChange={(e) => setPreferConcentrated(e.target.checked)}
              />
              하루 몰아서 배치 선호
            </label>
          )}
        </div>

        <button onClick={handleAdd} className="add-button">과목 추가</button>
      </div>

      <div className="subject-list">
        <h3>등록된 과목 ({subjects.length}개)</h3>
        {subjects.length === 0 ? (
          <p className="empty-message">등록된 과목이 없습니다. 과목을 추가해주세요.</p>
        ) : (
          <div className="list-grid">
            {subjects.map(subject => (
              <div key={subject.id} className="list-item">
                <div className="item-header">
                  <strong>{subject.name}</strong>
                  <button onClick={() => handleDelete(subject.id)} className="delete-button">삭제</button>
                </div>
                <div className="item-details">
                  <span>시수: {subject.weeklyHours}시간</span>
                  {subject.requiresSpecialRoom && (
                    <span className="badge">특별실: {subject.specialRoomType}</span>
                  )}
                  {subject.isBlockClass && (
                    <span className="badge">블록: {subject.blockHours}교시</span>
                  )}
                  {subject.isCoTeaching && (
                    <span className="badge">공동수업</span>
                  )}
                  {subject.isExternalInstructor && (
                    <span className="badge">외부강사</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

