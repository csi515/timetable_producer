import React, { useState, useEffect } from 'react';
import { Subject } from '../../types/subject';
import { useTimetableStore } from '../../store/timetableStore';
import { TimeGridSelector } from '../Common/TimeGridSelector';

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
  const [hasFixedTime, setHasFixedTime] = useState(false);
  const [fixedTimes, setFixedTimes] = useState<{ day: string; period: number }[]>([]);
  const [targetGrades, setTargetGrades] = useState<number[]>([1, 2, 3]);

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

    if (targetGrades.length === 0) {
      alert('최소 한 개 이상의 대상 학년을 선택해주세요.');
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
      fixedTimes: hasFixedTime ? fixedTimes : undefined,
      targetGrades,
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
    setHasFixedTime(false);
    setFixedTimes([]);
    setTargetGrades([1, 2, 3]);
  };

  const handleDelete = (id: string) => {
    if (confirm('이 과목을 삭제하시겠습니까?')) {
      setSubjects(subjects.filter(s => s.id !== id));
    }
  };

  const handleGradeToggle = (grade: number) => {
    setTargetGrades(prev =>
      prev.includes(grade)
        ? prev.filter(g => g !== grade)
        : [...prev, grade].sort()
    );
  };

  return (
    <div className="step-content modern-step-container">
      <div className="step-header">
        <h2>과목 설정</h2>
        <p className="step-description">시간표에 포함할 과목을 추가해주세요.</p>
      </div>

      <div className="modern-config-card">
        <div className="config-section">
          <h3 className="section-title">과목 추가</h3>

          <div className="modern-form">
            <div className="modern-input-group">
              <label className="modern-label">과목명 <span className="required">*</span></label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 수학, 영어, 과학"
                onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
                className="modern-input"
              />
            </div>

            <div className="modern-input-group">
              <label className="modern-label">대상 학년 <span className="required">*</span></label>
              <div className="flex gap-4 mt-2">
                {[1, 2, 3].map(grade => (
                  <label key={grade} className="modern-checkbox">
                    <input
                      type="checkbox"
                      checked={targetGrades.includes(grade)}
                      onChange={() => handleGradeToggle(grade)}
                    />
                    <span>{grade}학년</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="modern-input-group">
              <label className="modern-label">주간 시수 <span className="required">*</span></label>
              <input
                type="number"
                min="1"
                max="10"
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(parseInt(e.target.value) || 1)}
                className="modern-input"
              />
              <span className="input-hint-modern">주당 수업 시수</span>
            </div>

            <div className="modern-checkbox-group">
              <label className="modern-checkbox">
                <input
                  type="checkbox"
                  checked={requiresSpecialRoom}
                  onChange={(e) => setRequiresSpecialRoom(e.target.checked)}
                />
                <span>특별실 필요</span>
              </label>
              {requiresSpecialRoom && (
                <input
                  type="text"
                  value={specialRoomType}
                  onChange={(e) => setSpecialRoomType(e.target.value)}
                  placeholder="예: 과학실, 음악실, 컴퓨터실"
                  className="modern-input nested-input"
                />
              )}
            </div>

            <div className="modern-checkbox-group">
              <label className="modern-checkbox">
                <input
                  type="checkbox"
                  checked={isBlockClass}
                  onChange={(e) => setIsBlockClass(e.target.checked)}
                />
                <span>블록 수업 (연속 수업)</span>
              </label>
              {isBlockClass && (
                <select
                  value={blockHours}
                  onChange={(e) => setBlockHours(parseInt(e.target.value))}
                  className="modern-select"
                >
                  <option value={3}>3교시 연속</option>
                  <option value={4}>4교시 연속</option>
                </select>
              )}
            </div>

            <div className="modern-checkbox-group">
              <label className="modern-checkbox">
                <input
                  type="checkbox"
                  checked={isCoTeaching}
                  onChange={(e) => setIsCoTeaching(e.target.checked)}
                />
                <span>공동수업 (여러 교사 필요)</span>
              </label>
            </div>

            <div className="modern-checkbox-group">
              <label className="modern-checkbox">
                <input
                  type="checkbox"
                  checked={isExternalInstructor}
                  onChange={(e) => setIsExternalInstructor(e.target.checked)}
                />
                <span>외부 강사</span>
              </label>
              {isExternalInstructor && (
                <label className="modern-checkbox nested-checkbox">
                  <input
                    type="checkbox"
                    checked={preferConcentrated}
                    onChange={(e) => setPreferConcentrated(e.target.checked)}
                  />
                  <span>하루 몰아서 배치 선호</span>
                </label>
              )}
            </div>

            <div className="modern-input-group">
              <label className="modern-label">고정 시간 배정 (선택 사항)</label>
              <p className="input-hint-modern">동아리 활동이나 CA 등 특정 시간에 고정되어야 하는 경우 설정하세요.</p>

              <div className="modern-checkbox-group">
                <label className="modern-checkbox">
                  <input
                    type="checkbox"
                    checked={hasFixedTime}
                    onChange={(e) => setHasFixedTime(e.target.checked)}
                  />
                  <span>고정 시간 설정</span>
                </label>
              </div>

              {hasFixedTime && (
                <div className="mt-2">
                  <TimeGridSelector
                    days={['월', '화', '수', '목', '금']}
                    maxPeriods={7}
                    selectedTimes={fixedTimes}
                    onSelectedChange={setFixedTimes}
                    type="fixed"
                    labels={{
                      selected: '고정 배정',
                      unselected: '배정 안함',
                      clearAll: '전체 해제',
                      selectAll: '전체 선택'
                    }}
                  />
                </div>
              )}
            </div>

            <button onClick={handleAdd} className="modern-button primary">
              과목 추가
            </button>
          </div>
        </div>

        <div className="config-section">
          <h3 className="section-title">등록된 과목 ({subjects.length}개)</h3>
          {subjects.length === 0 ? (
            <div className="empty-state">
              <p>등록된 과목이 없습니다. 과목을 추가해주세요.</p>
            </div>
          ) : (
            <div className="modern-list-grid">
              {subjects.map(subject => (
                <div key={subject.id} className="modern-list-item">
                  <div className="item-header">
                    <strong>{subject.name}</strong>
                    <button onClick={() => handleDelete(subject.id)} className="modern-button-small delete">
                      삭제
                    </button>
                  </div>
                  <div className="item-details">
                    <span className="detail-text">시수: {subject.weeklyHours}시간</span>
                    <span className="modern-badge">대상: {subject.targetGrades.join(', ')}학년</span>
                    {subject.requiresSpecialRoom && (
                      <span className="modern-badge">특별실: {subject.specialRoomType}</span>
                    )}
                    {subject.isBlockClass && (
                      <span className="modern-badge">블록: {subject.blockHours}교시</span>
                    )}
                    {subject.isCoTeaching && (
                      <span className="modern-badge">공동수업</span>
                    )}
                    {subject.isExternalInstructor && (
                      <span className="modern-badge">외부강사</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

