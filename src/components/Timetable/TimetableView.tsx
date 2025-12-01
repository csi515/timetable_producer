import React from 'react';
import { ScheduleResult } from '../../types/timetable';
import { TimetableGrid } from './TimetableGrid';

interface TimetableViewProps {
  result: ScheduleResult;
  viewMode: 'class' | 'teacher' | 'room';
}

export const TimetableView: React.FC<TimetableViewProps> = ({ result, viewMode }) => {
  if (!result || result.entries.length === 0) {
    return <div className="no-timetable">시간표가 생성되지 않았습니다.</div>;
  }

  const { entries, classes, subjects, teachers } = result;
  const days = result.days || (result.classes.length > 0 ? ['월', '화', '수', '목', '금'] : []);
  const maxPeriods = 7;

  if (viewMode === 'class') {
    return (
      <div className="timetable-view">
        <h2>학급별 시간표</h2>
        {classes.map(classInfo => (
          <div key={classInfo.id} className="class-timetable">
            <h3>{classInfo.name}</h3>
            <TimetableGrid
              entries={entries}
              subjects={subjects}
              teachers={teachers}
              classId={classInfo.id}
              days={days}
              maxPeriods={maxPeriods}
            />
          </div>
        ))}
      </div>
    );
  }

  // Teacher view와 Room view는 나중에 구현
  return <div>다른 뷰 모드는 구현 중입니다.</div>;
};

