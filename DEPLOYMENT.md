# Vercel 배포 가이드

## 배포 전 체크리스트

### ✅ 완료된 항목
- [x] TypeScript 컴파일 오류 없음
- [x] Lint 오류 없음
- [x] 빌드 성공
- [x] Vercel 설정 파일 생성 (vercel.json)

### ⚠️ 권장 사항

1. **PWA 아이콘 추가**
   - `public/icons/icon-192.png` (192x192 픽셀)
   - `public/icons/icon-512.png` (512x512 픽셀)
   - 아이콘이 없어도 빌드는 성공하지만, PWA 기능이 완전하지 않을 수 있습니다.

2. **구글 애드센스 설정**
   - `index.html`의 `YOUR_PUBLISHER_ID`를 실제 Publisher ID로 변경
   - `src/App.tsx`의 `YOUR_PUBLISHER_ID`와 `YOUR_AD_SLOT_ID`를 실제 값으로 변경

3. **빌드 최적화 (선택사항)**
   - 현재 큰 청크 크기 경고 (868KB)
   - 코드 스플리팅을 통해 개선 가능하지만, 현재 상태로도 배포 가능

## Vercel 배포 방법

### 1. GitHub에 푸시
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Vercel에서 프로젝트 연결
1. [Vercel](https://vercel.com)에 로그인
2. "New Project" 클릭
3. GitHub 저장소 선택
4. 프로젝트 설정:
   - Framework Preset: Vite
   - Build Command: `npm run build` (자동 감지됨)
   - Output Directory: `dist` (자동 감지됨)
   - Install Command: `npm install`

### 3. 환경 변수 (필요시)
- 현재 프로젝트는 환경 변수가 필요하지 않습니다.

### 4. 배포 확인
- 배포 후 자동으로 URL이 생성됩니다.
- PWA 기능이 정상 작동하는지 확인하세요.

## 빌드 정보

- **빌드 명령어**: `npm run build`
- **출력 디렉토리**: `dist`
- **프레임워크**: Vite
- **Node 버전**: 18.x 이상 권장

## 문제 해결

### 빌드 실패 시
1. 로컬에서 `npm run build` 실행하여 오류 확인
2. `node_modules` 삭제 후 `npm install` 재실행
3. Vercel 로그에서 상세 오류 확인

### PWA가 작동하지 않는 경우
1. HTTPS 연결 확인 (PWA는 HTTPS 필수)
2. Service Worker 등록 확인 (브라우저 개발자 도구)
3. Manifest 파일 경로 확인

