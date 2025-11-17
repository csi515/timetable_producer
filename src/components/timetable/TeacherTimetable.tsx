"use client";

import { TimetableData, Assignment, Day } from "@/types/timetable";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <Card>
      <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-t-xl">
        <CardTitle className="text-2xl">
          {teacher.name} 교사 시간표
        </CardTitle>
        <div className="text-purple-100 mt-2 text-sm">
          주당 시수: <span className="font-semibold">{teacher.weeklyHours}시간</span> / 배정된 시수:{" "}
          <span className="font-semibold">{teacherAssignments.length}시간</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-purple-600 to-purple-700 hover:bg-purple-700">
                <TableHead className="text-white font-semibold text-center w-20">
                  교시
                </TableHead>
                {DAYS.filter((day) =>
                  data.schoolSchedule.days.includes(day)
                ).map((day) => (
                  <TableHead
                    key={day}
                    className="text-white font-semibold text-center border-l border-purple-500 min-w-[150px]"
                  >
                    {day}요일
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: maxPeriods }, (_, i) => i + 1).map(
                (period) => (
                  <TableRow
                    key={period}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <TableCell className="text-center font-semibold bg-gray-50 text-gray-700 border-r">
                      {period}
                    </TableCell>
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

                      const maxPeriodForDay =
                        data.schoolSchedule.periodsPerDay[day];
                      const isEmpty = period > maxPeriodForDay;

                      return (
                        <TableCell
                          key={day}
                          className={`text-center border-l ${
                            isEmpty ? "bg-gray-100" : ""
                          }`}
                        >
                          {assignment && classItem && subject ? (
                            <div className="bg-purple-100 text-purple-900 rounded-lg p-3 shadow-sm">
                              <div className="font-semibold text-base mb-1">
                                {classItem.name}
                              </div>
                              <div className="text-sm text-purple-700">
                                {subject.name}
                              </div>
                            </div>
                          ) : isEmpty ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <span className="text-gray-300">빈 시간</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
