// SVG를 PNG로 변환하는 스크립트
// Node.js 환경에서 실행: node scripts/generate-icons.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SVG 내용
const svgContent = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#667eea" rx="64"/>
  <g transform="translate(80, 100)">
    <rect x="0" y="0" width="70" height="40" fill="#ffffff" opacity="0.9" rx="4"/>
    <text x="35" y="28" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#667eea" text-anchor="middle">요일</text>
    <rect x="80" y="0" width="70" height="40" fill="#ffffff" opacity="0.9" rx="4"/>
    <text x="115" y="28" font-family="Arial, sans-serif" font-size="16" fill="#667eea" text-anchor="middle">월</text>
    <rect x="160" y="0" width="70" height="40" fill="#ffffff" opacity="0.9" rx="4"/>
    <text x="195" y="28" font-family="Arial, sans-serif" font-size="16" fill="#667eea" text-anchor="middle">화</text>
    <rect x="240" y="0" width="70" height="40" fill="#ffffff" opacity="0.9" rx="4"/>
    <text x="275" y="28" font-family="Arial, sans-serif" font-size="16" fill="#667eea" text-anchor="middle">수</text>
    <rect x="0" y="50" width="70" height="50" fill="#ffffff" opacity="0.9" rx="4"/>
    <text x="35" y="80" font-family="Arial, sans-serif" font-size="14" fill="#667eea" text-anchor="middle">1교시</text>
    <rect x="80" y="50" width="70" height="50" fill="#4a90e2" rx="4"/>
    <text x="115" y="78" font-family="Arial, sans-serif" font-size="12" fill="#ffffff" text-anchor="middle" font-weight="bold">수학</text>
    <rect x="160" y="50" width="70" height="50" fill="#4a90e2" rx="4"/>
    <text x="195" y="78" font-family="Arial, sans-serif" font-size="12" fill="#ffffff" text-anchor="middle" font-weight="bold">영어</text>
    <rect x="240" y="50" width="70" height="50" fill="#4a90e2" rx="4"/>
    <text x="275" y="78" font-family="Arial, sans-serif" font-size="12" fill="#ffffff" text-anchor="middle" font-weight="bold">과학</text>
    <rect x="0" y="110" width="70" height="50" fill="#ffffff" opacity="0.9" rx="4"/>
    <text x="35" y="140" font-family="Arial, sans-serif" font-size="14" fill="#667eea" text-anchor="middle">2교시</text>
    <rect x="80" y="110" width="70" height="50" fill="#4a90e2" rx="4"/>
    <text x="115" y="138" font-family="Arial, sans-serif" font-size="12" fill="#ffffff" text-anchor="middle" font-weight="bold">국어</text>
    <rect x="160" y="110" width="70" height="50" fill="#4a90e2" rx="4"/>
    <text x="195" y="138" font-family="Arial, sans-serif" font-size="12" fill="#ffffff" text-anchor="middle" font-weight="bold">사회</text>
    <rect x="240" y="110" width="70" height="50" fill="#4a90e2" rx="4"/>
    <text x="275" y="138" font-family="Arial, sans-serif" font-size="12" fill="#ffffff" text-anchor="middle" font-weight="bold">체육</text>
  </g>
  <text x="256" y="450" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#ffffff" text-anchor="middle">시간표 생성기</text>
</svg>`;

// SVG 파일 저장
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent);
console.log('SVG 아이콘 생성 완료: public/icons/icon.svg');
console.log('\nPNG 아이콘을 생성하려면 다음 중 하나를 사용하세요:');
console.log('1. 온라인 변환 도구 사용 (예: https://convertio.co/kr/svg-png/)');
console.log('2. ImageMagick 사용: convert -resize 192x192 icon.svg icon-192.png');
console.log('3. Inkscape 사용: inkscape --export-png=icon-192.png --export-width=192 icon.svg');

