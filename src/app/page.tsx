"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // 결제 여부 확인
    const isPaid = localStorage.getItem("paid") === "true";
    
    if (isPaid) {
      router.push("/editor");
    } else {
      router.push("/pay");
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="loading-spinner"></div>
    </div>
  );
}
