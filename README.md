# 중고등학교 시간표 자동 생성 시스템

중고등학교 시간표를 자동으로 생성하는 웹/PWA 프로그램입니다. CSP(Constraint Satisfaction Problem) 기반 알고리즘을 사용하여 복잡한 제약조건을 고려한 최적화된 시간표를 생성합니다.

## 주요 기능

- 📅 자동 시간표 생성 (CSP 알고리즘 기반)
- 🎯 복잡한 제약조건 처리 (Critical/High/Medium/Low)
- 👥 공동수업, 블록 수업, 외부 강사 지원
- 🏫 특별실 배정 및 충돌 방지
- 📊 학급별/교사별/특별실별 시간표 뷰
- 📤 PDF/Excel 내보내기
- 💾 IndexedDB를 통한 로컬 저장
- 📱 PWA 지원 (오프라인 사용 가능)
- 💰 구글 애드센스 광고 연동

## 기술 스택

- **프론트엔드**: React 18 + TypeScript
- **상태 관리**: Zustand
- **빌드 도구**: Vite
- **PWA**: Vite PWA Plugin
- **PDF 내보내기**: jsPDF + jspdf-autotable
- **Excel 내보내기**: xlsx
- **저장소**: IndexedDB

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

### 3. 프로덕션 빌드

```bash
npm run build
```

### 4. 빌드 결과 미리보기

```bash
npm run preview
```

## 사용 방법

### 1. 기본 설정

1. **시간표 기본 설정**: 학년, 학급 수, 요일, 최대 교시 수 등을 설정합니다.
2. **과목 설정**: 각 과목의 주간 시수, 특별실 필요 여부, 블록 수업 여부 등을 설정합니다.
3. **교사 설정**: 교사명, 담당 과목, 불가능한 시간, 우선 배치 여부 등을 설정합니다.

### 2. 시간표 생성

1. 모든 정보를 입력한 후 "시간표 생성" 버튼을 클릭합니다.
2. 구글 애드센스 광고가 표시됩니다 (설정된 경우).
3. 광고 시청 후 시간표가 자동으로 생성됩니다.

### 3. 결과 확인

- 생성된 시간표는 학급별로 표시됩니다.
- 제약조건 위반 사항은 Critical/High/Medium/Low로 구분되어 표시됩니다.
- PDF 또는 Excel 형식으로 내보낼 수 있습니다.

## 제약조건 시스템

### Critical (치명적)
- 교사 중복 방지
- 교사 불가능 시간 체크
- 특별실 충돌 방지
- 블록 수업 연속 시간 보장

### High (높음)
- 시수 충족 검증
- 우선 배치 교사 일정 충돌
- 외부 강사 하루 몰아넣기

### Medium (중간)
- 연속 3교시 이상 금지
- 점심 전 몰빵 방지

### Low (낮음)
- 선호 패턴 반영
- 이동 최소화

## 우선 배치 순서

시간표 생성 시 다음 순서로 우선 배치됩니다:

1. 공동수업 (여러 교사 동시 필요)
2. 블록 수업 (3~4교시 연속)
3. 특별실 필요 수업
4. 외부 강사 (하루 몰아서 배치)
5. 우선 배치 교사
6. 일반 과목

## 구글 애드센스 설정

1. [Google AdSense](https://www.google.com/adsense/)에서 계정을 생성하고 승인을 받습니다.
2. `index.html`과 `src/App.tsx`에서 `YOUR_PUBLISHER_ID`와 `YOUR_AD_SLOT_ID`를 실제 값으로 변경합니다.

## 프로젝트 구조

```
src/
├── components/          # React 컴포넌트
│   ├── Input/          # 입력 폼 컴포넌트
│   ├── Timetable/      # 시간표 표시 컴포넌트
│   ├── Constraints/    # 제약조건 설정 UI
│   └── Export/         # 내보내기 UI
├── core/               # 핵심 알고리즘
│   ├── scheduler.ts           # 메인 스케줄러
│   ├── cspSolver.ts           # CSP 기반 해결
│   ├── constraints.ts         # 제약조건 정의
│   ├── constraintValidator.ts # 제약조건 검증
│   └── optimizer.ts           # Soft constraint 최적화
├── types/              # TypeScript 타입 정의
├── utils/              # 유틸리티 함수
│   ├── export.ts      # PDF/Excel 내보내기
│   └── storage.ts     # IndexedDB 저장
├── hooks/              # 커스텀 훅
├── store/              # Zustand 상태 관리
├── App.tsx
└── main.tsx
```

## 라이선스

MIT
