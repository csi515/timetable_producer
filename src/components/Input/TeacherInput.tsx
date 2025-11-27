import React, { useState } from 'react';
import { Teacher, UnavailableTime } from '../../types/teacher';
import { useTimetableStore } from '../../store/timetableStore';

export const TeacherInput: React.FC = () => {
  const teachers = useTimetableStore((state) => state.teachers);
  const subjects = useTimetableStore((state) => state.subjects);
  const setTeachers = useTimetableStore((state) => state.setTeachers);

  const [name, setName] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [maxWeeklyHours, setMaxWeeklyHours] = useState(20);
  const [isPriority, setIsPriority] = useState(false);
  const [isExternal, setIsExternal] = useState(false);
  const [unavailableDay, setUnavailableDay] = useState('월');
  const [unavailablePeriod, setUnavailablePeriod] = useState(1);
  const [unavailableTimes, setUnavailableTimes] = useState<UnavailableTime[]>([]);

  const days = ['월', '화', '수', '목', '금'];

  const handleSubjectToggle = (subjectId: string) => {
    if (selectedSubjects.includes(subjectId)) {
      setSelectedSubjects(selectedSubjects.filter(id => id !== subjectId));
    } else {
      setSelectedSubjects([...selectedSubjects, subjectId]);
    }
  };

  const handleAddUnavailable = () => {
    const newTime: UnavailableTime = {
      day: unavailableDay,
      period: unavailablePeriod
    };
    setUnavailableTimes([...unavailableTimes, newTime]);
  };

  const handleRemoveUnavailable = (index: number) => {
    setUnavailableTimes(unavailableTimes.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    if (!name) {
      alert('교사명을 입력해주세요.');
      return;
    }
    if (selectedSubjects.length === 0) {
      alert('담당 과목을 선택해주세요.');
      return;
    }

    const newTeacher: Teacher = {
      id: `teacher-${Date.now()}`,
      name,
      subjects: selectedSubjects,
      maxWeeklyHours,
      unavailableTimes,
      isPriority,
      isExternal
    };

    setTeachers([...teachers, newTeacher]);

    // 폼 초기화
    setName('');
    setSelectedSubjects([]);
    setMaxWeeklyHours(20);
    setIsPriority(false);
    setIsExternal(false);
    setUnavailableTimes([]);
  };

  const handleDelete = (id: string) => {
    setTeachers(teachers.filter(t => t.id !== id));
  };

  return (
    <div className="teacher-input">
      <h2>교사 설정</h2>
      <div className="input-form">
        <div className="input-group">
          <label>교사명:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="교사 이름"
          />
        </div>
        <div className="input-group">
          <label>담당 과목:</label>
          <div className="subject-selector">
            {subjects.map(subject => (
              <label key={subject.id} className="subject-checkbox">
                <input
                  type="checkbox"
                  checked={selectedSubjects.includes(subject.id)}
                  onChange={() => handleSubjectToggle(subject.id)}
                />
                {subject.name}
              </label>
            ))}
          </div>
        </div>
        <div className="input-group">
          <label>주간 최대 시수:</label>
          <input
            type="number"
            min="1"
            max="30"
            value={maxWeeklyHours}
            onChange={(e) => setMaxWeeklyHours(parseInt(e.target.value))}
          />
        </div>
        <div className="input-group">
          <label>
            <input
              type="checkbox"
              checked={isPriority}
              onChange={(e) => setIsPriority(e.target.checked)}
            />
            우선 배치
          </label>
        </div>
        <div className="input-group">
          <label>
            <input
              type="checkbox"
              checked={isExternal}
              onChange={(e) => setIsExternal(e.target.checked)}
            />
            외부 강사
          </label>
        </div>
        <div className="input-group">
          <label>불가능한 시간:</label>
          <div className="unavailable-time-input">
            <select
              value={unavailableDay}
              onChange={(e) => setUnavailableDay(e.target.value)}
            >
              {days.map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              max="10"
              value={unavailablePeriod}
              onChange={(e) => setUnavailablePeriod(parseInt(e.target.value))}
              placeholder="교시"
            />
            <button onClick={handleAddUnavailable}>추가</button>
          </div>
          {unavailableTimes.length > 0 && (
            <ul className="unavailable-list">
              {unavailableTimes.map((time, index) => (
                <li key={index}>
                  {time.day}요일 {time.period}교시
                  <button onClick={() => handleRemoveUnavailable(index)}>삭제</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button onClick={handleAdd}>교사 추가</button>
      </div>

      <div className="teacher-list">
        <h3>등록된 교사</h3>
        {teachers.length === 0 ? (
          <p>등록된 교사가 없습니다.</p>
        ) : (
          <ul>
            {teachers.map(teacher => (
              <li key={teacher.id}>
                <span>{teacher.name}</span>
                <span>과목: {teacher.subjects.join(', ')}</span>
                <span>최대 시수: {teacher.maxWeeklyHours}</span>
                {teacher.isPriority && <span className="badge">우선</span>}
                {teacher.isExternal && <span className="badge">외부</span>}
                <button onClick={() => handleDelete(teacher.id)}>삭제</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

