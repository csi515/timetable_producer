// 제약조건 엔진 사용 예제

import { ConstraintEngine } from './ConstraintEngine';
import { TimetableData, Slot, Day } from './types';

/**
 * 예제 데이터 생성
 */
function createExampleData(): TimetableData {
  return {
    classes: [
      { id: 'class_1_1', name: '1학년 1반', grade: 1, classNumber: 1 },
      { id: 'class_1_2', name: '1학년 2반', grade: 1, classNumber: 2 },
      { id: 'class_2_1', name: '2학년 1반', grade: 2, classNumber: 1 },
    ],
    subjects: [
      {
        id: 'math',
        name: '수학',
        weeklyHours: 4,
        maxPerDay: 1,
        preferredPeriods: [1, 2], // 집중 과목
      },
      {
        id: 'pe',
        name: '체육',
        weeklyHours: 2,
        requiresConsecutive: true,
        consecutivePeriods: 2,
        preferredPeriods: [5, 6], // 예체능
      },
      {
        id: 'science',
        name: '과학',
        weeklyHours: 3,
        requiresSpecialRoom: true,
        specialRoomType: '실험실',
      },
      {
        id: 'korean',
        name: '국어',
        weeklyHours: 4,
        preferredPeriods: [1, 2], // 집중 과목
      },
    ],
    teachers: [
      {
        id: 'teacher_math_1',
        name: '김수학',
        subjects: ['math'],
        weeklyHours: 8,
        maxHoursPerDay: 3,
        unavailableSlots: [{ day: '월', period: 1 }], // 월요일 1교시 불가
      },
      {
        id: 'teacher_pe_1',
        name: '이체육',
        subjects: ['pe'],
        weeklyHours: 6,
        unavailableSlots: [],
      },
      {
        id: 'teacher_science_1',
        name: '박과학',
        subjects: ['science'],
        weeklyHours: 9,
        unavailableSlots: [],
      },
      {
        id: 'teacher_korean_1',
        name: '최국어',
        subjects: ['korean'],
        weeklyHours: 8,
        unavailableSlots: [],
      },
    ],
    rooms: [
      { id: 'room_lab_1', name: '실험실 1', type: 'lab', capacity: 30 },
      { id: 'room_regular_1', name: '일반교실 1', type: 'regular', capacity: 35 },
    ],
    specialPrograms: [
      {
        id: 'creative_grade_1',
        name: '창의적 체험활동',
        type: 'creative',
        grade: 1,
        classes: ['class_1_1', 'class_1_2'],
        teachers: [],
        weeklyFrequency: 1,
        fixedDay: '수',
        fixedPeriod: 6,
      },
    ],
    timetable: {
      class_1_1: {
        월: {},
        화: {},
        수: {},
        목: {},
        금: {},
      },
      class_1_2: {
        월: {},
        화: {},
        수: {},
        목: {},
        금: {},
      },
      class_2_1: {
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

/**
 * 예제 실행 함수
 */
export function runConstraintEngineExample() {
  console.log('=== 제약조건 엔진 예제 ===\n');

  const data = createExampleData();
  const engine = new ConstraintEngine(data, {
    maxConsecutivePeriods: 3,
    lunchPeriod: 4,
    maxBeforeLunch: 2,
    enableSoftConstraints: true,
  });

  // 1. 제약조건 목록 확인
  console.log('1. 등록된 제약조건:');
  const { hard, soft } = engine.getConstraints();
  console.log(`   하드 제약조건: ${hard.length}개`);
  hard.forEach(c => {
    console.log(`     - ${c.metadata.name} (${c.metadata.priority})`);
  });
  console.log(`   소프트 제약조건: ${soft.length}개`);
  soft.forEach(c => {
    console.log(`     - ${c.metadata.name}`);
  });
  console.log();

  // 2. 유효한 슬롯 배치 테스트
  console.log('2. 유효한 슬롯 배치 테스트:');
  const validSlot: Slot = {
    classId: 'class_1_1',
    day: '월',
    period: 2,
    subjectId: 'math',
    teacherId: 'teacher_math_1',
    roomId: 'room_regular_1',
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
    classId: 'class_1_1',
    day: '월',
    period: 1, // 김수학 교사의 불가능 시간
    subjectId: 'math',
    teacherId: 'teacher_math_1',
    roomId: 'room_regular_1',
  };

  const invalidResult = engine.evaluate(invalidSlot);
  console.log(`   결과: ${invalidResult.satisfied ? '✅ 통과' : '❌ 실패'}`);
  if (!invalidResult.satisfied) {
    console.log(`   이유: ${invalidResult.reason}`);
    console.log(`   위반 제약: ${invalidResult.violatedConstraints.join(', ')}`);
    if (invalidResult.details) {
      const detail = invalidResult.details['teacher_availability'];
      if (detail) {
        console.log(`   상세: ${detail.reason}`);
      }
    }
  }
  console.log();

  // 4. 교사 중복 배정 테스트
  console.log('4. 교사 중복 배정 테스트:');
  // 먼저 한 곳에 배정
  data.timetable.class_1_1.월[2] = {
    classId: 'class_1_1',
    day: '월',
    period: 2,
    subjectId: 'math',
    teacherId: 'teacher_math_1',
    roomId: 'room_regular_1',
  };

  // 같은 시간에 다른 반에도 배정 시도
  const overlapSlot: Slot = {
    classId: 'class_1_2',
    day: '월',
    period: 2,
    subjectId: 'math',
    teacherId: 'teacher_math_1', // 같은 교사
    roomId: 'room_regular_1',
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
        console.log(`     ${i + 1}. ${v}`);
      });
    }
  }
  console.log();

  // 6. 소프트 제약조건 점수 계산
  console.log('6. 소프트 제약조건 점수:');
  const softScore = engine.calculateSoftScore();
  console.log(`   총 점수: ${softScore} (낮을수록 좋음)`);
  console.log();

  // 7. 리포트 생성
  console.log('7. 제약조건 리포트:');
  const report = engine.generateReport();
  console.log(`   하드 제약조건 수: ${report.totalHardConstraints}`);
  console.log(`   소프트 제약조건 수: ${report.totalSoftConstraints}`);
  console.log(`   검증 결과: ${report.validationResult.satisfied ? '✅ 통과' : '❌ 실패'}`);
  console.log(`   소프트 점수: ${report.softScore}`);
  console.log();

  return {
    engine,
    data,
    results: {
      validResult,
      invalidResult,
      overlapResult,
      validationResult,
      softScore,
    },
  };
}

// 실행 (Node.js 환경에서)
if (typeof window === 'undefined') {
  runConstraintEngineExample();
}
