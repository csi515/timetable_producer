"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ReviewAndExport from "@/components/ReviewAndExport";

export default function ResultPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    // 결제 확인
    const isPaid = localStorage.getItem("paid") === "true";
    if (!isPaid) {
      router.push("/pay");
      return;
    }

    // 로컬 스토리지에서 데이터 로드
    const savedData = localStorage.getItem("timetable-data");
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        if (!parsedData.schedule || Object.keys(parsedData.schedule).length === 0) {
          router.push("/generator");
          return;
        }
        setData(parsedData);
      } catch (error) {
        console.error("데이터 로드 실패:", error);
        router.push("/editor");
      }
    } else {
      router.push("/editor");
    }
  }, [router]);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  const updateData = (section: string, newData: any) => {
    const updatedData = {
      ...data,
      [section]: newData,
      metadata: {
        ...data.metadata,
        last_modified: new Date().toISOString(),
      },
    };
    setData(updatedData);
    localStorage.setItem("timetable-data", JSON.stringify(updatedData));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container py-8">
        <ReviewAndExport data={data} updateData={updateData} />
      </div>
    </div>
  );
}
