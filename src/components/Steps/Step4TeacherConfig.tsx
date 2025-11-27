import React, { useState, useEffect } from 'react';
import { Teacher, UnavailableTime } from '../../types/teacher';
import { useTimetableStore } from '../../store/timetableStore';
import { TimeGridSelector } from '../Common/TimeGridSelector';

export const Step4TeacherConfig: React.FC = () => {
  const teachers = useTimetableStore((state) => state.teachers);
  const subjects = useTimetableStore((state) => state.subjects);
  const config = useTimetableStore((state) => state.config);
  const setTeachers = useTimetableStore((state) => state.setTeachers);
  const setStepValidation = useTimetableStore((state) => state.setStepValidation);

  const [name, setName] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [maxWeeklyHours, setMaxWeeklyHours] = useState(20);
  const [isPriority, setIsPriority] = useState(false);
  const [isExternal, setIsExternal] = useState(false);
  const [availableTimes, setAvailableTimes] = useState<{ day: string; period: number }[]>([]);
  const [unavailableTimes, setUnavailableTimes] = useState<UnavailableTime[]>([]);

  const days = config?.days || ['월', '화', '수', '목', '금'];
  const maxPeriods = config?.maxPeriodsPerDay || 7;

  useEffect(() => {
    setStepValidation(4, teachers.length > 0);
  }, [teachers, setStepValidation]);

  const handleSubjectToggle = (subjectId: string) => {
    if (selectedSubjects.includes(subjectId)) {
      setSelectedSubjects(selectedSubjects.filter(id => id !== subjectId));
    } else {
      setSelectedSubjects([...selectedSubjects, subjectId]);
    }
  };

  const handleAvailableTimesChange = (selected: { day: string; period: number }[]) => {
    setAvailableTimes(selected);
  };

  const handleAddUnavailable = (day: string, period: number) => {
    const newTime: UnavailableTime = { day, period };
    if (!unavailableTimes.some(t => t.day === day && t.period === period)) {
      setUnavailableTimes([...unavailableTimes, newTime]);
    }
  };

  const handleRemoveUnavailable = (index: number) => {
    setUnavailableTimes(unavailableTimes.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    if (!name.trim()) {
      alert('교사명을 입력해주세요.');
      return;
    }
    if (selectedSubjects.length === 0) {
      alert('담당 과목을 최소 1개 이상 선택해주세요.');
      return;
    }
    if (teachers.some(t => t.name === name.trim())) {
      alert('이미 등록된 교사입니다.');
      return;
    }

    // availableTimes가 비어있으면 모든 시간이 가능한 것으로 간주
    // availableTimes가 있으면, 전체 시간에서 가능한 시간을 제외하여 unavailableTimes 생성
    let finalUnavailableTimes: UnavailableTime[] = [];
    
    if (availableTimes.length > 0) {
      const allTimes: { day: string; period: number }[] = [];
      days.forEach(day => {
        for (let period = 1; period <= maxPeriods; period++) {
          allTimes.push({ day, period });
        }
      });

      finalUnavailableTimes = allTimes
        .filter(time => !availableTimes.some(at => at.day === time.day && at.period === time.period))
        .map(time => ({ day: time.day, period: time.period }));
    }
    
    // 추가 불가능한 시간도 포함
    finalUnavailableTimes = [...finalUnavailableTimes, ...unavailableTimes];

    const newTeacher: Teacher = {
      id: `teacher-${Date.now()}`,
      name: name.trim(),
      subjects: selectedSubjects,
      maxWeeklyHours,
      unavailableTimes: finalUnavailableTimes,
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
    setAvailableTimes([]);
    setUnavailableTimes([]);
  };

  const handleDelete = (id: string) => {
    if (confirm('이 교사를 삭제하시겠습니까?')) {
      setTeachers(teachers.filter(t => t.id !== id));
    }
  };

  if (!config) {
    return (
      <div className="step-content">
        <p className="error-message">먼저 1단계에서 기본 설정을 완료해주세요.</p>
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="step-content">
        <p className="error-message">먼저 3단계에서 과목을 추가해주세요.</p>
      </div>
    );
  }

  return (
    <div className="step-content">
      <h2>4단계: 교사 설정</h2>
      <p className="step-description">교사 정보와 가능한 시간을 설정해주세요.</p>

      <div className="input-form">
        <div className="input-group">
          <label>교사명: <span className="required">*</span></label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="교사 이름"
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
        </div>

        <div className="input-group">
          <label>담당 과목: <span className="required">*</span></label>
          <div className="subject-selector">
            {subjects.length === 0 ? (
              <p className="empty-message">과목이 없습니다. 3단계에서 과목을 추가해주세요.</p>
            ) : (
              subjects.map(subject => (
                <label key={subject.id} className="subject-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedSubjects.includes(subject.id)}
                    onChange={() => handleSubjectToggle(subject.id)}
                  />
                  {subject.name}
                </label>
              ))
            )}
          </div>
        </div>

        <div className="input-group">
          <label>주간 최대 시수:</label>
          <input
            type="number"
            min="1"
            max="30"
            value={maxWeeklyHours}
            onChange={(e) => setMaxWeeklyHours(parseInt(e.target.value) || 20)}
          />
          <span className="input-hint">주당 최대 수업 시수 제한</span>
        </div>

        <div className="input-group">
          <label>
            <input
              type="checkbox"
              checked={isPriority}
              onChange={(e) => setIsPriority(e.target.checked)}
            />
            우선 배치 (일정 우선 확정)
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
          <label>가능한 시간 선택:</label>
          <p className="input-hint">클릭하여 가능한 시간을 선택하세요. 선택하지 않은 시간은 불가능한 시간으로 처리됩니다.</p>
          <TimeGridSelector
            days={days}
            maxPeriods={maxPeriods}
            selectedTimes={availableTimes}
            onSelectionChange={handleAvailableTimesChange}
            mode="available"
          />
        </div>

        <div className="input-group">
          <label>추가 불가능한 시간 (선택사항):</label>
          <p className="input-hint">가능한 시간 중에서도 특정 시간을 제외하고 싶은 경우 추가하세요.</p>
          <div className="unavailable-time-input">
            {unavailableTimes.map((time, index) => (
              <div key={index} className="unavailable-time-item">
                {time.day}요일 {time.period}교시
                <button onClick={() => handleRemoveUnavailable(index)}>삭제</button>
              </div>
            ))}
          </div>
        </div>

        <button onClick={handleAdd} className="add-button">교사 추가</button>
      </div>

      <div className="teacher-list">
        <h3>등록된 교사 ({teachers.length}개)</h3>
        {teachers.length === 0 ? (
          <p className="empty-message">등록된 교사가 없습니다. 교사를 추가해주세요.</p>
        ) : (
          <div className="list-grid">
            {teachers.map(teacher => {
              const teacherSubjects = subjects.filter(s => teacher.subjects.includes(s.id));
              return (
                <div key={teacher.id} className="list-item">
                  <div className="item-header">
                    <strong>{teacher.name}</strong>
                    <button onClick={() => handleDelete(teacher.id)} className="delete-button">삭제</button>
                  </div>
                  <div className="item-details">
                    <div>담당 과목: {teacherSubjects.map(s => s.name).join(', ')}</div>
                    <div>최대 시수: {teacher.maxWeeklyHours}시간</div>
                    <div className="badges">
                      {teacher.isPriority && <span className="badge">우선 배치</span>}
                      {teacher.isExternal && <span className="badge">외부 강사</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

