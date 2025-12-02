import React from 'react';
import { TimetableEntry } from '../../types/timetable';
import { Subject } from '../../types/subject';

interface TeacherGridProps {
    teacherId: string;
    teacherName: string;
    entries: TimetableEntry[];
    subjects: Subject[];
    days: string[];
    maxPeriods: number;
}

export const TeacherGrid: React.FC<TeacherGridProps> = ({
    teacherId,
    teacherName,
    entries,
    subjects,
    days,
    maxPeriods
}) => {
    // 해당 교사의 수업만 필터링
    const teacherEntries = entries.filter(
        entry => entry.teacherId === teacherId || entry.teacherIds?.includes(teacherId)
    );

    // 특정 요일, 교시의 수업 찾기
    const getEntry = (day: string, period: number) => {
        return teacherEntries.find(
            entry => entry.day === day && entry.period === period
        );
    };

    return (
        <div className="teacher-timetable-grid mb-8">
            <h3 className="text-xl font-bold mb-4">{teacherName} 교사</h3>
            <div className="overflow-x-auto">
                <table className="timetable-table w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="border border-gray-300 bg-gray-100 dark:bg-gray-800 p-2">교시</th>
                            {days.map(day => (
                                <th key={day} className="border border-gray-300 bg-gray-100 dark:bg-gray-800 p-2 min-w-[120px]">
                                    {day}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: maxPeriods }, (_, i) => i + 1).map(period => (
                            <tr key={period}>
                                <td className="border border-gray-300 bg-gray-50 dark:bg-gray-900 p-2 text-center font-semibold">
                                    {period}
                                </td>
                                {days.map(day => {
                                    const entry = getEntry(day, period);
                                    const subject = entry ? subjects.find(s => s.id === entry.subjectId) : null;

                                    return (
                                        <td
                                            key={`${day}-${period}`}
                                            className={`border border-gray-300 p-2 text-center ${entry ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-800'
                                                }`}
                                        >
                                            {entry && subject && (
                                                <div className="text-sm">
                                                    <div className="font-semibold text-blue-600 dark:text-blue-400">
                                                        {subject.name}
                                                    </div>
                                                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                        {entry.classId}
                                                    </div>
                                                    {entry.roomId && (
                                                        <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                                                            📍 {entry.roomId}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
