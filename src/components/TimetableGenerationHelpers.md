# TimetableGenerationHelpers API 문서

## 개요
시간표 생성에 필요한 헬퍼 함수들을 제공하는 모듈입니다.

## 함수 목록

### getCurrentSubjectHours(schedule, className, subjectName, days)
학급의 특정 과목 현재 시수를 계산합니다.

**매개변수:**
- `schedule` (Object): 시간표 데이터
- `className` (String): 학급명
- `subjectName` (String): 과목명
- `days` (Array): 요일 배열 ['월', '화', '수', '목', '금']

**반환값:**
- `number`: 해당 과목의 현재 시수

**사용 예시:**
```javascript
const hours = getCurrentSubjectHours(schedule, '1학년 1반', '수학', ['월', '화', '수', '목', '금']);
console.log(hours); // 3
```

### getCurrentTeacherHours(schedule, teacherName, specificClassName, days)
교사의 현재 시수를 계산합니다.

**매개변수:**
- `schedule` (Object): 시간표 데이터
- `teacherName` (String): 교사명
- `specificClassName` (String, optional): 특정 학급명 (null이면 전체)
- `days` (Array): 요일 배열

**반환값:**
- `number`: 해당 교사의 현재 시수

### getClassSubjectHours(schedule, className, days)
학급의 모든 과목별 시수를 계산합니다.

**매개변수:**
- `schedule` (Object): 시간표 데이터
- `className` (String): 학급명
- `days` (Array): 요일 배열

**반환값:**
- `Object`: 과목별 시수 객체 `{ '수학': 3, '영어': 2, ... }`

### convertClassNameToKey(className)
학급명을 키 형태로 변환합니다.

**매개변수:**
- `className` (String): 학급명 (예: "3학년 1반")

**반환값:**
- `String`: 변환된 키 (예: "3학년-1")

### checkTeacherClassHoursLimit(teacher, className, schedule, days)
교사의 학급별 시수 제한을 확인합니다.

**매개변수:**
- `teacher` (Object): 교사 데이터
- `className` (String): 학급명
- `schedule` (Object): 시간표 데이터
- `days` (Array): 요일 배열

**반환값:**
- `Object`: 제한 확인 결과
  ```javascript
  {
    allowed: boolean,
    reason: string,
    current: number,
    max: number
  }
  ```

### checkTeacherUnavailable(teacher, day, period)
교사의 불가능 시간을 확인합니다.

**매개변수:**
- `teacher` (Object): 교사 데이터
- `day` (String): 요일
- `period` (Number): 교시

**반환값:**
- `Object`: 불가능 시간 확인 결과
  ```javascript
  {
    allowed: boolean,
    reason: string,
    day: string,
    period: number
  }
  ```

### isClassDisabled(className, data)
학급이 비활성화되었는지 확인합니다.

**매개변수:**
- `className` (String): 학급명
- `data` (Object): 전체 데이터

**반환값:**
- `boolean`: 비활성화 여부

### canPlaceClassInSchedule(className, data, addLog)
학급에 수업을 배치할 수 있는지 확인합니다.

**매개변수:**
- `className` (String): 학급명
- `data` (Object): 전체 데이터
- `addLog` (Function): 로그 함수

**반환값:**
- `boolean`: 배치 가능 여부

### validateSlotPlacement(schedule, className, day, period, teacher, subject, data, addLog)
슬롯 배치를 검증합니다.

**매개변수:**
- `schedule` (Object): 시간표 데이터
- `className` (String): 학급명
- `day` (String): 요일
- `period` (Number): 교시
- `teacher` (Object): 교사 데이터
- `subject` (String): 과목명
- `data` (Object): 전체 데이터
- `addLog` (Function): 로그 함수

**반환값:**
- `boolean`: 배치 가능 여부

## 사용 예시

```javascript
import {
  getCurrentSubjectHours,
  checkTeacherClassHoursLimit,
  validateSlotPlacement
} from './TimetableGenerationHelpers';

// 과목 시수 확인
const mathHours = getCurrentSubjectHours(schedule, '1학년 1반', '수학', days);

// 교사 시수 제한 확인
const limitCheck = checkTeacherClassHoursLimit(teacher, '1학년 1반', schedule, days);
if (!limitCheck.allowed) {
  console.log(`시수 제한 위반: ${limitCheck.reason}`);
}

// 슬롯 배치 검증
const canPlace = validateSlotPlacement(schedule, '1학년 1반', '월', 1, teacher, '수학', data, addLog);
``` 