"use client";

import { useState } from "react";
import { TimetableData, Assignment, Day } from "@/types/timetable";
import TimetableGrid from "@/components/timetable/TimetableGrid";
import TeacherTimetable from "@/components/timetable/TeacherTimetable";
import { Download, FileSpreadsheet, Image as ImageIcon } from "lucide-react";
import { exportToExcel, exportToImage } from "@/utils/export";

interface Step6ReviewProps {
  data: TimetableData;
  updateData: (updates: Partial<TimetableData>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

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
      <div className="max-w-4xl mx-auto">
        <div className="card">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              생성된 시간표가 없습니다
            </h2>
            <p className="text-gray-600 mb-8">
              이전 단계로 돌아가 시간표를 생성해주세요.
            </p>
            <button className="btn btn-primary" onClick={prevStep}>
              시간표 생성으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* 헤더 및 내보내기 */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold">시간표 검토 및 다운로드</h2>
          <div className="flex gap-4">
            <button
              onClick={handleExportExcel}
              className="btn btn-success flex items-center gap-2"
            >
              <FileSpreadsheet className="w-5 h-5" />
              Excel 다운로드
            </button>
            <button
              onClick={handleExportImage}
              className="btn btn-primary flex items-center gap-2"
            >
              <ImageIcon className="w-5 h-5" />
              이미지 다운로드
            </button>
          </div>
        </div>

        {/* 뷰 선택 */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setSelectedView("class")}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              selectedView === "class"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            학급별 시간표
          </button>
          <button
            onClick={() => setSelectedView("teacher")}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              selectedView === "teacher"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            교사별 시간표
          </button>
        </div>

        {/* 학급 선택 (학급별 뷰) */}
        {selectedView === "class" && (
          <div className="mb-6">
            <label className="text-sm text-gray-600 mb-2 block">
              학급 선택
            </label>
            <div className="flex flex-wrap gap-2">
              {data.classes.map((classItem) => (
                <button
                  key={classItem.id}
                  onClick={() => setSelectedClass(classItem.id)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    selectedClass === classItem.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {classItem.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 교사 선택 (교사별 뷰) */}
        {selectedView === "teacher" && (
          <div className="mb-6">
            <label className="text-sm text-gray-600 mb-2 block">
              교사 선택
            </label>
            <div className="flex flex-wrap gap-2">
              {data.teachers.map((teacher) => (
                <button
                  key={teacher.id}
                  onClick={() => setSelectedTeacher(teacher.id)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    selectedTeacher === teacher.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {teacher.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 시간표 표시 */}
      <div className="card">
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
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">
              {data.assignments.length}
            </div>
            <div className="text-gray-700 font-semibold">배정된 수업</div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-green-50 to-green-100">
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">
              {data.classes.length}
            </div>
            <div className="text-gray-700 font-semibold">학급 수</div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-purple-50 to-purple-100">
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">
              {data.teachers.length}
            </div>
            <div className="text-gray-700 font-semibold">교사 수</div>
          </div>
        </div>
      </div>

      {/* 네비게이션 */}
      <div className="navigation">
        <button className="btn btn-secondary" onClick={prevStep}>
          이전
        </button>
      </div>
    </div>
  );
}
