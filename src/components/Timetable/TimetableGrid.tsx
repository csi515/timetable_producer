import React from 'react';
import { TimetableEntry } from '../../types/timetable';
import { Subject } from '../../types/subject';
import { Teacher } from '../../types/teacher';

interface TimetableGridProps {
  entries: TimetableEntry[];
  subjects: Subject[];
  teachers: Teacher[];
  classId: string;
  days: string[];
  maxPeriods: number;
}

export const TimetableGrid: React.FC<TimetableGridProps> = ({
  entries,
  subjects,
  teachers,
  classId,
  days,
  maxPeriods
}) => {
  const getEntry = (day: string, period: number): TimetableEntry | undefined => {
    return entries.find(e => e.classId === classId && e.day === day && e.period === period);
  };

  const getSubjectName = (subjectId: string): string => {
    return subjects.find(s => s.id === subjectId)?.name || subjectId;
  };

  const getTeacherName = (teacherId: string): string => {
    return teachers.find(t => t.id === teacherId)?.name || teacherId;
  };

  return (
    <div className="timetable-grid">
      <table>
        <thead>
          <tr>
            <th>교시</th>
            {days.map(day => (
              <th key={day}>{day}요일</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxPeriods }, (_, i) => i + 1).map(period => (
            <tr key={period}>
              <td className="period-number">{period}</td>
              {days.map(day => {
                const entry = getEntry(day, period);
                return (
                  <td key={`${day}-${period}`} className="timetable-cell">
                    {entry ? (
                      <div className="entry-content">
                        <div className="subject-name">{getSubjectName(entry.subjectId)}</div>
                        <div className="teacher-name">
                          {entry.teacherIds
                            ? entry.teacherIds.map(id => getTeacherName(id)).join(', ')
                            : getTeacherName(entry.teacherId)}
                        </div>
                        {entry.isBlockClass && entry.blockStartPeriod === period && (
                          <div className="block-badge">블록</div>
                        )}
                        {entry.roomId && (
                          <div className="room-name">{entry.roomId}</div>
                        )}
                      </div>
                    ) : (
                      <div className="empty-cell">-</div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

