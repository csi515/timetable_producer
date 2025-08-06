import React, { useState } from 'react';

// 교사 설정 핵심 로직
export const useTeacherSettings = (data, updateData) => {
  const [teachers, setTeachers] = useState(data.teachers || []);
  const [newTeacher, setNewTeacher] = useState({
    name: '',
    subjects: [],
    unavailable: [],
    allow_parallel: false,
    co_teaching_with: '',
    maxHours: 25,
    weeklyHoursByGrade: {},
    subjectHours: {},
    mutual_exclusions: [],
    sequential_grade_teaching: false
  });
  
  // 편집 모달 상태
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [editingIndex, setEditingIndex] = useState(-1);

  const days = ['월', '화', '수', '목', '금'];
  const maxPeriods = Math.max(...Object.values(data.base.periods_per_day));

  const addTeacher = () => {
    if (newTeacher.name.trim() && newTeacher.subjects.length > 0) {
      const updatedTeachers = [...teachers, { ...newTeacher, id: Date.now() }];
      setTeachers(updatedTeachers);
      updateData('teachers', updatedTeachers);
      setNewTeacher({
        name: '',
        subjects: [],
        unavailable: [],
        allow_parallel: false,
        co_teaching_with: '',
        maxHours: 25,
        weeklyHoursByGrade: {},
        subjectHours: {},
        mutual_exclusions: [],
        sequential_grade_teaching: false
      });
    } else {
      alert('교사명과 담당 과목을 입력해주세요.');
    }
  };

  const updateTeacher = (index, field, value) => {
    const updatedTeachers = teachers.map((teacher, i) => 
      i === index ? { ...teacher, [field]: value } : teacher
    );
    setTeachers(updatedTeachers);
    updateData('teachers', updatedTeachers);
  };

  const removeTeacher = (index) => {
    const updatedTeachers = teachers.filter((_, i) => i !== index);
    setTeachers(updatedTeachers);
    updateData('teachers', updatedTeachers);
  };

  // 편집 모달 관련 함수들
  const openEditModal = (teacher, index) => {
    setEditingTeacher({ ...teacher });
    setEditingIndex(index);
  };

  const closeEditModal = () => {
    setEditingTeacher(null);
    setEditingIndex(-1);
  };

  const saveEditedTeacher = () => {
    if (editingTeacher && editingIndex >= 0) {
      const updatedTeachers = teachers.map((teacher, i) => 
        i === editingIndex ? editingTeacher : teacher
      );
      setTeachers(updatedTeachers);
      updateData('teachers', updatedTeachers);
      closeEditModal();
    }
  };

  const addUnavailableTime = (day, period) => {
    const timeSlot = [day, period];
    const isAlreadyAdded = editingTeacher.unavailable.some(
      slot => slot[0] === day && slot[1] === period
    );
    
    if (!isAlreadyAdded) {
      const updatedUnavailable = [...editingTeacher.unavailable, timeSlot];
      setEditingTeacher({ ...editingTeacher, unavailable: updatedUnavailable });
    }
  };

  const removeUnavailableTime = (day, period) => {
    const updatedUnavailable = editingTeacher.unavailable.filter(
      slot => !(slot[0] === day && slot[1] === period)
    );
    setEditingTeacher({ ...editingTeacher, unavailable: updatedUnavailable });
  };

  const isTimeUnavailable = (day, period) => {
    return editingTeacher.unavailable.some(slot => slot[0] === day && slot[1] === period);
  };

  const toggleSubjectInEdit = (subjectName) => {
    const updatedSubjects = editingTeacher.subjects.includes(subjectName)
      ? editingTeacher.subjects.filter(s => s !== subjectName)
      : [...editingTeacher.subjects, subjectName];
    setEditingTeacher({ ...editingTeacher, subjects: updatedSubjects });
  };

  // JSON 파일 업로드 기능
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        
        if (jsonData.teachers && Array.isArray(jsonData.teachers)) {
          // JSON 데이터를 현재 형식으로 변환
          const convertedTeachers = jsonData.teachers.map(teacher => {
            // unavailableTimes를 현재 형식으로 변환
            const unavailable = teacher.unavailableTimes ? teacher.unavailableTimes.map(time => {
              const day = time.charAt(0); // '월', '화', '수', '목', '금'
              const period = parseInt(time.substring(1)); // '7' -> 7
              return [day, period];
            }) : [];

            return {
              name: teacher.name,
              subjects: [teacher.subject], // 단일 과목을 배열로 변환
              unavailable: unavailable,
              allow_parallel: false, // 기본값
              co_teaching_with: '',
              maxHours: teacher.maxHours || teacher.weeklyHours || 25, // 주간 최대 시수
              weeklyHoursByGrade: teacher.weeklyHoursByGrade || {}, // 학급별 주간 시수
              mutual_exclusions: teacher.mutual_exclusions || [], // 교사 간 동시 수업 제약조건
              sequential_grade_teaching: teacher.sequential_grade_teaching || false, // 학년별 순차 수업 배정 제약조건
              id: Date.now() + Math.random() // 고유 ID 생성
            };
          });

          if (confirm(`JSON 파일에서 ${convertedTeachers.length}명의 교사를 불러오시겠습니까? 기존 교사 데이터가 덮어씌워집니다.`)) {
            setTeachers(convertedTeachers);
            updateData('teachers', convertedTeachers);
            alert(`${convertedTeachers.length}명의 교사가 성공적으로 불러와졌습니다.`);
          }
        } else {
          alert('올바른 교사 데이터 형식이 아닙니다.');
        }
      } catch (error) {
        alert('JSON 파일을 읽는 중 오류가 발생했습니다: ' + error.message);
      }
    };
    reader.readAsText(file);
  };

  const handleNext = () => {
    if (teachers.length === 0) {
      alert('최소 1명 이상의 교사를 추가해주세요.');
      return;
    }
    return true; // 다음 단계로 진행 가능
  };

  return {
    teachers,
    newTeacher,
    setNewTeacher,
    editingTeacher,
    setEditingTeacher,
    editingIndex,
    days,
    maxPeriods,
    addTeacher,
    updateTeacher,
    removeTeacher,
    openEditModal,
    closeEditModal,
    saveEditedTeacher,
    addUnavailableTime,
    removeUnavailableTime,
    isTimeUnavailable,
    toggleSubjectInEdit,
    handleFileUpload,
    handleNext
  };
}; 