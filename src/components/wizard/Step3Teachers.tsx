"use client";

import { useState } from "react";
import { TimetableData, Teacher, TimeSlot, Day } from "@/types/timetable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, X, User, Clock, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  const canProceed =
    teachers.length > 0 &&
    teachers.every(
      (t) =>
        t.name.trim() !== "" &&
        t.subjects.length > 0 &&
        t.weeklyHours > 0
    );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
            <User className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">교사 설정</h2>
            <p className="text-gray-600 mt-1">
              교사 정보, 담당 과목, 불가능 시간을 입력하세요
            </p>
          </div>
        </div>
      </div>

      {/* 교사 목록 */}
      <Card className="border-2">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <User className="w-5 h-5 text-purple-600" />
              교사 목록
            </CardTitle>
            <Button onClick={addTeacher} size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              교사 추가
            </Button>
          </div>
          <CardDescription>
            각 교사의 기본 정보와 담당 과목을 설정하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            {teachers.map((teacher) => (
              <Card
                key={teacher.id}
                className="border-2 border-gray-200 hover:border-purple-300 transition-all"
              >
                <CardContent className="p-6">
                  {/* 기본 정보 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                      <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                        교사명 *
                      </Label>
                      <Input
                        type="text"
                        value={teacher.name}
                        onChange={(e) =>
                          updateTeacher(teacher.id, { name: e.target.value })
                        }
                        placeholder="예: 홍길동"
                        className="font-semibold"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                        주당 시수 *
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
                        className="font-semibold"
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
                        className="font-semibold"
                      />
                    </div>
                  </div>

                  {/* 담당 과목 */}
                  <div className="mb-6">
                    <Label className="text-sm font-semibold text-gray-700 mb-3 block">
                      담당 과목 * (클릭하여 선택)
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
                                  : "bg-gray-100 text-gray-700 border-2 border-gray-300 hover:border-primary-300"
                              }
                            `}
                          >
                            {subject.name}
                          </button>
                        );
                      })}
                    </div>
                    {teacher.subjects.length === 0 && (
                      <p className="text-sm text-error-600 mt-2">
                        ⚠️ 최소 1개 이상의 과목을 선택해주세요.
                      </p>
                    )}
                  </div>

                  {/* 불가능 시간 */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm font-semibold text-gray-700">
                        불가능한 시간대
                      </Label>
                      <Button
                        onClick={() => addUnavailableSlot(teacher.id)}
                        variant="outline"
                        size="sm"
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
                          <Select
                            value={slot.day}
                            onValueChange={(value) =>
                              updateUnavailableSlot(teacher.id, index, {
                                day: value as Day,
                              })
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS.map((day) => (
                                <SelectItem key={day} value={day}>
                                  {day}요일
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                            className="w-20 text-center font-semibold"
                          />
                          <span className="text-sm text-gray-600 font-medium">교시</span>
                          <Button
                            onClick={() => removeUnavailableSlot(teacher.id, index)}
                            variant="ghost"
                            size="icon"
                            className="ml-auto text-error-600 hover:text-error-700 hover:bg-error-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      {teacher.unavailableSlots.length === 0 && (
                        <p className="text-sm text-gray-500 italic">
                          불가능한 시간대가 없습니다. 모든 시간에 수업 가능합니다.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 삭제 버튼 */}
                  <div className="flex justify-end pt-4 mt-4 border-t">
                    <Button
                      onClick={() => removeTeacher(teacher.id)}
                      variant="ghost"
                      size="sm"
                      className="text-error-600 hover:text-error-700 hover:bg-error-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      교사 삭제
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {teachers.length === 0 && (
              <Alert variant="warning" className="border-warning-200">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  교사를 추가해주세요. 최소 1명 이상의 교사가 필요합니다.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 네비게이션 */}
      <div className="flex justify-between items-center pt-6 border-t-2 border-gray-200">
        <Button variant="outline" onClick={prevStep} size="lg" className="px-8">
          ← 이전
        </Button>
        <Button
          onClick={handleSave}
          size="lg"
          className="px-8 shadow-lg hover:shadow-xl"
          disabled={!canProceed}
        >
          다음 단계 →
        </Button>
      </div>
    </div>
  );
}
