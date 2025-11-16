"use client";

import { useState } from "react";
import { TimetableData } from "@/types/timetable";

interface Step4ConstraintsProps {
  data: TimetableData;
  updateData: (updates: Partial<TimetableData>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

export default function Step4Constraints({
  data,
  updateData,
  nextStep,
  prevStep,
}: Step4ConstraintsProps) {
  const [constraints, setConstraints] = useState(data.constraints);

  const handleSave = () => {
    updateData({ constraints });
    nextStep();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card">
        <h2 className="text-3xl font-bold mb-6">제약조건 설정</h2>
        <p className="text-gray-600 mb-8">
          시간표 생성 시 적용할 제약조건을 설정하세요. 각 옵션을 켜고 끌 수
          있습니다.
        </p>

        <div className="space-y-6">
          {/* 연속 3교시 금지 */}
          <div className="p-6 bg-gray-50 rounded-xl border-2 border-gray-200">
            <label className="flex items-start gap-4 cursor-pointer">
              <input
                type="checkbox"
                checked={constraints.preventConsecutive3Periods}
                onChange={(e) =>
                  setConstraints({
                    ...constraints,
                    preventConsecutive3Periods: e.target.checked,
                  })
                }
                className="w-6 h-6 mt-1"
              />
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">
                  연속 3교시 금지
                </h3>
                <p className="text-gray-600 text-sm">
                  같은 교사가 같은 반에서 연속으로 3교시 이상 수업하는 것을
                  방지합니다.
                </p>
              </div>
            </label>
          </div>

          {/* 점심 전 편중 방지 */}
          <div className="p-6 bg-gray-50 rounded-xl border-2 border-gray-200">
            <label className="flex items-start gap-4 cursor-pointer">
              <input
                type="checkbox"
                checked={constraints.preventMorningOverload}
                onChange={(e) =>
                  setConstraints({
                    ...constraints,
                    preventMorningOverload: e.target.checked,
                  })
                }
                className="w-6 h-6 mt-1"
              />
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">
                  점심 전 편중 방지
                </h3>
                <p className="text-gray-600 text-sm">
                  점심 시간 전 교시에 한 교사에게 수업이 편중되지 않도록
                  배치합니다. (점심 시간: {data.schoolSchedule.lunchPeriod}
                  교시까지)
                </p>
              </div>
            </label>
          </div>

          {/* 하루 2회 배정 금지 */}
          <div className="p-6 bg-gray-50 rounded-xl border-2 border-gray-200">
            <label className="flex items-start gap-4 cursor-pointer">
              <input
                type="checkbox"
                checked={constraints.preventDuplicateSubjectPerDay}
                onChange={(e) =>
                  setConstraints({
                    ...constraints,
                    preventDuplicateSubjectPerDay: e.target.checked,
                  })
                }
                className="w-6 h-6 mt-1"
              />
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">
                  하루 2회 배정 금지
                </h3>
                <p className="text-gray-600 text-sm">
                  같은 과목이 같은 반에서 하루에 2회 이상 배정되는 것을
                  방지합니다. (연강 필요한 과목 제외)
                </p>
              </div>
            </label>
          </div>

          {/* 고르게 분포 */}
          <div className="p-6 bg-gray-50 rounded-xl border-2 border-gray-200">
            <label className="flex items-start gap-4 cursor-pointer">
              <input
                type="checkbox"
                checked={constraints.ensureEvenDistribution}
                onChange={(e) =>
                  setConstraints({
                    ...constraints,
                    ensureEvenDistribution: e.target.checked,
                  })
                }
                className="w-6 h-6 mt-1"
              />
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">
                  고르게 분포
                </h3>
                <p className="text-gray-600 text-sm">
                  각 반에 모든 과목이 주간에 고르게 분포되도록 휴리스틱을
                  적용합니다.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* 필수 제약조건 안내 */}
        <div className="mt-8 p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">
            ⚠️ 항상 적용되는 제약조건
          </h3>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>교사는 동일 시간대에 두 반을 수업할 수 없습니다.</li>
            <li>한 반도 동일 시간대에 두 과목 수업 불가합니다.</li>
            <li>교사별 주당 시수는 정확히 충족되어야 합니다.</li>
            <li>교사별 불가능 시간은 반영됩니다.</li>
            <li>연강이 필요한 과목은 2교시 연속으로 배치됩니다.</li>
            <li>특별실은 중복 배정되지 않습니다.</li>
          </ul>
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
