import React, { useState, useEffect } from 'react';
import { calculateReviewData } from '../services/reviewService';
import { createDefaultReviewData } from '../utils/reviewUtils';

/**
 * 검토 데이터 관리를 위한 커스텀 훅
 * @param {Object} data - 입력 데이터
 * @returns {Object} 검토 데이터와 관련 함수들
 */
export const useReviewData = (data) => {
  const [reviewData, setReviewData] = useState(null);

  // data prop에 대한 안전한 기본값 (useMemo로 최적화)
  const safeData = React.useMemo(() => data || {
    base: { grades: 0, classes_per_grade: [] },
    teachers: [],
    fixedClasses: [],
    constraints: { must: [] }
  }, [data]);

  // reviewData가 null일 때를 위한 기본값
  const defaultReviewData = React.useMemo(() => createDefaultReviewData(), []);

  // 안전한 접근을 위한 기본값
  const safeReviewData = React.useMemo(() => ({
    classHours: reviewData?.classHours || defaultReviewData.classHours,
    teacherHours: reviewData?.teacherHours || defaultReviewData.teacherHours,
    coTeachingClasses: reviewData?.coTeachingClasses || defaultReviewData.coTeachingClasses,
    issues: reviewData?.issues || defaultReviewData.issues,
    teacherHoursValidation: reviewData?.teacherHoursValidation || defaultReviewData.teacherHoursValidation
  }), [reviewData, defaultReviewData]);

  // 시수 계산 및 검토
  useEffect(() => {
    const newReviewData = calculateReviewData(safeData);
    setReviewData(newReviewData);
  }, [safeData]);

  return {
    reviewData: safeReviewData,
    setReviewData,
    hasIssues: safeReviewData.issues.length > 0,
    totalClasses: Object.keys(safeReviewData.classHours).length,
    totalTeachers: Object.keys(safeReviewData.teacherHours).length,
    totalCoTeachingClasses: safeReviewData.coTeachingClasses.length,
    totalIssues: safeReviewData.issues.length
  };
}; 