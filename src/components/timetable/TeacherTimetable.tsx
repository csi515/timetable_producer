"use client";

import { TimetableData, Assignment, Day } from "@/types/timetable";

interface TeacherTimetableProps {
  data: TimetableData;
  teacherId: string;
  assignments: Assignment[];
}

const DAYS: Day[] = ["월", "화", "수", "목", "금"];

export default function TeacherTimetable({
  data,
  teacherId,
  assignments,
}: TeacherTimetableProps) {
  const teacher = data.teachers.find((t) => t.id === teacherId);
  if (!teacher) return null;

  const teacherAssignments = assignments.filter(
    (a) => a.teacherId === teacherId
  );

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

  teacherAssignments.forEach((assignment) => {
    if (assignment.slot.day in grid) {
      grid[assignment.slot.day][assignment.slot.period] = assignment;
    }
  });

  const maxPeriods = Math.max(
    ...DAYS.map((day) => data.schoolSchedule.periodsPerDay[day])
  );

  return (
    <div className="overflow-x-auto">
      <h3 className="text-2xl font-bold mb-4">
        {teacher.name} 교사 시간표
      </h3>
      <div className="mb-4 text-sm text-gray-600">
        주당 시수: {teacher.weeklyHours}시간 / 배정된 시수:{" "}
        {teacherAssignments.length}시간
      </div>
      <table className="w-full border-collapse bg-white rounded-xl overflow-hidden shadow-lg">
        <thead>
          <tr className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
            <th className="px-6 py-4 text-left font-semibold">교시</th>
            {DAYS.filter((day) =>
              data.schoolSchedule.days.includes(day)
            ).map((day) => (
              <th
                key={day}
                className="px-6 py-4 text-center font-semibold border-l border-purple-500"
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
                  const classItem = assignment
                    ? data.classes.find((c) => c.id === assignment.classId)
                    : null;
                  const subject = assignment
                    ? data.subjects.find((s) => s.id === assignment.subjectId)
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
                      {assignment && classItem && subject ? (
                        <div className="space-y-1">
                          <div className="font-semibold text-gray-800">
                            {classItem.name}
                          </div>
                          <div className="text-sm text-gray-600">
                            {subject.name}
                          </div>
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
