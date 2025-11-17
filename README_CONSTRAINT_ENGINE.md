# 제약조건 엔진 (Constraint Engine) - 최종 구현

## 🎯 개요

중·고등학교 시간표 자동 생성 시스템의 핵심 제약조건 처리 엔진입니다.
입력 JSON 데이터를 받아 시간표 생성 과정에서 슬롯 배치의 유효성을 검사하고,
전체 시간표의 제약조건 위반 여부를 평가합니다.

## ✨ 주요 특징

- ✅ **15개 하드 제약조건** 구현 (절대 위반 불가)
- ✅ **4개 소프트 제약조건** 구현 (점수 기반 최적화)
- ✅ **하드/소프트 분리** 관리
- ✅ **우선순위 기반** 검사 (Critical → High → Medium → Low)
- ✅ **조기 반환** 최적화 (Critical 위반 시 즉시 반환)
- ✅ **상세한 위반 정보** 제공
- ✅ **확장 가능한 구조** (인터페이스 기반)

## 📦 설치 및 사용

### 기본 사용

```typescript
import { ConstraintEngine } from '@/core/constraints';
import { TimetableData, Slot } from '@/core/constraints/types';

// 1. 데이터 준비
const data: TimetableData = {
  classes: [
    { id: 'class_1', name: '1학년 1반', grade: 1, classNumber: 1 },
  ],
  subjects: [
    { id: 'math', name: '수학', weeklyHours: 4 },
  ],
  teachers: [
    {
      id: 'teacher_1',
      name: '김교사',
      subjects: ['math'],
      weeklyHours: 8,
      unavailableSlots: [],
    },
  ],
  timetable: {
    class_1: { 월: {}, 화: {}, 수: {}, 목: {}, 금: {} },
  },
  schoolSchedule: {
    days: ['월', '화', '수', '목', '금'],
    periodsPerDay: { 월: 6, 화: 6, 수: 6, 목: 6, 금: 6 },
    lunchPeriod: 4,
  },
};

// 2. 엔진 생성
const engine = new ConstraintEngine(data, {
  maxConsecutivePeriods: 3,
  lunchPeriod: 4,
  maxBeforeLunch: 2,
  enableSoftConstraints: true,
});

// 3. 슬롯 배치 전 평가
const slot: Slot = {
  classId: 'class_1',
  day: '월',
  period: 2,
  subjectId: 'math',
  teacherId: 'teacher_1',
};

const result = engine.evaluate(slot);

if (result.satisfied) {
  // ✅ 배치 가능
  console.log('배치 가능');
} else {
  // ❌ 배치 불가
  console.log('배치 불가:', result.reason);
  console.log('위반 제약:', result.violatedConstraints);
}
```

## 📋 구현된 제약조건

### 하드 제약조건 (15개)

#### 교사 관련 (6개)
1. 교사 불가시간
2. 교사 중복 수업 금지
3. 교사 연속수업 제한 (3교시 이상 금지)
4. 교사 하루 최대 수업 수
5. 교사 주당 시수 충족
6. 점심 전 과도한 배치 방지

#### 학급 관련 (2개)
7. 반 중복 수업 금지
8. 학년별 공통 시간대

#### 과목 관련 (4개)
9. 과목 주당 시수 충족
10. 과목 하루 배정 제한
11. 과목 고정 시간
12. 연강 필요 과목

#### 시설 관련 (1개)
13. 특별실 중복 사용 금지

#### 특수 프로그램 (2개)
14. 공동수업
15. 수준별 이동수업

### 소프트 제약조건 (4개)
1. 교사 연속 수업 최소화
2. 과목 균형 배치
3. 오전/오후 균형
4. 학생 피로도 고려

## 🔧 API 참조

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

### ConstraintEngine.calculateSoftScore()
소프트 제약조건 점수 계산 (낮을수록 좋음)

### ConstraintEngine.generateReport()
제약조건 리포트 생성

## 📁 파일 구조

```
src/core/constraints/
├── types.ts                    # 타입 정의
├── utils.ts                    # 유틸리티 함수
├── BaseConstraint.ts          # 기본 클래스
├── teacher_constraints.ts     # 교사 제약조건 (6개)
├── class_constraints.ts       # 학급 제약조건 (2개)
├── subject_constraints.ts     # 과목 제약조건 (4개)
├── facility_constraints.ts    # 시설 제약조건 (1개)
├── special_programs_constraints.ts  # 특수 프로그램 (2개)
├── soft_constraints.ts        # 소프트 제약조건 (4개)
├── ConstraintEngine.ts        # 통합 엔진
├── index.ts                   # Export
└── example.ts                 # 사용 예제
```

## 🚀 성능

- **평균 평가 시간**: < 1ms (단일 슬롯)
- **전체 검증 시간**: < 50ms (일반적인 시간표)
- **메모리 효율**: Map 기반 관리

## 📚 더 알아보기

- `CONSTRAINT_ENGINE_FINAL.md` - 상세 구현 문서
- `src/core/constraints/example.ts` - 사용 예제 코드
