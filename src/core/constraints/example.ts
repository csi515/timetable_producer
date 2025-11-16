// 제약조건 엔진 사용 예제

import { ConstraintEngine } from './ConstraintEngine';
import { TimetableData, Slot, Day } from './types';

// 예제 데이터 생성
function createExampleData(): TimetableData {
  return {
    classes: [
      { id: 'class_1', name: '1학년 1반', grade: 1, classNumber: 1 },
      { id: 'class_2', name: '1학년 2반', grade: 1, classNumber: 2 },
    ],
    subjects: [
      { id: 'math', name: '수학', maxPerDay: 1 },
      { id: 'pe', name: '체육', requiresConsecutive: true },
      { id: 'science', name: '과학', requiresSpecialRoom: true, specialRoomType: '실험실' },
    ],
    teachers: [
      {
        id: 'teacher_1',
        name: '김교사',
        subjects: ['math'],
        weeklyHours: 5,
        maxHoursPerDay: 3,
        unavailableSlots: [{ day: '월', period: 1 }],
      },
      {
        id: 'teacher_2',
        name: '이교사',
        subjects: ['pe'],
        weeklyHours: 4,
        unavailableSlots: [],
      },
    ],
    timetable: {
      class_1: {
        월: {},
        화: {},
        수: {},
        목: {},
        금: {},
      },
      class_2: {
        월: {},
        화: {},
        수: {},
        목: {},
        금: {},
      },
    },
    schoolSchedule: {
      days: ['월', '화', '수', '목', '금'],
      periodsPerDay: {
        월: 6,
        화: 6,
        수: 6,
        목: 6,
        금: 6,
      },
      lunchPeriod: 4,
    },
  };
}

// 예제 실행
export function runConstraintEngineExample() {
  console.log('=== 제약조건 엔진 예제 ===\n');

  const data = createExampleData();
  const engine = new ConstraintEngine(data, {
    maxConsecutivePeriods: 3,
    lunchPeriod: 4,
    maxBeforeLunch: 3,
  });

  // 1. 제약조건 목록 확인
  console.log('1. 등록된 제약조건:');
  const constraints = engine.getConstraints();
  constraints.forEach(c => {
    console.log(`   - ${c.metadata.name} (${c.metadata.priority})`);
  });
  console.log();

  // 2. 유효한 슬롯 배치 테스트
  console.log('2. 유효한 슬롯 배치 테스트:');
  const validSlot: Slot = {
    classId: 'class_1',
    day: '월',
    period: 2,
    subjectId: 'math',
    teacherId: 'teacher_1',
  };

  const validResult = engine.evaluate(validSlot);
  console.log(`   결과: ${validResult.satisfied ? '✅ 통과' : '❌ 실패'}`);
  if (!validResult.satisfied) {
    console.log(`   이유: ${validResult.reason}`);
    console.log(`   위반 제약: ${validResult.violatedConstraints.join(', ')}`);
  }
  console.log();

  // 3. 교사 불가능 시간 위반 테스트
  console.log('3. 교사 불가능 시간 위반 테스트:');
  const invalidSlot: Slot = {
    classId: 'class_1',
    day: '월',
    period: 1, // 김교사의 불가능 시간
    subjectId: 'math',
    teacherId: 'teacher_1',
  };

  const invalidResult = engine.evaluate(invalidSlot);
  console.log(`   결과: ${invalidResult.satisfied ? '✅ 통과' : '❌ 실패'}`);
  if (!invalidResult.satisfied) {
    console.log(`   이유: ${invalidResult.reason}`);
    console.log(`   위반 제약: ${invalidResult.violatedConstraints.join(', ')}`);
    if (invalidResult.details) {
      console.log(`   상세:`, invalidResult.details);
    }
  }
  console.log();

  // 4. 교사 중복 배정 테스트
  console.log('4. 교사 중복 배정 테스트:');
  // 먼저 한 곳에 배정
  data.timetable.class_1.월[2] = {
    classId: 'class_1',
    day: '월',
    period: 2,
    subjectId: 'math',
    teacherId: 'teacher_1',
  };

  // 같은 시간에 다른 반에도 배정 시도
  const overlapSlot: Slot = {
    classId: 'class_2',
    day: '월',
    period: 2,
    subjectId: 'math',
    teacherId: 'teacher_1',
  };

  const overlapResult = engine.evaluate(overlapSlot);
  console.log(`   결과: ${overlapResult.satisfied ? '✅ 통과' : '❌ 실패'}`);
  if (!overlapResult.satisfied) {
    console.log(`   이유: ${overlapResult.reason}`);
  }
  console.log();

  // 5. 전체 시간표 검증
  console.log('5. 전체 시간표 검증:');
  const validationResult = engine.validateTimetable();
  console.log(`   결과: ${validationResult.satisfied ? '✅ 통과' : '❌ 실패'}`);
  if (!validationResult.satisfied) {
    console.log(`   위반 제약: ${validationResult.violatedConstraints.length}개`);
    if (validationResult.details?.allViolations) {
      validationResult.details.allViolations.forEach((v: string, i: number) => {
        console.log(`   ${i + 1}. ${v}`);
      });
    }
  }
  console.log();

  // 6. 리포트 생성
  console.log('6. 제약조건 리포트:');
  const report = engine.generateReport();
  console.log(`   총 제약조건 수: ${report.totalConstraints}`);
  console.log(`   검증 결과: ${report.validationResult.satisfied ? '✅ 통과' : '❌ 실패'}`);
  console.log();

  return {
    engine,
    data,
    results: {
      validResult,
      invalidResult,
      overlapResult,
      validationResult,
    },
  };
}

// 실행 (Node.js 환경에서)
if (typeof window === 'undefined') {
  runConstraintEngineExample();
}
