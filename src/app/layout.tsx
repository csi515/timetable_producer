import type { Metadata } from "next";
import "../styles/global.css";

export const metadata: Metadata = {
  title: "시간표 자동 생성 시스템",
  description: "중·고등학교용 시간표 자동 생성 웹서비스",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
