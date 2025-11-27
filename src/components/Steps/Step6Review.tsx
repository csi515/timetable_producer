import React, { useEffect } from 'react';
import { useTimetableStore } from '../../store/timetableStore';

export const Step6Review: React.FC = () => {
  const config = useTimetableStore((state) => state.config);
  const classes = useTimetableStore((state) => state.classes);
  const subjects = useTimetableStore((state) => state.subjects);
  const teachers = useTimetableStore((state) => state.teachers);
  const setStepValidation = useTimetableStore((state) => state.setStepValidation);

  useEffect(() => {
    setStepValidation(6, true);
  }, [setStepValidation]);

  if (!config) {
    return (
      <div className="step-content">
        <p className="error-message">기본 설정이 완료되지 않았습니다.</p>
      </div>
    );
  }

  const totalWeeklyHours = subjects.reduce((sum, s) => sum + s.weeklyHours, 0);
  const totalTeacherHours = teachers.reduce((sum, t) => sum + t.maxWeeklyHours, 0);

  return (
    <div className="step-content">
      <h2>6단계: 최종 확인</h2>
      <p className="step-description">입력하신 정보를 확인하세요. 문제가 없으면 다음 단계로 진행하세요.</p>

      <div className="review-sections">
        <div className="review-section">
          <h3>기본 설정</h3>
          <div className="review-item">
            <span className="review-label">학년:</span>
            <span className="review-value">3학년 (고정)</span>
          </div>
          <div className="review-item">
            <span className="review-label">학급 수:</span>
            <span className="review-value">{classes.length}개</span>
          </div>
          <div className="review-item">
            <span className="review-label">요일:</span>
            <span className="review-value">{config.days.join(', ')}</span>
          </div>
          <div className="review-item">
            <span className="review-label">1일 최대 교시:</span>
            <span className="review-value">{config.maxPeriodsPerDay}교시</span>
          </div>
          <div className="review-item">
            <span className="review-label">점심 시간:</span>
            <span className="review-value">4교시와 5교시 사이 (고정)</span>
          </div>
        </div>

        <div className="review-section">
          <h3>학급 정보</h3>
          <div className="review-item">
            <span className="review-label">총 학급 수:</span>
            <span className="review-value">{classes.length}개</span>
          </div>
          <div className="class-list-preview">
            {classes.slice(0, 10).map(classInfo => (
              <span key={classInfo.id} className="class-tag">{classInfo.name}</span>
            ))}
            {classes.length > 10 && <span className="more-indicator">+{classes.length - 10}개 더</span>}
          </div>
        </div>

        <div className="review-section">
          <h3>과목 정보</h3>
          <div className="review-item">
            <span className="review-label">과목 수:</span>
            <span className="review-value">{subjects.length}개</span>
          </div>
          <div className="review-item">
            <span className="review-label">총 주간 시수:</span>
            <span className="review-value">{totalWeeklyHours}시간</span>
          </div>
          <div className="subject-list-preview">
            {subjects.map(subject => (
              <div key={subject.id} className="subject-tag">
                {subject.name} ({subject.weeklyHours}시간)
                {subject.requiresSpecialRoom && <span className="badge-small">특별실</span>}
                {subject.isBlockClass && <span className="badge-small">블록</span>}
                {subject.isCoTeaching && <span className="badge-small">공동</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="review-section">
          <h3>교사 정보</h3>
          <div className="review-item">
            <span className="review-label">교사 수:</span>
            <span className="review-value">{teachers.length}명</span>
          </div>
          <div className="review-item">
            <span className="review-label">총 최대 시수:</span>
            <span className="review-value">{totalTeacherHours}시간</span>
          </div>
          <div className="teacher-list-preview">
            {teachers.map(teacher => (
              <div key={teacher.id} className="teacher-tag">
                {teacher.name}
                {teacher.isPriority && <span className="badge-small">우선</span>}
                {teacher.isExternal && <span className="badge-small">외부</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="validation-summary">
          <h3>검증 결과</h3>
          {subjects.length === 0 && (
            <div className="validation-error">⚠️ 과목이 설정되지 않았습니다.</div>
          )}
          {teachers.length === 0 && (
            <div className="validation-error">⚠️ 교사가 설정되지 않았습니다.</div>
          )}
          {classes.length === 0 && (
            <div className="validation-error">⚠️ 학급이 설정되지 않았습니다.</div>
          )}
          {subjects.length > 0 && teachers.length > 0 && classes.length > 0 && (
            <div className="validation-success">✅ 모든 필수 정보가 입력되었습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
};

