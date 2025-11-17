"use client";

import { useState } from "react";
import { TimetableData, Assignment, Day } from "@/types/timetable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import TimetableGrid from "@/components/timetable/TimetableGrid";
import TeacherTimetable from "@/components/timetable/TeacherTimetable";
import { Download, FileSpreadsheet, Image as ImageIcon, AlertCircle } from "lucide-react";
import { exportToExcel, exportToImage } from "@/utils/export";

interface Step6ReviewProps {
  data: TimetableData;
  updateData: (updates: Partial<TimetableData>) => void;
  prevStep: () => void;
}

const DAYS: Day[] = ["월", "화", "수", "목", "금"];

export default function Step6Review({
  data,
  updateData,
  prevStep,
}: Step6ReviewProps) {
  const [selectedView, setSelectedView] = useState<"class" | "teacher">("class");
  const [selectedClass, setSelectedClass] = useState<string | null>(
    data.classes[0]?.id || null
  );
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(
    data.teachers[0]?.id || null
  );

  const handleExportExcel = () => {
    exportToExcel(data);
  };

  const handleExportImage = () => {
    exportToImage(selectedClass || data.classes[0]?.id || "");
  };

  if (data.assignments.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="border-2 border-warning-200">
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-warning-500" />
            <CardTitle className="text-2xl font-bold text-gray-800 mb-4">
              생성된 시간표가 없습니다
            </CardTitle>
            <CardDescription className="text-lg mb-8">
              이전 단계로 돌아가 시간표를 생성해주세요.
            </CardDescription>
            <Button onClick={prevStep} size="lg">
              시간표 생성으로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* 헤더 및 내보내기 */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-primary-600 to-purple-600 text-white rounded-t-xl">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl text-white">시간표 검토 및 다운로드</CardTitle>
              <CardDescription className="text-primary-100 mt-1">
                생성된 시간표를 확인하고 다운로드하세요.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleExportExcel}
                variant="secondary"
                className="gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel 다운로드
              </Button>
              <Button
                onClick={handleExportImage}
                variant="secondary"
                className="gap-2"
              >
                <ImageIcon className="w-4 h-4" />
                이미지 다운로드
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 뷰 선택 */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4 mb-6">
            <Button
              onClick={() => setSelectedView("class")}
              variant={selectedView === "class" ? "default" : "outline"}
              className="gap-2"
            >
              학급별 시간표
            </Button>
            <Button
              onClick={() => setSelectedView("teacher")}
              variant={selectedView === "teacher" ? "default" : "outline"}
              className="gap-2"
            >
              교사별 시간표
            </Button>
          </div>

          {/* 학급 선택 */}
          {selectedView === "class" && (
            <div className="mb-6">
              <Label className="text-sm font-semibold text-gray-700 mb-3 block">
                학급 선택
              </Label>
              <div className="flex flex-wrap gap-2">
                {data.classes.map((classItem) => (
                  <Button
                    key={classItem.id}
                    onClick={() => setSelectedClass(classItem.id)}
                    variant={selectedClass === classItem.id ? "default" : "outline"}
                    size="sm"
                  >
                    {classItem.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* 교사 선택 */}
          {selectedView === "teacher" && (
            <div className="mb-6">
              <Label className="text-sm font-semibold text-gray-700 mb-3 block">
                교사 선택
              </Label>
              <div className="flex flex-wrap gap-2">
                {data.teachers.map((teacher) => (
                  <Button
                    key={teacher.id}
                    onClick={() => setSelectedTeacher(teacher.id)}
                    variant={selectedTeacher === teacher.id ? "default" : "outline"}
                    size="sm"
                  >
                    {teacher.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 시간표 표시 */}
      <Card>
        <CardContent className="p-6">
          {selectedView === "class" && selectedClass && (
            <TimetableGrid
              data={data}
              classId={selectedClass}
              assignments={data.assignments}
            />
          )}
          {selectedView === "teacher" && selectedTeacher && (
            <TeacherTimetable
              data={data}
              teacherId={selectedTeacher}
              assignments={data.assignments}
            />
          )}
        </CardContent>
      </Card>

      {/* 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200">
          <CardContent className="p-6 text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">
              {data.assignments.length}
            </div>
            <div className="text-gray-700 font-semibold">배정된 수업</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200">
          <CardContent className="p-6 text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">
              {data.classes.length}
            </div>
            <div className="text-gray-700 font-semibold">학급 수</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200">
          <CardContent className="p-6 text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">
              {data.teachers.length}
            </div>
            <div className="text-gray-700 font-semibold">교사 수</div>
          </CardContent>
        </Card>
      </div>

      {/* 네비게이션 */}
      <div className="flex justify-end pt-6 border-t border-gray-200">
        <Button variant="outline" onClick={prevStep} size="lg">
          이전
        </Button>
      </div>
    </div>
  );
}
