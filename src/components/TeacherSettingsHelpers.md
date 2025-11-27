# TeacherSettingsHelpers API 문서

## 개요
교사 설정 관련 헬퍼 함수들을 제공하는 모듈입니다.

## 함수 목록

### addTeacher(teachers, newTeacher, updateData)
새로운 교사를 추가합니다.

**매개변수:**
- `teachers` (Array): 기존 교사 목록
- `newTeacher` (Object): 추가할 교사 데이터
- `updateData` (Function): 데이터 업데이트 함수

**반환값:**
- `Array`: 업데이트된 교사 목록

**사용 예시:**
```javascript
const newTeacher = {
  name: '김교사',
  subjects: ['수학', '과학'],
  maxHours: 25
};
const updatedTeachers = addTeacher(teachers, newTeacher, updateData);
```

### updateTeacher(teachers, index, field, value, updateData)
기존 교사 정보를 업데이트합니다.

**매개변수:**
- `teachers` (Array): 교사 목록
- `index` (Number): 교사 인덱스
- `field` (String): 업데이트할 필드명
- `value` (Any): 새로운 값
- `updateData` (Function): 데이터 업데이트 함수

**반환값:**
- `Array`: 업데이트된 교사 목록

### removeTeacher(teachers, index, updateData)
교사를 삭제합니다.

**매개변수:**
- `teachers` (Array): 교사 목록
- `index` (Number): 삭제할 교사 인덱스
- `updateData` (Function): 데이터 업데이트 함수

**반환값:**
- `Array`: 업데이트된 교사 목록

### initializeNewTeacher()
새 교사 객체를 초기화합니다.

**반환값:**
- `Object`: 초기화된 교사 객체
  ```javascript
  {
    name: '',
    subjects: [],
    unavailable: [],
    allow_parallel: false,
    co_teaching_with: '',
    maxHours: 25,
    weeklyHoursByGrade: {},
    subjectHours: {}
  }
  ```

### addUnavailableTime(editingTeacher, day, period)
교사의 불가능 시간을 추가합니다.

**매개변수:**
- `editingTeacher` (Object): 편집 중인 교사 객체
- `day` (String): 요일
- `period` (Number): 교시

**반환값:**
- `Object`: 업데이트된 교사 객체

### removeUnavailableTime(editingTeacher, day, period)
교사의 불가능 시간을 제거합니다.

**매개변수:**
- `editingTeacher` (Object): 편집 중인 교사 객체
- `day` (String): 요일
- `period` (Number): 교시

**반환값:**
- `Object`: 업데이트된 교사 객체

### isTimeUnavailable(editingTeacher, day, period)
특정 시간이 불가능한지 확인합니다.

**매개변수:**
- `editingTeacher` (Object): 편집 중인 교사 객체
- `day` (String): 요일
- `period` (Number): 교시

**반환값:**
- `boolean`: 불가능 여부

### toggleSubjectInEdit(editingTeacher, subjectName)
편집 중인 교사의 과목을 토글합니다.

**매개변수:**
- `editingTeacher` (Object): 편집 중인 교사 객체
- `subjectName` (String): 과목명

**반환값:**
- `Object`: 업데이트된 교사 객체

### handleFileUpload(event, teachers, updateData)
파일 업로드를 처리합니다.

**매개변수:**
- `event` (Event): 파일 업로드 이벤트
- `teachers` (Array): 기존 교사 목록
- `updateData` (Function): 데이터 업데이트 함수

**파일 형식:**
```
교사:김교사
과목:수학,과학
불가능:월 1,화 2

교사:이교사
과목:영어,국어
불가능:수 3,목 4
```

### validateTeacherData(teachers, subjects)
교사 데이터를 검증합니다.

**매개변수:**
- `teachers` (Array): 교사 목록
- `subjects` (Array): 과목 목록

**반환값:**
- `Array`: 검증 오류 목록

**검증 항목:**
- 교사명이 비어있지 않은지
- 담당 과목이 있는지
- 존재하지 않는 과목이 지정되지 않았는지
- 시수 제한이 유효한 범위인지

## 사용 예시

```javascript
import {
  addTeacher,
  updateTeacher,
  validateTeacherData,
  handleFileUpload
} from './TeacherSettingsHelpers';

// 교사 추가
const newTeacher = initializeNewTeacher();
newTeacher.name = '김교사';
newTeacher.subjects = ['수학'];
const updatedTeachers = addTeacher(teachers, newTeacher, updateData);

// 교사 정보 업데이트
const updatedTeachers = updateTeacher(teachers, 0, 'maxHours', 30, updateData);

// 데이터 검증
const errors = validateTeacherData(teachers, subjects);
if (errors.length > 0) {
  console.log('검증 오류:', errors);
}

// 파일 업로드 처리
const fileInput = document.getElementById('teacherFile');
fileInput.addEventListener('change', (event) => {
  handleFileUpload(event, teachers, updateData);
});
``` 