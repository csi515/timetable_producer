"use client";

import { TimetableData, Assignment, Day } from "@/types/timetable";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TimetableGridProps {
  data: TimetableData;
  classId: string;
  assignments: Assignment[];
}

const DAYS: Day[] = ["월", "화", "수", "목", "금"];

// 과목별 색상 매핑
const getSubjectColor = (subjectName: string): string => {
  const colorMap: Record<string, string> = {
    수학: "bg-blue-500",
    국어: "bg-red-500",
    영어: "bg-green-500",
    과학: "bg-purple-500",
    사회: "bg-orange-500",
    체육: "bg-pink-500",
    음악: "bg-teal-500",
    미술: "bg-amber-500",
    컴퓨터: "bg-indigo-500",
  };
  return colorMap[subjectName] || "bg-gray-500";
};

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
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-gray-900">
          {classItem.name} 시간표
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-primary-600 to-primary-700 hover:bg-primary-700">
                <TableHead className="text-white font-semibold text-center w-20">
                  교시
                </TableHead>
                {DAYS.filter((day) =>
                  data.schoolSchedule.days.includes(day)
                ).map((day) => (
                  <TableHead
                    key={day}
                    className="text-white font-semibold text-center border-l border-primary-500 min-w-[150px]"
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
                      const subject = assignment
                        ? data.subjects.find((s) => s.id === assignment.subjectId)
                        : null;
                      const teacher = assignment
                        ? data.teachers.find((t) => t.id === assignment.teacherId)
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
                          {assignment && subject && teacher ? (
                            <div
                              className={`
                                ${getSubjectColor(subject.name)} text-white rounded-lg p-3 shadow-md hover:shadow-lg transition-all
                              `}
                            >
                              <div className="font-semibold text-base mb-1">
                                {subject.name}
                              </div>
                              <div className="text-xs opacity-90">
                                {teacher.name}
                              </div>
                              {subject.requiresConsecutive && (
                                <div className="text-xs mt-1 bg-white bg-opacity-20 rounded px-2 py-0.5 inline-block">
                                  연강
                                </div>
                              )}
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
