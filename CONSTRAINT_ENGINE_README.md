# 제약조건 엔진 (Constraint Engine) 사용 가이드

## 개요

제약조건 엔진은 시간표 생성 과정에서 슬롯 배치의 유효성을 검사하는 모듈입니다.

## 설치 및 사용

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
  maxBeforeLunch: 3,
});

// 슬롯 배치 전 평가
const slot: Slot = {
  classId: 'class_1',
  day: '월',
  period: 1,
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

## 제약조건 목록

### 1. TeacherAvailabilityConstraint
- **우선순위**: Critical
- **설명**: 교사 불가능 시간대에 수업 배정 불가

### 2. TeacherNoOverlapConstraint
- **우선순위**: Critical
- **설명**: 교사가 동일 시간대에 두 반 이상 수업 불가

### 3. ClassNoOverlapConstraint
- **우선순위**: Critical
- **설명**: 한 반이 동일 시간대에 두 과목 이상 수업 불가

### 4. MaxConsecutivePeriodsConstraint
- **우선순위**: High
- **설명**: 교사 연속수업 제한 (기본 3교시)

### 5. MaxDailyLessonForTeacherConstraint
- **우선순위**: High
- **설명**: 교사 하루 최대 수업 수 제한

### 6. LunchBeforeOverloadConstraint
- **우선순위**: Medium
- **설명**: 점심 전 과도한 배치 방지

### 7. ConsecutiveRequiredConstraint
- **우선순위**: High
- **설명**: 연강 필요 과목은 2교시 연속 배치

### 8. MaxPerDayConstraint
- **우선순위**: Medium
- **설명**: 과목 하루 배정 제한 (기본 1회)

### 9. SpecialRoomConflictConstraint
- **우선순위**: High
- **설명**: 특별실 중복 사용 금지

### 10. SpreadDistributionConstraint
- **우선순위**: Low
- **설명**: 고르게 분포

## API 참조

### ConstraintEngine.evaluate(slot, priority?)
슬롯 배치 전 평가

**Parameters:**
- `slot: Slot` - 평가할 슬롯
- `priority?: 'critical' | 'high' | 'medium' | 'low' | 'all'` - 평가할 제약조건 우선순위

**Returns:**
```typescript
{
  satisfied: boolean;
  reason?: string;
  violatedConstraints: string[];
  severity: 'error' | 'warning';
  details?: Record<string, any>;
}
```

### ConstraintEngine.validateTimetable(priority?)
전체 시간표 검증

**Parameters:**
- `priority?: 'critical' | 'high' | 'medium' | 'low' | 'all'`

**Returns:** 동일한 결과 형식

### ConstraintEngine.addConstraint(constraint)
제약조건 추가

### ConstraintEngine.removeConstraint(constraintId)
제약조건 제거 (기본 제약조건은 제거 불가)

### ConstraintEngine.generateReport()
제약조건 리포트 생성

## 예제 코드

자세한 예제는 `src/core/constraints/example.ts` 참조
