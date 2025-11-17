"use client";

import { useState } from "react";
import { TimetableData, Class, Subject } from "@/types/timetable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, GraduationCap, BookOpen } from "lucide-react";

interface Step2ClassesSubjectsProps {
  data: TimetableData;
  updateData: (updates: Partial<TimetableData>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

export default function Step2ClassesSubjects({
  data,
  updateData,
  nextStep,
  prevStep,
}: Step2ClassesSubjectsProps) {
  const [classes, setClasses] = useState<Class[]>(data.classes);
  const [subjects, setSubjects] = useState<Subject[]>(data.subjects);

  const addClass = () => {
    const grade = Math.max(...classes.map((c) => c.grade), 0) + 1;
    const classNumber =
      Math.max(
        ...classes.filter((c) => c.grade === grade).map((c) => c.classNumber),
        0
      ) + 1;

    const newClass: Class = {
      id: `class_${Date.now()}`,
      name: `${grade}학년 ${classNumber}반`,
      grade,
      classNumber,
    };

    setClasses([...classes, newClass]);
  };

  const removeClass = (id: string) => {
    setClasses(classes.filter((c) => c.id !== id));
  };

  const updateClass = (id: string, updates: Partial<Class>) => {
    setClasses(
      classes.map((c) =>
        c.id === id
          ? {
              ...c,
              ...updates,
              name: updates.grade && updates.classNumber
                ? `${updates.grade}학년 ${updates.classNumber}반`
                : c.name,
            }
          : c
      )
    );
  };

  const addSubject = () => {
    const newSubject: Subject = {
      id: `subject_${Date.now()}`,
      name: "",
      weeklyHours: 0,
      requiresConsecutive: false,
      requiresSpecialRoom: false,
      maxPerDay: 1,
      difficulty: 5,
    };

    setSubjects([...subjects, newSubject]);
  };

  const removeSubject = (id: string) => {
    setSubjects(subjects.filter((s) => s.id !== id));
  };

  const updateSubject = (id: string, updates: Partial<Subject>) => {
    setSubjects(
      subjects.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const handleSave = () => {
    updateData({ classes, subjects });
    nextStep();
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* 학급 설정 */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">학급 설정</CardTitle>
                <CardDescription>
                  학년과 반 정보를 입력하세요.
                </CardDescription>
              </div>
            </div>
            <Button onClick={addClass} className="gap-2">
              <Plus className="w-4 h-4" />
              학급 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {classes.map((classItem) => (
              <Card key={classItem.id} className="border-2">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                      <Label className="text-sm text-gray-600 mb-2 block">
                        학년
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        max="6"
                        value={classItem.grade}
                        onChange={(e) =>
                          updateClass(classItem.id, {
                            grade: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600 mb-2 block">
                        반
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        value={classItem.classNumber}
                        onChange={(e) =>
                          updateClass(classItem.id, {
                            classNumber: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-sm text-gray-600 mb-2 block">
                        학급명
                      </Label>
                      <Input
                        type="text"
                        value={classItem.name}
                        onChange={(e) =>
                          updateClass(classItem.id, { name: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeClass(classItem.id)}
                      className="gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      삭제
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {classes.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <GraduationCap className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>학급을 추가해주세요.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 과목 설정 */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">과목 설정</CardTitle>
                <CardDescription>
                  과목 정보와 제약조건을 설정하세요.
                </CardDescription>
              </div>
            </div>
            <Button onClick={addSubject} variant="success" className="gap-2">
              <Plus className="w-4 h-4" />
              과목 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {subjects.map((subject) => (
              <Card key={subject.id} className="border-2">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                        과목명 <span className="text-error-500">*</span>
                      </Label>
                      <Input
                        type="text"
                        value={subject.name}
                        onChange={(e) =>
                          updateSubject(subject.id, { name: e.target.value })
                        }
                        placeholder="예: 수학, 체육"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                        주당 시수 <span className="text-error-500">*</span>
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={subject.weeklyHours || 0}
                        onChange={(e) =>
                          updateSubject(subject.id, {
                            weeklyHours: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`consecutive-${subject.id}`}
                        checked={subject.requiresConsecutive || false}
                        onCheckedChange={(checked) =>
                          updateSubject(subject.id, {
                            requiresConsecutive: checked as boolean,
                          })
                        }
                      />
                      <Label
                        htmlFor={`consecutive-${subject.id}`}
                        className="text-sm cursor-pointer"
                      >
                        연강 필요 (2교시 연속)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`special-room-${subject.id}`}
                        checked={subject.requiresSpecialRoom || false}
                        onCheckedChange={(checked) =>
                          updateSubject(subject.id, {
                            requiresSpecialRoom: checked as boolean,
                          })
                        }
                      />
                      <Label
                        htmlFor={`special-room-${subject.id}`}
                        className="text-sm cursor-pointer"
                      >
                        특별실 필요
                      </Label>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                        하루 최대 배정
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        value={subject.maxPerDay || 1}
                        onChange={(e) =>
                          updateSubject(subject.id, {
                            maxPerDay: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                  </div>

                  {subject.requiresSpecialRoom && (
                    <div className="mb-4">
                      <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                        특별실 종류
                      </Label>
                      <Input
                        type="text"
                        value={subject.specialRoomType || ""}
                        onChange={(e) =>
                          updateSubject(subject.id, {
                            specialRoomType: e.target.value,
                          })
                        }
                        placeholder="예: 실험실, 컴퓨터실"
                      />
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeSubject(subject.id)}
                      className="gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      삭제
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {subjects.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>과목을 추가해주세요.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 네비게이션 */}
      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <Button variant="outline" onClick={prevStep} size="lg">
          이전
        </Button>
        <Button
          onClick={handleSave}
          size="lg"
          disabled={classes.length === 0 || subjects.length === 0}
          className="px-8"
        >
          다음 단계
        </Button>
      </div>
    </div>
  );
}
