"use client";

import { useState } from "react";
import { TimetableData, Day } from "@/types/timetable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar, Clock } from "lucide-react";

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
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <CardTitle className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Calendar className="w-8 h-8 text-primary-600" />
          기본 설정
        </CardTitle>
        <CardDescription className="text-lg mt-2">
          학교 운영 시간표를 설정하세요. 수업이 진행되는 요일과 각 요일별 교시 수를 입력합니다.
        </CardDescription>
      </div>

      {/* 요일 선택 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            수업 요일 선택
          </CardTitle>
          <CardDescription>
            시간표에 포함할 요일을 선택하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {DAYS.map((day) => {
              const isSelected = schedule.days.includes(day);
              return (
                <button
                  key={day}
                  onClick={() => handleDayToggle(day)}
                  className={`
                    px-6 py-3 rounded-xl font-semibold text-base transition-all transform hover:scale-105
                    ${
                      isSelected
                        ? "bg-primary-600 text-white shadow-lg"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }
                  `}
                >
                  {day}요일
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 각 요일별 교시 수 설정 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Clock className="w-5 h-5" />
            요일별 교시 수 설정
          </CardTitle>
          <CardDescription>
            각 요일마다 몇 교시까지 수업을 진행하는지 설정하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {DAYS.map((day) => {
              const isEnabled = schedule.days.includes(day);
              return (
                <div
                  key={day}
                  className={`
                    p-4 rounded-xl border-2 transition-all
                    ${
                      isEnabled
                        ? "bg-primary-50 border-primary-200"
                        : "bg-gray-50 border-gray-200 opacity-50"
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-semibold text-gray-900">
                      {day}요일
                    </Label>
                    <div className="flex items-center gap-4">
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={schedule.periodsPerDay[day]}
                        onChange={(e) =>
                          handlePeriodChange(day, parseInt(e.target.value) || 1)
                        }
                        disabled={!isEnabled}
                        className="w-24 text-center font-semibold"
                      />
                      <span className="text-gray-600 font-medium">교시</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 점심 시간 설정 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-xl">점심 시간 전 교시 설정</CardTitle>
          <CardDescription>
            점심 시간 전에 한 교사에게 수업이 편중되지 않도록 하는 제약조건에 사용됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label className="text-base font-semibold">점심 시간 전 교시:</Label>
            <Input
              type="number"
              min="1"
              max="10"
              value={schedule.lunchPeriod || 4}
              onChange={(e) =>
                handleLunchPeriodChange(parseInt(e.target.value) || 4)
              }
              className="w-24 text-center font-semibold"
            />
            <span className="text-gray-600 font-medium">교시까지</span>
          </div>
        </CardContent>
      </Card>

      {/* 네비게이션 */}
      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <Button variant="outline" onClick={prevStep} size="lg">
          이전
        </Button>
        <Button onClick={handleSave} size="lg" className="px-8">
          다음 단계
        </Button>
      </div>
    </div>
  );
}
