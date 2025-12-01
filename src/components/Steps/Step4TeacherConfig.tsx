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

  const handleUnavailableTimesChange = (times: { day: string; period: number }[]) => {
    setUnavailableTimes(times);
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

    const newTeacher: Teacher = {
      id: `teacher-${Date.now()}`,
      name: name.trim(),
      subjects: selectedSubjects,
      maxWeeklyHours,
      unavailableTimes: unavailableTimes,
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
    if (confirm('이 교사를 삭제하시겠습니까?')) {
      setTeachers(teachers.filter(t => t.id !== id));
    }
  };

  if (!config) {
    return (
      <div className="step-content modern-step-container">
        <div className="generation-error">
          <p>먼저 1단계에서 기본 설정을 완료해주세요.</p>
        </div>
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="step-content modern-step-container">
        <div className="generation-error">
          <p>먼저 3단계에서 과목을 추가해주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="step-content modern-step-container">
      <div className="step-header">
        <h2>교사 설정</h2>
        <p className="step-description">교사 정보와 가능한 시간을 설정해주세요.</p>
      </div>

      <div className="modern-config-card">
        <div className="config-section">
          <h3 className="section-title">교사 추가</h3>

          <div className="modern-form">
            <div className="modern-input-group">
              <label className="modern-label">교사명 <span className="required">*</span></label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="교사 이름"
                onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
                className="modern-input"
              />
            </div>

            <div className="modern-input-group">
              <label className="modern-label">담당 과목 <span className="required">*</span></label>
              <div className="subject-selector-modern">
                {subjects.length === 0 ? (
                  <div className="empty-state">
                    <p>과목이 없습니다. 3단계에서 과목을 추가해주세요.</p>
                  </div>
                ) : (
                  subjects.map(subject => (
                    <label key={subject.id} className={`day-toggle ${selectedSubjects.includes(subject.id) ? 'active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selectedSubjects.includes(subject.id)}
                        onChange={() => handleSubjectToggle(subject.id)}
                        hidden
                      />
                      <span className="toggle-label">{subject.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="modern-input-group">
              <label className="modern-label">주간 최대 시수</label>
              <input
                type="number"
                min="1"
                max="30"
                value={maxWeeklyHours}
                onChange={(e) => setMaxWeeklyHours(parseInt(e.target.value) || 20)}
                className="modern-input"
              />
              <span className="input-hint-modern">주당 최대 수업 시수 제한</span>
            </div>

            <div className="modern-checkbox-group">
              <label className="modern-checkbox">
                <input
                  type="checkbox"
                  checked={isPriority}
                  onChange={(e) => setIsPriority(e.target.checked)}
                />
                <span>우선 배치 (일정 우선 확정)</span>
              </label>
            </div>

            <div className="modern-checkbox-group">
              <label className="modern-checkbox">
                <input
                  type="checkbox"
                  checked={isExternal}
                  onChange={(e) => setIsExternal(e.target.checked)}
                />
                <span>외부 강사</span>
              </label>
            </div>

            <div className="modern-input-group">
              <label className="modern-label">수업 불가능한 시간</label>
              <p className="input-hint-modern">기본적으로 모든 시간이 수업 가능합니다. 불가능한 시간을 클릭하여 표시하세요.</p>
              <TimeGridSelector
                days={days}
                maxPeriods={maxPeriods}
                selectedTimes={unavailableTimes}
                onSelectedChange={handleUnavailableTimesChange}
                type="unavailable"
                labels={{
                  selected: '수업 불가능',
                  unselected: '수업 가능',
                  clearAll: '전체 가능',
                  selectAll: '전체 불가능'
                }}
              />
            </div>

            <button onClick={handleAdd} className="modern-button primary">
              교사 추가
            </button>
          </div>
        </div>

        <div className="config-section">
          <h3 className="section-title">등록된 교사 ({teachers.length}명)</h3>
          {teachers.length === 0 ? (
            <div className="empty-state">
              <p>등록된 교사가 없습니다. 교사를 추가해주세요.</p>
            </div>
          ) : (
            <div className="modern-list-grid">
              {teachers.map(teacher => {
                const teacherSubjects = subjects.filter(s => teacher.subjects.includes(s.id));
                return (
                  <div key={teacher.id} className="modern-list-item">
                    <div className="item-header">
                      <strong>{teacher.name}</strong>
                      <button onClick={() => handleDelete(teacher.id)} className="modern-button-small delete">
                        삭제
                      </button>
                    </div>
                    <div className="item-details">
                      <span className="detail-text">담당 과목: {teacherSubjects.map(s => s.name).join(', ')}</span>
                      <span className="detail-text">최대 시수: {teacher.maxWeeklyHours}시간</span>
                      {teacher.isPriority && <span className="modern-badge">우선 배치</span>}
                      {teacher.isExternal && <span className="modern-badge">외부 강사</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {subjects.some(s => s.isCoTeaching) && (
        <div className="modern-config-card" style={{ marginTop: '1.5rem' }}>
          <div className="config-section">
            <h3 className="section-title">공동수업 교사 구성</h3>
            <p className="section-description mb-4">
              공동수업으로 설정된 과목을 담당할 교사들을 선택해주세요. (해당 과목을 담당하는 교사들 중에서 선택)
            </p>

            <div className="modern-list-grid">
              {subjects.filter(s => s.isCoTeaching).map(subject => {
                const availableTeachers = teachers.filter(t => t.subjects.includes(subject.id));
                const assignedTeacherIds = subject.coTeachingTeachers || [];

                return (
                  <div key={subject.id} className="modern-list-item">
                    <div className="item-header">
                      <strong>{subject.name}</strong>
                      <span className="modern-badge">공동수업</span>
                    </div>
                    <div className="item-content mt-2">
                      {availableTeachers.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          이 과목을 담당하는 교사가 없습니다. 위에서 교사를 추가하고 담당 과목으로 선택해주세요.
                        </p>
                      ) : (
                        <div className="teacher-selector flex flex-wrap gap-2">
                          {availableTeachers.map(teacher => (
                            <label key={teacher.id} className={`day-toggle ${assignedTeacherIds.includes(teacher.id) ? 'active' : ''}`}>
                              <input
                                type="checkbox"
                                checked={assignedTeacherIds.includes(teacher.id)}
                                onChange={() => {
                                  const newIds = assignedTeacherIds.includes(teacher.id)
                                    ? assignedTeacherIds.filter(id => id !== teacher.id)
                                    : [...assignedTeacherIds, teacher.id];

                                  const updatedSubjects = subjects.map(s =>
                                    s.id === subject.id
                                      ? { ...s, coTeachingTeachers: newIds }
                                      : s
                                  );
                                  // setSubjects는 store에서 가져와야 함
                                  useTimetableStore.getState().setSubjects(updatedSubjects);
                                }}
                                hidden
                              />
                              <span className="toggle-label">{teacher.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        선택된 교사: {assignedTeacherIds.length}명
                        {assignedTeacherIds.length < 2 && <span className="text-red-500 ml-1">(최소 2명 필요)</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

