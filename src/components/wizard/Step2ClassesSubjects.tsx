"use client";

import { useState } from "react";
import { TimetableData, Class, Subject } from "@/types/timetable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, GraduationCap, BookOpen, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
    const existingGrades = classes.map(c => c.grade);
    const maxGrade = existingGrades.length > 0 ? Math.max(...existingGrades) : 0;
    const grade = maxGrade + 1;
    const classNumber = 1;

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
      weeklyHours: 1,
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

  const canProceed = classes.length > 0 && subjects.length > 0 && 
    subjects.every(s => s.name.trim() !== "");

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-lg bg-success-100 flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-success-600" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">학급 및 과목 설정</h2>
            <p className="text-gray-600 mt-1">
              학급 목록과 과목 정보를 입력하세요
            </p>
          </div>
        </div>
      </div>

      {/* 학급 설정 */}
      <Card className="border-2">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary-600" />
              학급 설정
            </CardTitle>
            <Button
              onClick={addClass}
              size="sm"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              학급 추가
            </Button>
          </div>
          <CardDescription>
            학교의 학급 정보를 입력하세요. 학년과 반 번호를 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {classes.map((classItem, index) => (
              <Card
                key={classItem.id}
                className="border-2 border-gray-200 hover:border-primary-300 transition-all"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-sm text-gray-600 mb-2 block">
                          학년 *
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
                          className="font-semibold"
                        />
                      </div>
                      <div>
                        <Label className="text-sm text-gray-600 mb-2 block">
                          반 번호 *
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
                          className="font-semibold"
                        />
                      </div>
                      <div>
                        <Label className="text-sm text-gray-600 mb-2 block">
                          학급명
                        </Label>
                        <Input
                          type="text"
                          value={classItem.name}
                          onChange={(e) =>
                            updateClass(classItem.id, { name: e.target.value })
                          }
                          placeholder="예: 1학년 1반"
                          className="font-semibold"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={() => removeClass(classItem.id)}
                      variant="ghost"
                      size="icon"
                      className="text-error-600 hover:text-error-700 hover:bg-error-50"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {classes.length === 0 && (
              <Alert variant="warning" className="border-warning-200">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  학급을 추가해주세요. 최소 1개 이상의 학급이 필요합니다.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 과목 설정 */}
      <Card className="border-2">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-600" />
              과목 설정
            </CardTitle>
            <Button
              onClick={addSubject}
              size="sm"
              variant="secondary"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              과목 추가
            </Button>
          </div>
          <CardDescription>
            수업할 과목 정보를 입력하세요. 과목명, 주당 시수, 특수 조건을 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {subjects.map((subject, index) => (
              <Card
                key={subject.id}
                className="border-2 border-gray-200 hover:border-purple-300 transition-all"
              >
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* 기본 정보 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                          과목명 *
                        </Label>
                        <Input
                          type="text"
                          value={subject.name}
                          onChange={(e) =>
                            updateSubject(subject.id, { name: e.target.value })
                          }
                          placeholder="예: 수학, 체육"
                          className="font-semibold"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                          주당 시수 *
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          value={subject.weeklyHours || 1}
                          onChange={(e) =>
                            updateSubject(subject.id, {
                              weeklyHours: parseInt(e.target.value) || 1,
                            })
                          }
                          className="font-semibold"
                        />
                      </div>
                    </div>

                    {/* 옵션 설정 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
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
                          className="text-sm font-medium cursor-pointer"
                        >
                          연강 필요 (2교시 연속)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                        <Checkbox
                          id={`special-${subject.id}`}
                          checked={subject.requiresSpecialRoom || false}
                          onCheckedChange={(checked) =>
                            updateSubject(subject.id, {
                              requiresSpecialRoom: checked as boolean,
                            })
                          }
                        />
                        <Label
                          htmlFor={`special-${subject.id}`}
                          className="text-sm font-medium cursor-pointer"
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
                          className="font-semibold"
                        />
                      </div>
                    </div>

                    {/* 특별실 종류 */}
                    {subject.requiresSpecialRoom && (
                      <div>
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
                          placeholder="예: 실험실, 컴퓨터실, 음악실"
                          className="font-semibold"
                        />
                      </div>
                    )}

                    {/* 삭제 버튼 */}
                    <div className="flex justify-end pt-2 border-t">
                      <Button
                        onClick={() => removeSubject(subject.id)}
                        variant="ghost"
                        size="sm"
                        className="text-error-600 hover:text-error-700 hover:bg-error-50"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        삭제
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {subjects.length === 0 && (
              <Alert variant="warning" className="border-warning-200">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  과목을 추가해주세요. 최소 1개 이상의 과목이 필요합니다.
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
