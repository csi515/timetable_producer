import { createValidationError, handleError, ERROR_TYPES } from '../utils/errorHandler';

// 교사 추가 함수
export const addTeacher = (teachers, newTeacher, updateData) => {
  try {
    if (!newTeacher.name.trim()) {
      throw createValidationError('교사명을 입력해주세요.', 'name');
    }
    
    if (!newTeacher.subjects || newTeacher.subjects.length === 0) {
      throw createValidationError('담당 과목을 선택해주세요.', 'subjects');
    }
    
    // 중복 교사명 검사
    const isDuplicate = teachers.some(teacher => 
      teacher.name.trim().toLowerCase() === newTeacher.name.trim().toLowerCase()
    );
    
    if (isDuplicate) {
      throw createValidationError('이미 존재하는 교사명입니다.', 'name');
    }
    
    const updatedTeachers = [...teachers, { ...newTeacher, id: Date.now() }];
    updateData('teachers', updatedTeachers);
    return { success: true, teachers: updatedTeachers };
    
  } catch (error) {
    return handleError(error, 'addTeacher', ERROR_TYPES.VALIDATION);
  }
};

// 교사 업데이트 함수
export const updateTeacher = (teachers, index, field, value, updateData) => {
  const updatedTeachers = teachers.map((teacher, i) => 
    i === index ? { ...teacher, [field]: value } : teacher
  );
  updateData('teachers', updatedTeachers);
  return updatedTeachers;
};

// 교사 삭제 함수
export const removeTeacher = (teachers, index, updateData) => {
  const updatedTeachers = teachers.filter((_, i) => i !== index);
  updateData('teachers', updatedTeachers);
  return updatedTeachers;
};

// 새 교사 초기화 함수
export const initializeNewTeacher = () => {
  return {
    name: '',
    subjects: [],
    unavailable: [],
    allow_parallel: false,
    co_teaching_with: '',
    maxHours: 25,
    weeklyHoursByGrade: {},
    subjectHours: {}
  };
};

// 불가능 시간 추가 함수
export const addUnavailableTime = (editingTeacher, day, period) => {
  const timeSlot = [day, period];
  const isAlreadyAdded = editingTeacher.unavailable.some(
    slot => slot[0] === day && slot[1] === period
  );
  
  if (!isAlreadyAdded) {
    const updatedUnavailable = [...editingTeacher.unavailable, timeSlot];
    return { ...editingTeacher, unavailable: updatedUnavailable };
  }
  
  return editingTeacher;
};

// 불가능 시간 제거 함수
export const removeUnavailableTime = (editingTeacher, day, period) => {
  const updatedUnavailable = editingTeacher.unavailable.filter(
    slot => !(slot[0] === day && slot[1] === period)
  );
  return { ...editingTeacher, unavailable: updatedUnavailable };
};

// 불가능 시간 확인 함수
export const isTimeUnavailable = (editingTeacher, day, period) => {
  return editingTeacher.unavailable.some(slot => slot[0] === day && slot[1] === period);
};

// 과목 토글 함수
export const toggleSubjectInEdit = (editingTeacher, subjectName) => {
  const currentSubjects = editingTeacher.subjects || [];
  const updatedSubjects = currentSubjects.includes(subjectName)
    ? currentSubjects.filter(subject => subject !== subjectName)
    : [...currentSubjects, subjectName];
  
  return { ...editingTeacher, subjects: updatedSubjects };
};

// 파일 업로드 처리 함수
export const handleFileUpload = (event, teachers, updateData) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target.result;
      const lines = content.split('\n').filter(line => line.trim());
      
      const uploadedTeachers = [];
      let currentTeacher = null;
      
      lines.forEach(line => {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('교사:')) {
          if (currentTeacher) {
            uploadedTeachers.push(currentTeacher);
          }
          currentTeacher = {
            name: trimmedLine.replace('교사:', '').trim(),
            subjects: [],
            unavailable: [],
            allow_parallel: false,
            co_teaching_with: '',
            maxHours: 25,
            weeklyHoursByGrade: {},
            subjectHours: {},
            id: Date.now() + Math.random()
          };
        } else if (currentTeacher && trimmedLine.startsWith('과목:')) {
          const subjects = trimmedLine.replace('과목:', '').trim().split(',').map(s => s.trim());
          currentTeacher.subjects = subjects;
        } else if (currentTeacher && trimmedLine.startsWith('불가능:')) {
          const unavailableStr = trimmedLine.replace('불가능:', '').trim();
          if (unavailableStr) {
            const unavailable = unavailableStr.split(',').map(s => {
              const [day, period] = s.trim().split(' ');
              return [day, parseInt(period)];
            });
            currentTeacher.unavailable = unavailable;
          }
        }
      });
      
      if (currentTeacher) {
        uploadedTeachers.push(currentTeacher);
      }
      
      if (uploadedTeachers.length > 0) {
        const updatedTeachers = [...teachers, ...uploadedTeachers];
        updateData('teachers', updatedTeachers);
        alert(`${uploadedTeachers.length}명의 교사 정보가 업로드되었습니다.`);
      }
      
    } catch (error) {
      alert('파일 형식이 올바르지 않습니다. 다시 확인해주세요.');
      console.error('File upload error:', error);
    }
  };
  
  reader.readAsText(file);
};

// 교사 데이터 검증 함수
export const validateTeacherData = (teachers, subjects) => {
  const errors = [];
  
  teachers.forEach((teacher, index) => {
    if (!teacher.name.trim()) {
      errors.push(`교사 ${index + 1}: 이름이 비어있습니다.`);
    }
    
    if (!teacher.subjects || teacher.subjects.length === 0) {
      errors.push(`${teacher.name}: 담당 과목이 없습니다.`);
    }
    
    // 과목 존재 여부 확인
    teacher.subjects.forEach(subject => {
      if (!subjects.find(s => s.name === subject)) {
        errors.push(`${teacher.name}: 존재하지 않는 과목 "${subject}"이 지정되었습니다.`);
      }
    });
    
    // 시수 제한 확인
    if (teacher.maxHours && (teacher.maxHours < 1 || teacher.maxHours > 40)) {
      errors.push(`${teacher.name}: 주간 시수 제한이 1-40 범위를 벗어났습니다.`);
    }
  });
  
  return errors;
}; 