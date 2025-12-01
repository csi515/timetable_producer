import React from 'react';
import { TeacherWorkload, ClassDistribution } from '../../types/validation';

interface StatisticsDisplayProps {
    teacherWorkload: TeacherWorkload[];
    classDistribution: ClassDistribution[];
}

export const StatisticsDisplay: React.FC<StatisticsDisplayProps> = ({
    teacherWorkload,
    classDistribution
}) => {
    return (
        <div className="statistics-display">
            <h3>📊 시간표 통계</h3>

            {/* 교사 업무량 */}
            <div className="statistics-section">
                <h4>교사 업무량</h4>
                <div className="teacher-workload-grid">
                    {teacherWorkload.map(tw => (
                        <div
                            key={tw.teacherId}
                            className={`teacher-card ${tw.isOverloaded ? 'overloaded' : tw.isUnderloaded ? 'underloaded' : ''}`}
                        >
                            <div className="teacher-name">{tw.teacherName}</div>
                            <div className="teacher-stats">
                                <div className="stat">
                                    <span className="label">총 시수:</span>
                                    <span className="value">{tw.totalHours}교시</span>
                                </div>
                                <div className="stat">
                                    <span className="label">활용률:</span>
                                    <span className={`value ${tw.utilizationRate > 100 ? 'over' : ''}`}>
                                        {tw.utilizationRate.toFixed(1)}%
                                    </span>
                                </div>
                                <div className="daily-hours">
                                    {Object.entries(tw.dailyHours).map(([day, hours]) => (
                                        <span key={day} className="day-stat">
                                            {day}: {hours}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            {tw.isOverloaded && <div className="badge over">과부하</div>}
                            {tw.isUnderloaded && <div className="badge under">저활용</div>}
                        </div>
                    ))}
                </div>
            </div>

            {/* 학급 분포 */}
            <div className="statistics-section">
                <h4>학급 분포</h4>
                <div className="class-distribution-grid">
                    {classDistribution.map(cd => (
                        <div key={cd.classId} className="class-card">
                            <div className="class-name">{cd.className}</div>
                            <div className="class-stats">
                                <div className="stat">
                                    <span className="label">총 시수:</span>
                                    <span className="value">{cd.totalHours}교시</span>
                                </div>
                                <div className="stat">
                                    <span className="label">빈 시간:</span>
                                    <span className="value">{cd.emptySlots}</span>
                                </div>
                                <div className="stat">
                                    <span className="label">최대 연속:</span>
                                    <span className={`value ${cd.consecutiveHours > 3 ? 'warning' : ''}`}>
                                        {cd.consecutiveHours}교시
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
