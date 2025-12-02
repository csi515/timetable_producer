import React from 'react';
import { TimetableEntry } from '../../types/timetable';
import { Subject } from '../../types/subject';
import { Teacher } from '../../types/teacher';

interface RoomGridProps {
    roomId: string;
    roomName: string;
    entries: TimetableEntry[];
    subjects: Subject[];
    teachers: Teacher[];
    days: string[];
    maxPeriods: number;
}

export const RoomGrid: React.FC<RoomGridProps> = ({
    roomId,
    roomName,
    entries,
    subjects,
    teachers,
    days,
    maxPeriods
}) => {
    // 해당 특별실을 사용하는 수업만 필터링
    const roomEntries = entries.filter(entry => entry.roomId === roomId);

    // 특정 요일, 교시의 수업 찾기
    const getEntry = (day: string, period: number) => {
        return roomEntries.find(
            entry => entry.day === day && entry.period === period
        );
    };

    if (roomEntries.length === 0) {
        return null; // 사용하는 수업이 없으면 표시하지 않음
    }

    return (
        <div className="room-timetable-grid mb-8">
            <h3 className="text-xl font-bold mb-4">📍 {roomName}</h3>
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
                                    const teacher = entry ? teachers.find(t => t.id === entry.teacherId) : null;

                                    return (
                                        <td
                                            key={`${day}-${period}`}
                                            className={`border border-gray-300 p-2 text-center ${entry ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-white dark:bg-gray-800'
                                                }`}
                                        >
                                            {entry && subject && teacher && (
                                                <div className="text-sm">
                                                    <div className="font-semibold text-purple-600 dark:text-purple-400">
                                                        {subject.name}
                                                    </div>
                                                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                        {entry.classId}
                                                    </div>
                                                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                                        👤 {teacher.name}
                                                    </div>
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
