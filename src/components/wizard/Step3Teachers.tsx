"use client";

import { useState } from "react";
import { TimetableData, Teacher, TimeSlot, Day } from "@/types/timetable";
import { Plus, Trash2, X } from "lucide-react";

interface Step3TeachersProps {
  data: TimetableData;
  updateData: (updates: Partial<TimetableData>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

const DAYS: Day[] = ["월", "화", "수", "목", "금"];

export default function Step3Teachers({
  data,
  updateData,
  nextStep,
  prevStep,
}: Step3TeachersProps) {
  const [teachers, setTeachers] = useState<Teacher[]>(data.teachers);

  const addTeacher = () => {
    const newTeacher: Teacher = {
      id: `teacher_${Date.now()}`,
      name: "",
      subjects: [],
      weeklyHours: 0,
      maxHoursPerDay: undefined,
      unavailableSlots: [],
    };

    setTeachers([...teachers, newTeacher]);
  };

  const removeTeacher = (id: string) => {
    setTeachers(teachers.filter((t) => t.id !== id));
  };

  const updateTeacher = (id: string, updates: Partial<Teacher>) => {
    setTeachers(
      teachers.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const toggleSubject = (teacherId: string, subjectId: string) => {
    const teacher = teachers.find((t) => t.id === teacherId);
    if (!teacher) return;

    const newSubjects = teacher.subjects.includes(subjectId)
      ? teacher.subjects.filter((s) => s !== subjectId)
      : [...teacher.subjects, subjectId];

    updateTeacher(teacherId, { subjects: newSubjects });
  };

  const addUnavailableSlot = (teacherId: string) => {
    const teacher = teachers.find((t) => t.id === teacherId);
    if (!teacher) return;

    const newSlot: TimeSlot = {
      day: "월",
      period: 1,
    };

    updateTeacher(teacherId, {
      unavailableSlots: [...teacher.unavailableSlots, newSlot],
    });
  };

  const removeUnavailableSlot = (teacherId: string, index: number) => {
    const teacher = teachers.find((t) => t.id === teacherId);
    if (!teacher) return;

    const newSlots = teacher.unavailableSlots.filter((_, i) => i !== index);
    updateTeacher(teacherId, { unavailableSlots: newSlots });
  };

  const updateUnavailableSlot = (
    teacherId: string,
    index: number,
    updates: Partial<TimeSlot>
  ) => {
    const teacher = teachers.find((t) => t.id === teacherId);
    if (!teacher) return;

    const newSlots = teacher.unavailableSlots.map((slot, i) =>
      i === index ? { ...slot, ...updates } : slot
    );

    updateTeacher(teacherId, { unavailableSlots: newSlots });
  };

  const handleSave = () => {
    updateData({ teachers });
    nextStep();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold">교사 설정</h2>
          <button
            onClick={addTeacher}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            교사 추가
          </button>
        </div>

        <div className="space-y-6">
          {teachers.map((teacher) => (
            <div
              key={teacher.id}
              className="p-6 bg-gray-50 rounded-xl border-2 border-gray-200"
            >
              {/* 기본 정보 */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">
                    교사명 *
                  </label>
                  <input
                    type="text"
                    value={teacher.name}
                    onChange={(e) =>
                      updateTeacher(teacher.id, { name: e.target.value })
                    }
                    placeholder="예: 홍길동"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">
                    주당 시수 *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={teacher.weeklyHours}
                    onChange={(e) =>
                      updateTeacher(teacher.id, {
                        weeklyHours: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">
                    하루 최대 수업수 (선택)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={teacher.maxHoursPerDay || ""}
                    onChange={(e) =>
                      updateTeacher(teacher.id, {
                        maxHoursPerDay: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder="제한 없음"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* 담당 과목 */}
              <div className="mb-4">
                <label className="text-sm text-gray-600 mb-2 block">
                  담당 과목 *
                </label>
                <div className="flex flex-wrap gap-2">
                  {data.subjects.map((subject) => (
                    <button
                      key={subject.id}
                      onClick={() => toggleSubject(teacher.id, subject.id)}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                        teacher.subjects.includes(subject.id)
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      {subject.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 불가능 시간 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-600">
                    불가능한 시간대
                  </label>
                  <button
                    onClick={() => addUnavailableSlot(teacher.id)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    + 추가
                  </button>
                </div>
                <div className="space-y-2">
                  {teacher.unavailableSlots.map((slot, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 bg-white rounded-lg"
                    >
                      <select
                        value={slot.day}
                        onChange={(e) =>
                          updateUnavailableSlot(teacher.id, index, {
                            day: e.target.value as Day,
                          })
                        }
                        className="px-3 py-1 border border-gray-300 rounded"
                      >
                        {DAYS.map((day) => (
                          <option key={day} value={day}>
                            {day}요일
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={slot.period}
                        onChange={(e) =>
                          updateUnavailableSlot(teacher.id, index, {
                            period: parseInt(e.target.value) || 1,
                          })
                        }
                        className="w-20 px-3 py-1 border border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-600">교시</span>
                      <button
                        onClick={() => removeUnavailableSlot(teacher.id, index)}
                        className="ml-auto p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => removeTeacher(teacher.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}

          {teachers.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              교사를 추가해주세요.
            </p>
          )}
        </div>
      </div>

      {/* 네비게이션 */}
      <div className="navigation">
        <button className="btn btn-secondary" onClick={prevStep}>
          이전
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={
            teachers.length === 0 ||
            teachers.some(
              (t) => !t.name || t.subjects.length === 0 || t.weeklyHours === 0
            )
          }
        >
          다음 단계
        </button>
      </div>
    </div>
  );
}
