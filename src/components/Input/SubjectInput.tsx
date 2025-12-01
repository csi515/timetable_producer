import React, { useState } from 'react';
import { Subject } from '../../types/subject';
import { useTimetableStore } from '../../store/timetableStore';

export const SubjectInput: React.FC = () => {
  const subjects = useTimetableStore((state) => state.subjects);
  const setSubjects = useTimetableStore((state) => state.setSubjects);

  const [name, setName] = useState('');
  const [weeklyHours, setWeeklyHours] = useState(3);
  const [requiresSpecialRoom, setRequiresSpecialRoom] = useState(false);
  const [specialRoomType, setSpecialRoomType] = useState('');
  const [isBlockClass, setIsBlockClass] = useState(false);
  const [blockHours, setBlockHours] = useState(3);
  const [isCoTeaching, setIsCoTeaching] = useState(false);
  const [isExternalInstructor, setIsExternalInstructor] = useState(false);
  const [preferConcentrated, setPreferConcentrated] = useState(false);
  const [targetGrades, setTargetGrades] = useState<number[]>([1, 2, 3]);

  const handleGradeToggle = (grade: number) => {
    setTargetGrades(prev =>
      prev.includes(grade)
        ? prev.filter(g => g !== grade)
        : [...prev, grade].sort()
    );
  };

  const handleAdd = () => {
    if (!name) {
      alert('과목명을 입력해주세요.');
      return;
    }

    const newSubject: Subject = {
      id: `subject-${Date.now()}`,
      name,
      weeklyHours,
      requiresSpecialRoom,
      specialRoomType: requiresSpecialRoom ? specialRoomType : undefined,
      isBlockClass,
      blockHours: isBlockClass ? blockHours : undefined,
      isCoTeaching,
      coTeachingTeachers: isCoTeaching ? [] : undefined,
      isExternalInstructor,
      preferConcentrated: isExternalInstructor ? preferConcentrated : false,
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
    setTargetGrades([1, 2, 3]);
  };

  const handleDelete = (id: string) => {
    setSubjects(subjects.filter(s => s.id !== id));
  };

  return (
    <div className="subject-input">
      <h2>과목 설정</h2>
      <div className="input-form">
        <div className="input-group">
          <label>과목명:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 수학, 영어"
          />
        </div>
        <div className="input-group">
          <label>주간 시수:</label>
          <input
            type="number"
            min="1"
            max="10"
            value={weeklyHours}
            onChange={(e) => setWeeklyHours(parseInt(e.target.value))}
          />
        </div>
        <div className="input-group">
          <label>대상 학년:</label>
          <div className="flex gap-4">
            {[1, 2, 3].map(grade => (
              <label key={grade} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={targetGrades.includes(grade)}
                  onChange={() => handleGradeToggle(grade)}
                />
                {grade}학년
              </label>
            ))}
          </div>
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
              placeholder="예: 과학실, 음악실"
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
            블록 수업
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
            공동수업
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
            <label>
              <input
                type="checkbox"
                checked={preferConcentrated}
                onChange={(e) => setPreferConcentrated(e.target.checked)}
              />
              하루 몰아서 배치 선호
            </label>
          )}
        </div>
        <button onClick={handleAdd}>과목 추가</button>
      </div>

      <div className="subject-list">
        <h3>등록된 과목</h3>
        {subjects.length === 0 ? (
          <p>등록된 과목이 없습니다.</p>
        ) : (
          <ul>
            {subjects.map(subject => (
              <li key={subject.id}>
                <span>{subject.name}</span>
                <span>시수: {subject.weeklyHours}</span>
                <span>대상: {subject.targetGrades.join(', ')}학년</span>
                {subject.requiresSpecialRoom && <span>특별실: {subject.specialRoomType}</span>}
                {subject.isBlockClass && <span>블록: {subject.blockHours}교시</span>}
                <button onClick={() => handleDelete(subject.id)}>삭제</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

