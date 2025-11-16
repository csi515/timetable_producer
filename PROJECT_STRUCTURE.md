# 프로젝트 구조 요약

## 완료된 작업

### ✅ Next.js 마이그레이션
- Next.js 16 App Router 구조로 전환
- TypeScript 설정 완료
- shadcn/ui 설정 완료

### ✅ 페이지 구조
- `/pay` - 결제 페이지 (세션 토큰 발급)
- `/editor` - 데이터 입력 페이지 (6단계)
- `/generator` - 시간표 생성 페이지
- `/result` - 결과 보고서 페이지

### ✅ 제약조건 엔진 재구성
- `critical.ts` - Critical 제약조건 (교사 중복, 불가능 시간 등)
- `high.ts` - High 제약조건 (특별실, 시수 제한 등)
- `medium.ts` - Medium 제약조건 (공동수업, 블록수업 등)
- `low.ts` - Low 제약조건 (선호도, 패턴 방지 등)

### ✅ 기능 구현
- JSON Export/Import 기능
- LocalStorage 자동 저장
- 결제 세션 토큰 기반 접근 제어
- 점진적 제약조건 완화 알고리즘

## 사용 방법

1. **개발 서버 실행**
   ```bash
   npm run dev
   ```

2. **결제 페이지 접근**
   - http://localhost:3000/pay
   - 결제 완료 시 localStorage에 세션 토큰 저장

3. **데이터 입력**
   - http://localhost:3000/editor
   - 6단계로 나뉜 입력 프로세스
   - JSON Export/Import 버튼 상단 고정

4. **시간표 생성**
   - http://localhost:3000/generator
   - 우선순위 기반 생성 알고리즘
   - 점진적 제약조건 완화

5. **결과 확인**
   - http://localhost:3000/result
   - 생성된 시간표 확인 및 내보내기

## 주요 파일 위치

- **페이지**: `src/app/`
- **컴포넌트**: `src/components/`
- **알고리즘**: `src/core/`
- **타입 정의**: `src/types/`
- **유틸리티**: `src/lib/`, `src/utils/`

## 다음 단계 (선택사항)

1. 실제 결제 API 통합 (Toss Payments 또는 이니시스)
2. 추가 shadcn/ui 컴포넌트 설치 및 사용
3. 성능 최적화
4. 테스트 코드 작성
