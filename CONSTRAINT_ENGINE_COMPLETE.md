# 제약조건 엔진 완성 문서

## ✅ 완료된 작업

### 1. 타입 정의 개선
- ✅ 완전한 타입 정의 (`types.ts`)
- ✅ 하드/소프트 제약조건 구분
- ✅ 특수 프로그램 타입 추가
- ✅ 교실/시설 타입 추가

### 2. 유틸리티 함수 분리
- ✅ `utils.ts` - 재사용 가능한 헬퍼 함수들
- ✅ 단일 책임 원칙 준수
- ✅ 중복 코드 제거

### 3. 제약조건 클래스 구조화
- ✅ `teacher_constraints.ts` - 교사 관련 제약조건 (6개)
- ✅ `class_constraints.ts` - 학급 관련 제약조건 (2개)
- ✅ `subject_constraints.ts` - 과목 관련 제약조건 (4개)
- ✅ `facility_constraints.ts` - 시설 관련 제약조건 (1개)
- ✅ `special_programs_constraints.ts` - 특수 프로그램 제약조건 (2개)
- ✅ `soft_constraints.ts` - 소프트 제약조건 (4개)

### 4. ConstraintEngine 개선
- ✅ 하드/소프트 제약조건 분리 관리
- ✅ 에러 핸들링 강화
- ✅ 상세한 리포트 생성
- ✅ 데이터 업데이트 지원

## 📁 파일 구조

```
src/core/constraints/
├── types.ts                          # 타입 정의
├── utils.ts                          # 유틸리티 함수
├── BaseConstraint.ts                 # 기본 클래스 및 인터페이스
├── teacher_constraints.ts            # 교사 제약조건 (6개)
├── class_constraints.ts              # 학급 제약조건 (2개)
├── subject_constraints.ts            # 과목 제약조건 (4개)
├── facility_constraints.ts           # 시설 제약조건 (1개)
├── special_programs_constraints.ts   # 특수 프로그램 제약조건 (2개)
├── soft_constraints.ts               # 소프트 제약조건 (4개)
├── ConstraintEngine.ts               # 통합 엔진
├── index.ts                          # Export
└── example.ts                        # 사용 예제
```

## 🎯 구현된 제약조건

### 하드 제약조건 (15개)

#### 교사 관련 (6개)
1. **TeacherAvailabilityConstraint** - 교사 불가시간
2. **TeacherNoOverlapConstraint** - 교사 중복 수업 금지
3. **TeacherConsecutiveLimitConstraint** - 교사 연속수업 제한 (3교시 이상 금지)
4. **TeacherDailyLimitConstraint** - 교사 하루 최대 수업 수
5. **TeacherWeeklyHoursConstraint** - 교사 주당 시수 충족
6. **LunchBeforeOverloadConstraint** - 점심 전 과도한 배치 방지

#### 학급 관련 (2개)
7. **ClassNoOverlapConstraint** - 반 중복 수업 금지
8. **GradeCommonTimeConstraint** - 학년별 공통 시간대

#### 과목 관련 (4개)
9. **SubjectWeeklyHoursConstraint** - 과목 주당 시수 충족
10. **SubjectMaxPerDayConstraint** - 과목 하루 배정 제한
11. **SubjectFixedTimeConstraint** - 과목 고정 시간
12. **ConsecutiveRequiredConstraint** - 연강 필요 과목

#### 시설 관련 (1개)
13. **SpecialRoomConflictConstraint** - 특별실 중복 사용 금지

#### 특수 프로그램 관련 (2개)
14. **CoTeachingConstraint** - 공동수업
15. **LevelBasedTeachingConstraint** - 수준별 이동수업

### 소프트 제약조건 (4개)
1. **MinimizeConsecutiveConstraint** - 교사 연속 수업 최소화
2. **BalancedDistributionConstraint** - 과목 균형 배치
3. **MorningAfternoonBalanceConstraint** - 오전/오후 균형
4. **StudentFatigueConstraint** - 학생 피로도 고려

## 🚀 사용 방법

### 기본 사용

```typescript
import { ConstraintEngine } from '@/core/constraints/ConstraintEngine';
import { TimetableData, Slot } from '@/core/constraints/types';

// 데이터 준비
const data: TimetableData = {
  // ... 시간표 데이터
};

// 엔진 생성
const engine = new ConstraintEngine(data, {
  maxConsecutivePeriods: 3,
  lunchPeriod: 4,
  maxBeforeLunch: 2,
  enableSoftConstraints: true,
});

// 슬롯 배치 전 평가
const slot: Slot = {
  classId: 'class_1',
  day: '월',
  period: 2,
  subjectId: 'math',
  teacherId: 'teacher_1',
};

const result = engine.evaluate(slot);

if (result.satisfied) {
  console.log('✅ 배치 가능');
} else {
  console.log('❌ 배치 불가:', result.reason);
  console.log('위반 제약:', result.violatedConstraints);
}
```

### 전체 시간표 검증

```typescript
const validationResult = engine.validateTimetable();

if (!validationResult.satisfied) {
  console.log('위반 사항:', validationResult.details?.allViolations);
}
```

### 소프트 제약조건 점수 계산

```typescript
const softScore = engine.calculateSoftScore();
console.log(`소프트 제약조건 점수: ${softScore} (낮을수록 좋음)`);
```

### 리포트 생성

```typescript
const report = engine.generateReport();
console.log('제약조건 수:', report.totalHardConstraints);
console.log('검증 결과:', report.validationResult.satisfied);
console.log('소프트 점수:', report.softScore);
```

## 🔧 주요 개선 사항

### 1. 가독성 극대화
- ✅ 명확한 파일 분리 (카테고리별)
- ✅ 일관된 네이밍
- ✅ 상세한 주석

### 2. 중복 최소화
- ✅ 공통 유틸리티 함수 분리
- ✅ BaseConstraint 헬퍼 메서드 활용
- ✅ 재사용 가능한 패턴

### 3. 단일 책임 원칙
- ✅ 각 제약조건 클래스는 하나의 책임만
- ✅ 유틸리티 함수는 단일 기능만 수행
- ✅ ConstraintEngine은 조정만 담당

### 4. 불필요한 연산 제거
- ✅ 조기 반환 (Early Return)
- ✅ 조건부 검사 최적화
- ✅ 캐싱 가능한 값 재사용

### 5. 에러 핸들링 강화
- ✅ 데이터 검증 헬퍼
- ✅ 상세한 에러 메시지
- ✅ 위반 사항 상세 정보 제공

### 6. 확장성 높은 구조
- ✅ 인터페이스 기반 설계
- ✅ 제약조건 추가/제거 용이
- ✅ 설정 기반 동작

## 📊 성능 특징

- **빠른 평가**: Critical 제약조건 위반 시 즉시 반환
- **우선순위 기반**: 중요도 순으로 검사
- **메모리 효율**: Map 기반 제약조건 관리
- **확장 가능**: 새로운 제약조건 추가 용이

## 🧪 테스트 가능성

- ✅ 순수 함수로 구성 (부작용 최소화)
- ✅ 명확한 입력/출력
- ✅ 단위 테스트 용이
- ✅ 예제 코드 제공

## 📝 다음 단계

1. 실제 시간표 생성 알고리즘과 통합
2. 성능 테스트 및 최적화
3. 추가 제약조건 구현 (필요 시)
4. 문서화 보완
