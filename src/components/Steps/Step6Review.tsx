import React, { useEffect, useMemo } from 'react';
import { useTimetableStore } from '../../store/timetableStore';
import { analyzeInputData } from '../../utils/statistics';
import { AdPlaceholder } from '../Ads/AdPlaceholder';

export const Step6Review: React.FC = () => {
  const config = useTimetableStore((state) => state.config);
  const classes = useTimetableStore((state) => state.classes);
  const subjects = useTimetableStore((state) => state.subjects);
  const teachers = useTimetableStore((state) => state.teachers);
  const setStepValidation = useTimetableStore((state) => state.setStepValidation);

  useEffect(() => {
    setStepValidation(6, true);
  }, [setStepValidation]);

  // 입력 데이터 분석
  const analysis = useMemo(() => {
    if (!config) return null;
    return analyzeInputData(teachers, subjects, classes, config);
  }, [teachers, subjects, classes, config]);

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
    <div className="step-content modern-step-container">
      <div className="step-header">
        <div className="flex justify-between items-center">
          <div>
            <h2>최종 확인</h2>
            <p className="step-description">입력하신 정보를 확인하세요. 문제가 없으면 다음 단계로 진행하세요.</p>
          </div>
          <button
            className="modern-button secondary"
            onClick={() => {
              const data = {
                config,
                classes,
                subjects,
                teachers
              };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `timetable-config-${new Date().toISOString().slice(0, 10)}.json`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
          >
            💾 설정 저장하기
          </button>
        </div>
      </div>

      {/* 분석 결과 표시 */}
      {analysis && (
        <div className="analysis-summary">
          <h3>📊 입력 데이터 분석</h3>

          <div className="analysis-grid">
            {/* 교사 부하량 분석 */}
            <div className="analysis-card">
              <h4>교사 업무 부하</h4>
              <div className="stat-row">
                <span>전체 균형:</span>
                <span className={`modern-badge ${analysis.totalStats.balanceRate > 100 ? 'warning' : 'success'}`}>
                  {analysis.totalStats.balanceRate.toFixed(1)}%
                </span>
              </div>
              <p className="hint-text" style={{ fontSize: '0.9em', color: '#6b7280', marginTop: '5px' }}>
                (필요 시수 / 교사 총 가용 시수)
              </p>

              <div className="problem-list" style={{ marginTop: '10px' }}>
                {analysis.teacherLoad.filter(t => t.status === 'overloaded').length > 0 ? (
                  <div className="warning-box" style={{ color: '#ef4444', fontSize: '0.9em' }}>
                    ⚠️ 과부하 교사: {analysis.teacherLoad.filter(t => t.status === 'overloaded').map(t => t.teacherName).join(', ')}
                  </div>
                ) : (
                  <div className="success-box" style={{ color: '#10b981', fontSize: '0.9em' }}>
                    ✅ 모든 교사의 업무량이 적절합니다.
                  </div>
                )}
              </div>
            </div>

            {/* 학급 시수 분석 */}
            <div className="analysis-card">
              <h4>학급 시수 충족</h4>
              <div className="stat-row">
                <span>시수 부족 학급:</span>
                <span className="value">
                  {analysis.classHours.filter(c => c.status === 'lacking').length}개
                </span>
              </div>
              <div className="stat-row">
                <span>시수 초과 학급:</span>
                <span className="value">
                  {analysis.classHours.filter(c => c.status === 'excess').length}개
                </span>
              </div>

              <div className="problem-list" style={{ marginTop: '10px' }}>
                {analysis.classHours.some(c => c.status !== 'balanced') ? (
                  <div className="warning-box" style={{ color: '#f59e0b', fontSize: '0.9em' }}>
                    ⚠️ 일부 학급의 시수 조정이 필요할 수 있습니다.
                  </div>
                ) : (
                  <div className="success-box" style={{ color: '#10b981', fontSize: '0.9em' }}>
                    ✅ 모든 학급의 시수가 적절합니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
            <span className="review-value">
              {config.dailyMaxPeriods
                ? '요일별 설정됨'
                : `${config.maxPeriodsPerDay}교시`}
            </span>
          </div>
          {config.dailyMaxPeriods && (
            <div className="review-item" style={{ marginTop: '5px' }}>
              <span className="review-label">요일별:</span>
              <span className="review-value" style={{ fontSize: '0.9em' }}>
                {Object.entries(config.dailyMaxPeriods).map(([day, max]) => `${day}(${max})`).join(', ')}
              </span>
            </div>
          )}
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
              <span key={classInfo.id} className="modern-badge">{classInfo.name}</span>
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
                {subject.isCoTeaching && (
                  <span className="badge-small">
                    공동: {subject.coTeachingTeachers?.length || 0}명
                  </span>
                )}
                {subject.fixedTimes && subject.fixedTimes.length > 0 && (
                  <span className="badge-small">고정: {subject.fixedTimes.length}시간</span>
                )}
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


      <div className="mt-8 flex justify-center">
        <AdPlaceholder type="banner" />
      </div>
    </div >
  );
};

