# 🎓 시간표 자동 생성 시스템

중·고등학교용 시간표 자동 생성 웹서비스

## 🧱 기술 스택

- **Frontend**: Next.js 16 + TypeScript + React 19
- **UI**: TailwindCSS + shadcn/ui
- **알고리즘**: TypeScript 기반 제약조건 엔진
- **데이터 저장**: LocalStorage + JSON 파일 Export/Import
- **결제**: Toss Payments 또는 이니시스 (시뮬레이션)

## 🚀 시작하기

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

### 프로덕션 빌드

```bash
npm run build
npm start
```

## 📁 프로젝트 구조

```
src/
├── app/                    # Next.js App Router
│   ├── pay/               # 결제 페이지
│   ├── editor/            # 데이터 입력 페이지
│   ├── generator/         # 시간표 생성 페이지
│   ├── result/            # 결과 보고서 페이지
│   ├── layout.tsx         # 루트 레이아웃
│   └── page.tsx           # 홈 페이지
├── components/             # React 컴포넌트
│   ├── BasicSettings.js   # 기본 설정
│   ├── SubjectSettings.js # 과목 설정
│   ├── TeacherSettings.js # 교사 설정
│   ├── ConstraintSettings.js # 제약조건 설정
│   ├── FixedClassSettings.js # 고정 수업 설정
│   └── ...
├── core/                   # 핵심 알고리즘
│   ├── scheduler.ts        # 기본 배치 엔진
│   ├── optimizedScheduler.ts # 우선순위 배치 + 완화 전략
│   ├── constraints/       # 제약조건 엔진
│   │   ├── critical.ts    # Critical 제약조건
│   │   ├── high.ts        # High 제약조건
│   │   ├── medium.ts      # Medium 제약조건
│   │   ├── low.ts         # Low 제약조건
│   │   └── types.ts       # 타입 정의
│   └── ...
├── types/                  # TypeScript 타입 정의
├── lib/                    # 유틸리티 함수
└── styles/                 # 전역 스타일
```

## 🧩 주요 기능

### 1. 결제 시스템
- 결제 완료 시 세션 토큰 발급
- localStorage 기반 접근 제어
- 결제 여부 확인 후 페이지 접근 허용

### 2. 데이터 입력 페이지
- **기본 설정**: 학년, 학급, 교시 설정
- **과목 설정**: 과목별 시수 및 제약조건
- **교사 설정**: 교사별 담당 과목 및 시간 불가능 설정
- **제약조건 설정**: Critical, High, Medium, Low 우선순위 제약조건
- **고정 수업**: 특정 시간에 고정할 수업 설정

### 3. JSON 기반 저장/불러오기
- 현재 설정을 JSON 파일로 다운로드
- JSON 파일 업로드하여 설정 복원
- LocalStorage 자동 저장 기능

### 4. 최적화된 스케줄 생성 엔진
- 우선순위 기반 배치 알고리즘
- 점진적 제약조건 완화 전략
- 연속교시 검사, 교사 피로도 검사
- 블록 수업, 공동수업 처리

### 5. 생성 후 리포트 표시
- 성공 여부 표시
- 제약조건 위반 카운트 (Critical/High/Medium/Low)
- 상세 로그 출력

## 🔧 제약조건 우선순위

### Critical (절대 위반 불가)
- 교사 중복 배정 불가
- 교사 불가능 시간 배정 불가
- 교사 상호 배제 관계 위반 불가

### High (높은 우선순위)
- 특별실 중복 사용 금지
- 시수 초과/부족 방지
- 일일 동일 과목 중복 수업 방지

### Medium (중간 우선순위)
- 공동수업 슬롯 충족
- 블록수업 배치
- 연속 3교시 이상 금지 규칙

### Low (낮은 우선순위)
- 점심시간 전 특정 교사에게 몰리는 패턴 방지
- 선호 시간대 반영
- 학년별 순차 수업 조건

## 📝 사용 방법

1. **결제**: `/pay` 페이지에서 결제 완료
2. **데이터 입력**: `/editor` 페이지에서 단계별로 데이터 입력
3. **시간표 생성**: `/generator` 페이지에서 시간표 생성
4. **결과 확인**: `/result` 페이지에서 생성된 시간표 확인 및 내보내기

## 🔐 접근 제어

결제 완료 시 localStorage에 `paid: true`와 `session_token`이 저장됩니다.
각 페이지는 이 값을 확인하여 접근을 제어합니다.

## 📄 라이선스

MIT
