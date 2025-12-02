import React from 'react';
import { ScheduleResult } from '../../types/timetable';
import { TimetableGrid } from './TimetableGrid';
import { TeacherGrid } from './TeacherGrid';
import { RoomGrid } from './RoomGrid';

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

  if (viewMode === 'teacher') {
    return (
      <div className="timetable-view">
        <h2>교사별 시간표</h2>
        {teachers.map(teacher => (
          <TeacherGrid
            key={teacher.id}
            teacherId={teacher.id}
            teacherName={teacher.name}
            entries={entries}
            subjects={subjects}
            days={days}
            maxPeriods={maxPeriods}
          />
        ))}
      </div>
    );
  }

  if (viewMode === 'room') {
    // 특별실 사용하는 과목들 수집
    const specialRooms = new Map<string, string>();

    entries.forEach(entry => {
      if (entry.roomId) {
        const subject = subjects.find(s => s.id === entry.subjectId);
        if (subject && subject.requiresSpecialRoom) {
          specialRooms.set(entry.roomId, entry.roomId);
        }
      }
    });

    if (specialRooms.size === 0) {
      return (
        <div className="timetable-view">
          <h2>특별실 시간표</h2>
          <p className="text-gray-600 dark:text-gray-400 p-4">
            특별실을 사용하는 수업이 없습니다.
          </p>
        </div>
      );
    }

    return (
      <div className="timetable-view">
        <h2>특별실 시간표</h2>
        {Array.from(specialRooms.entries()).map(([roomId, roomName]) => (
          <RoomGrid
            key={roomId}
            roomId={roomId}
            roomName={roomName}
            entries={entries}
            subjects={subjects}
            teachers={teachers}
            days={days}
            maxPeriods={maxPeriods}
          />
        ))}
      </div>
    );
  }

  return <div>알 수 없는 뷰 모드입니다.</div>;
};

