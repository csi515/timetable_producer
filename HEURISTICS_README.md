# 휴리스틱 최적화 모듈 사용 가이드

## 개요

휴리스틱 엔진은 CSP 백트래킹 알고리즘의 성능을 향상시키기 위한 전략 모듈입니다.

## 설치 및 사용

```typescript
import { HeuristicEngine } from '@/core/heuristics/HeuristicEngine';
import { ConstraintEngine } from '@/core/constraints/ConstraintEngine';
import { TimetableData, TimetableState } from '@/core/heuristics/types';

// 제약조건 엔진 생성
const constraintEngine = new ConstraintEngine(data);

// 휴리스틱 엔진 생성
const heuristicEngine = new HeuristicEngine(constraintEngine, {
  variableSelection: 'combined', // 'mrv' | 'degree' | 'dynamic' | 'combined'
  valueOrdering: 'lcv', // 'lcv' | 'default'
  useForwardChecking: true,
  useSoftScoring: true,
  useRandomizedRestart: true,
  restartConfig: {
    maxDepth: 50,
    maxRestarts: 3,
  },
});

// 변수 선택
const variable = heuristicEngine.pickNextVariable(data, state);

// 도메인 값 정렬
const orderedValues = heuristicEngine.orderDomainValues(variable, data, state);

// Forward Checking
const fcResult = heuristicEngine.propagate(assignment, data, state);
if (fcResult) {
  state.domains = fcResult.updatedDomains;
}

// 부분 해 점수 계산
const score = heuristicEngine.scorePartialSolution(data, state);
```

## 휴리스틱 전략

### 1. MRV (Minimum Remaining Values)
- 도메인 크기가 가장 작은 변수 우선 선택
- 파일: `src/core/heuristics/MRV.ts`

### 2. LCV (Least Constraining Value)
- 다른 변수들의 도메인에 영향을 최소화하는 값 우선
- 파일: `src/core/heuristics/LCV.ts`

### 3. Degree Heuristic
- 충돌 가능성이 높은 변수 우선 선택
- 파일: `src/core/heuristics/Degree.ts`

### 4. Forward Checking
- 값 배정 시 미래 변수들의 도메인 축소
- 파일: `src/core/heuristics/ForwardChecking.ts`

### 5. Soft Constraint Scoring
- 소프트 제약조건 위반에 대한 페널티 점수 계산
- 파일: `src/core/heuristics/SoftConstraintScoring.ts`

### 6. Dynamic Ordering
- 실시간으로 도메인 크기 재계산하여 순서 조정
- 파일: `src/core/heuristics/DynamicOrdering.ts`

### 7. Randomized Restart
- 일정 깊이 이상 탐색 실패 시 랜덤 재시작
- 파일: `src/core/heuristics/RandomizedRestart.ts`

## 성능 비교

예제 코드 실행:
```bash
npm run example:heuristics
```

결과 예시:
```
기본 (MRV만):
  평균 시간: 125.50ms
  평균 반복: 245.3회
  성공률: 60.0%

MRV + Forward Checking:
  평균 시간: 98.20ms
  평균 반복: 180.5회
  성공률: 80.0%

Combined + 모든 최적화:
  평균 시간: 75.30ms
  평균 반복: 120.2회
  성공률: 95.0%
```

## 설정 옵션

### variableSelection
- `'mrv'`: MRV만 사용
- `'degree'`: Degree만 사용
- `'dynamic'`: Dynamic Ordering 사용
- `'combined'`: MRV + Degree 결합

### valueOrdering
- `'default'`: 기본 순서
- `'lcv'`: LCV 휴리스틱 사용

### useForwardChecking
- `true`: Forward Checking 활성화
- `false`: 비활성화

### useSoftScoring
- `true`: 소프트 제약조건 점수 계산
- `false`: 비활성화

### useRandomizedRestart
- `true`: 랜덤 재시작 활성화
- `false`: 비활성화

## 예제 코드

자세한 예제는 `src/core/heuristics/example.ts` 참조
