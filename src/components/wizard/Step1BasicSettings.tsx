"use client";

import { useState } from "react";
import { TimetableData, Day } from "@/types/timetable";

interface Step1BasicSettingsProps {
  data: TimetableData;
  updateData: (updates: Partial<TimetableData>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

const DAYS: Day[] = ["월", "화", "수", "목", "금"];

export default function Step1BasicSettings({
  data,
  updateData,
  nextStep,
  prevStep,
}: Step1BasicSettingsProps) {
  const [schedule, setSchedule] = useState(data.schoolSchedule);

  const handleDayToggle = (day: Day) => {
    const newDays = schedule.days.includes(day)
      ? schedule.days.filter((d) => d !== day)
      : [...schedule.days, day].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b));

    setSchedule({
      ...schedule,
      days: newDays,
    });
  };

  const handlePeriodChange = (day: Day, periods: number) => {
    setSchedule({
      ...schedule,
      periodsPerDay: {
        ...schedule.periodsPerDay,
        [day]: Math.max(1, Math.min(10, periods)),
      },
    });
  };

  const handleLunchPeriodChange = (period: number) => {
    setSchedule({
      ...schedule,
      lunchPeriod: Math.max(1, Math.min(10, period)),
    });
  };

  const handleSave = () => {
    updateData({ schoolSchedule: schedule });
    nextStep();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card">
        <h2 className="text-3xl font-bold mb-6">기본 설정</h2>
        <p className="text-gray-600 mb-8">
          학교 운영 시간표를 설정하세요. 수업이 진행되는 요일과 각 요일별
          교시 수를 입력합니다.
        </p>

        {/* 요일 선택 */}
        <div className="form-group">
          <label className="text-xl font-semibold mb-4 block">
            수업 요일 선택
          </label>
          <div className="flex flex-wrap gap-4">
            {DAYS.map((day) => (
              <button
                key={day}
                onClick={() => handleDayToggle(day)}
                className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                  schedule.days.includes(day)
                    ? "bg-blue-600 text-white shadow-lg"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {day}요일
              </button>
            ))}
          </div>
        </div>

        {/* 각 요일별 교시 수 설정 */}
        <div className="form-group mt-8">
          <label className="text-xl font-semibold mb-4 block">
            요일별 교시 수 설정
          </label>
          <div className="space-y-4">
            {DAYS.map((day) => (
              <div
                key={day}
                className={`p-4 rounded-xl ${
                  schedule.days.includes(day)
                    ? "bg-blue-50 border-2 border-blue-200"
                    : "bg-gray-100 border-2 border-gray-200 opacity-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">{day}요일</span>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={schedule.periodsPerDay[day]}
                      onChange={(e) =>
                        handlePeriodChange(day, parseInt(e.target.value) || 1)
                      }
                      disabled={!schedule.days.includes(day)}
                      className="w-20 px-4 py-2 border-2 border-gray-300 rounded-lg text-center font-semibold disabled:bg-gray-200"
                    />
                    <span className="text-gray-600">교시</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 점심 시간 설정 */}
        <div className="form-group mt-8">
          <label className="text-xl font-semibold mb-4 block">
            점심 시간 전 교시 설정
          </label>
          <p className="text-gray-600 mb-4 text-sm">
            점심 시간 전에 한 교사에게 수업이 편중되지 않도록 하는 제약조건에
            사용됩니다.
          </p>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min="1"
              max="10"
              value={schedule.lunchPeriod || 4}
              onChange={(e) =>
                handleLunchPeriodChange(parseInt(e.target.value) || 4)
              }
              className="w-20 px-4 py-2 border-2 border-gray-300 rounded-lg text-center font-semibold"
            />
            <span className="text-gray-600">교시까지</span>
          </div>
        </div>

        {/* 네비게이션 */}
        <div className="navigation">
          <button className="btn btn-secondary" onClick={prevStep}>
            이전
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            다음 단계
          </button>
        </div>
      </div>
    </div>
  );
}
