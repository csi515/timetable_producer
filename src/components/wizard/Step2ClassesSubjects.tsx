"use client";

import { useState } from "react";
import { TimetableData, Class, Subject } from "@/types/timetable";
import { Plus, Trash2 } from "lucide-react";

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
    <div className="max-w-6xl mx-auto space-y-8">
      {/* 학급 설정 */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold">학급 설정</h2>
          <button
            onClick={addClass}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            학급 추가
          </button>
        </div>

        <div className="space-y-4">
          {classes.map((classItem) => (
            <div
              key={classItem.id}
              className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200 flex items-center gap-4"
            >
              <div className="flex-1 grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">
                    학년
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={classItem.grade}
                    onChange={(e) =>
                      updateClass(classItem.id, {
                        grade: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">
                    반
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={classItem.classNumber}
                    onChange={(e) =>
                      updateClass(classItem.id, {
                        classNumber: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">
                    학급명
                  </label>
                  <input
                    type="text"
                    value={classItem.name}
                    onChange={(e) =>
                      updateClass(classItem.id, { name: e.target.value })
                    }
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <button
                onClick={() => removeClass(classItem.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}

          {classes.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              학급을 추가해주세요.
            </p>
          )}
        </div>
      </div>

      {/* 과목 설정 */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold">과목 설정</h2>
          <button
            onClick={addSubject}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            과목 추가
          </button>
        </div>

        <div className="space-y-4">
          {subjects.map((subject) => (
            <div
              key={subject.id}
              className="p-6 bg-gray-50 rounded-xl border-2 border-gray-200"
            >
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">
                    과목명 *
                  </label>
                  <input
                    type="text"
                    value={subject.name}
                    onChange={(e) =>
                      updateSubject(subject.id, { name: e.target.value })
                    }
                    placeholder="예: 수학, 체육"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">
                    난이도 (1-10)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={subject.difficulty || 5}
                    onChange={(e) =>
                      updateSubject(subject.id, {
                        difficulty: parseInt(e.target.value) || 5,
                      })
                    }
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subject.requiresConsecutive || false}
                    onChange={(e) =>
                      updateSubject(subject.id, {
                        requiresConsecutive: e.target.checked,
                      })
                    }
                    className="w-5 h-5"
                  />
                  <span className="text-sm">연강 필요 (2교시 연속)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subject.requiresSpecialRoom || false}
                    onChange={(e) =>
                      updateSubject(subject.id, {
                        requiresSpecialRoom: e.target.checked,
                      })
                    }
                    className="w-5 h-5"
                  />
                  <span className="text-sm">특별실 필요</span>
                </label>
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">
                    하루 최대 배정
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={subject.maxPerDay || 1}
                    onChange={(e) =>
                      updateSubject(subject.id, {
                        maxPerDay: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {subject.requiresSpecialRoom && (
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">
                    특별실 종류
                  </label>
                  <input
                    type="text"
                    value={subject.specialRoomType || ""}
                    onChange={(e) =>
                      updateSubject(subject.id, {
                        specialRoomType: e.target.value,
                      })
                    }
                    placeholder="예: 실험실, 컴퓨터실"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                  />
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => removeSubject(subject.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}

          {subjects.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              과목을 추가해주세요.
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
          disabled={classes.length === 0 || subjects.length === 0}
        >
          다음 단계
        </button>
      </div>
    </div>
  );
}
