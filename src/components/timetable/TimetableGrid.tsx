"use client";

import { TimetableData, Assignment, Day } from "@/types/timetable";

interface TimetableGridProps {
  data: TimetableData;
  classId: string;
  assignments: Assignment[];
}

const DAYS: Day[] = ["월", "화", "수", "목", "금"];

export default function TimetableGrid({
  data,
  classId,
  assignments,
}: TimetableGridProps) {
  const classItem = data.classes.find((c) => c.id === classId);
  if (!classItem) return null;

  const classAssignments = assignments.filter((a) => a.classId === classId);

  // 시간표 그리드 생성
  const grid: {
    [day in Day]: { [period: number]: Assignment | null };
  } = {
    월: {},
    화: {},
    수: {},
    목: {},
    금: {},
  };

  classAssignments.forEach((assignment) => {
    if (assignment.slot.day in grid) {
      grid[assignment.slot.day][assignment.slot.period] = assignment;
    }
  });

  const maxPeriods = Math.max(
    ...DAYS.map((day) => data.schoolSchedule.periodsPerDay[day])
  );

  return (
    <div className="overflow-x-auto" data-class-id={classId}>
      <h3 className="text-2xl font-bold mb-4">{classItem.name} 시간표</h3>
      <table className="w-full border-collapse bg-white rounded-xl overflow-hidden shadow-lg">
        <thead>
          <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <th className="px-6 py-4 text-left font-semibold">교시</th>
            {DAYS.filter((day) =>
              data.schoolSchedule.days.includes(day)
            ).map((day) => (
              <th
                key={day}
                className="px-6 py-4 text-center font-semibold border-l border-blue-500"
              >
                {day}요일
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxPeriods }, (_, i) => i + 1).map(
            (period) => (
              <tr
                key={period}
                className="border-b border-gray-200 hover:bg-gray-50"
              >
                <td className="px-6 py-4 text-center font-semibold bg-gray-50">
                  {period}
                </td>
                {DAYS.filter((day) =>
                  data.schoolSchedule.days.includes(day)
                ).map((day) => {
                  const assignment = grid[day][period];
                  const subject = assignment
                    ? data.subjects.find((s) => s.id === assignment.subjectId)
                    : null;
                  const teacher = assignment
                    ? data.teachers.find((t) => t.id === assignment.teacherId)
                    : null;

                  // 교시 수 확인
                  const maxPeriodForDay =
                    data.schoolSchedule.periodsPerDay[day];
                  const isEmpty = period > maxPeriodForDay;

                  return (
                    <td
                      key={day}
                      className={`px-4 py-4 text-center border-l border-gray-200 ${
                        isEmpty ? "bg-gray-100" : ""
                      }`}
                    >
                      {assignment && subject && teacher ? (
                        <div className="space-y-1">
                          <div className="font-semibold text-gray-800">
                            {subject.name}
                          </div>
                          <div className="text-sm text-gray-600">
                            {teacher.name}
                          </div>
                          {subject.requiresConsecutive && (
                            <div className="text-xs text-blue-600">
                              연강
                            </div>
                          )}
                        </div>
                      ) : isEmpty ? (
                        <span className="text-gray-400">-</span>
                      ) : (
                        <span className="text-gray-300">빈 시간</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
