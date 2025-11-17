"use client";

import { useState } from "react";
import { TimetableData, Day } from "@/types/timetable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar, Clock, Utensils } from "lucide-react";

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
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center">
            <Calendar className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">기본 설정</h2>
            <p className="text-gray-600 mt-1">
              학교 운영 시간표를 설정하세요
            </p>
          </div>
        </div>
      </div>

      {/* 요일 선택 */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-600" />
            수업 요일 선택
          </CardTitle>
          <CardDescription>
            시간표에 포함할 요일을 선택하세요. 최소 1개 이상 선택해야 합니다.
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
                    shadow-md hover:shadow-lg
                    ${
                      isSelected
                        ? "bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg"
                        : "bg-white text-gray-700 border-2 border-gray-300 hover:border-primary-300"
                    }
                  `}
                >
                  {day}요일
                </button>
              );
            })}
          </div>
          {schedule.days.length === 0 && (
            <p className="text-sm text-error-600 mt-4 font-medium">
              ⚠️ 최소 1개 이상의 요일을 선택해주세요.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 각 요일별 교시 수 설정 */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-600" />
            요일별 교시 수 설정
          </CardTitle>
          <CardDescription>
            각 요일마다 몇 교시까지 수업을 진행하는지 설정하세요. (1~10교시)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {DAYS.map((day) => {
              const isEnabled = schedule.days.includes(day);
              return (
                <div
                  key={day}
                  className={`
                    p-4 rounded-xl border-2 transition-all
                    ${
                      isEnabled
                        ? "bg-primary-50 border-primary-200 hover:border-primary-300"
                        : "bg-gray-50 border-gray-200 opacity-50"
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold text-gray-900 flex items-center gap-2">
                      <span className="text-lg">{day}요일</span>
                      {!isEnabled && (
                        <span className="text-xs text-gray-500">(선택되지 않음)</span>
                      )}
                    </Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={schedule.periodsPerDay[day]}
                        onChange={(e) =>
                          handlePeriodChange(day, parseInt(e.target.value) || 1)
                        }
                        disabled={!isEnabled}
                        className="w-24 text-center font-semibold text-lg"
                      />
                      <span className="text-gray-600 font-medium min-w-[3rem]">교시</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 점심 시간 설정 */}
      <Card className="border-2 border-warning-200 bg-warning-50">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Utensils className="w-5 h-5 text-warning-600" />
            점심 시간 전 교시 설정
          </CardTitle>
          <CardDescription>
            점심 시간 전에 한 교사에게 수업이 편중되지 않도록 하는 제약조건에 사용됩니다.
            예: 4교시까지 설정하면 1~4교시를 점심 전으로 간주합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label className="text-base font-semibold text-gray-900">점심 시간 전 교시:</Label>
            <Input
              type="number"
              min="1"
              max="10"
              value={schedule.lunchPeriod || 4}
              onChange={(e) =>
                handleLunchPeriodChange(parseInt(e.target.value) || 4)
              }
              className="w-24 text-center font-semibold text-lg"
            />
            <span className="text-gray-700 font-medium">교시까지</span>
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
          disabled={schedule.days.length === 0}
        >
          다음 단계 →
        </Button>
      </div>
    </div>
  );
}
