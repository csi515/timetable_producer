"use client";

import { useState } from "react";
import { TimetableData, Teacher, TimeSlot, Day } from "@/types/timetable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, X, User, Clock, BookOpen } from "lucide-react";

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
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="mb-8">
        <CardTitle className="text-3xl font-bold mb-2 flex items-center gap-3">
          <User className="w-8 h-8 text-primary-600" />
          교사 설정
        </CardTitle>
        <CardDescription className="text-lg mt-2">
          교사 정보, 담당 과목, 주당 시수, 불가능한 시간대를 설정하세요.
        </CardDescription>
      </div>

      <div className="flex justify-end mb-6">
        <Button onClick={addTeacher} className="gap-2">
          <Plus className="w-4 h-4" />
          교사 추가
        </Button>
      </div>

      <div className="space-y-6">
        {teachers.map((teacher) => (
          <Card key={teacher.id} className="border-2">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2">
                  <User className="w-5 h-5" />
                  교사 정보
                </CardTitle>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeTeacher(teacher.id)}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  삭제
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                    교사명 <span className="text-error-500">*</span>
                  </Label>
                  <Input
                    type="text"
                    value={teacher.name}
                    onChange={(e) =>
                      updateTeacher(teacher.id, { name: e.target.value })
                    }
                    placeholder="예: 홍길동"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                    주당 시수 <span className="text-error-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={teacher.weeklyHours}
                    onChange={(e) =>
                      updateTeacher(teacher.id, {
                        weeklyHours: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                    하루 최대 수업수 (선택)
                  </Label>
                  <Input
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
                  />
                </div>
              </div>

              {/* 담당 과목 */}
              <div>
                <Label className="text-sm font-semibold text-gray-700 mb-3 block flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  담당 과목 <span className="text-error-500">*</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {data.subjects.map((subject) => {
                    const isSelected = teacher.subjects.includes(subject.id);
                    return (
                      <button
                        key={subject.id}
                        onClick={() => toggleSubject(teacher.id, subject.id)}
                        className={`
                          px-4 py-2 rounded-lg font-semibold text-sm transition-all transform hover:scale-105
                          ${
                            isSelected
                              ? "bg-primary-600 text-white shadow-md"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }
                        `}
                      >
                        {subject.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 불가능 시간 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    불가능한 시간대
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addUnavailableSlot(teacher.id)}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    추가
                  </Button>
                </div>
                <div className="space-y-2">
                  {teacher.unavailableSlots.map((slot, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <select
                        value={slot.day}
                        onChange={(e) =>
                          updateUnavailableSlot(teacher.id, index, {
                            day: e.target.value as Day,
                          })
                        }
                        className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
                      >
                        {DAYS.map((day) => (
                          <option key={day} value={day}>
                            {day}요일
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={slot.period}
                        onChange={(e) =>
                          updateUnavailableSlot(teacher.id, index, {
                            period: parseInt(e.target.value) || 1,
                          })
                        }
                        className="w-20"
                      />
                      <span className="text-sm text-gray-600 font-medium">교시</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeUnavailableSlot(teacher.id, index)}
                        className="ml-auto"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {teacher.unavailableSlots.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      불가능한 시간대가 없습니다.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {teachers.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <User className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>교사를 추가해주세요.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 네비게이션 */}
      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <Button variant="outline" onClick={prevStep} size="lg">
          이전
        </Button>
        <Button
          onClick={handleSave}
          size="lg"
          disabled={
            teachers.length === 0 ||
            teachers.some(
              (t) => !t.name || t.subjects.length === 0 || t.weeklyHours === 0
            )
          }
          className="px-8"
        >
          다음 단계
        </Button>
      </div>
    </div>
  );
}
