import React from 'react';
import { useReviewData } from '../../hooks/useReviewData';
import StatCard from '../common/StatCard';
import ClassHoursTable from '../tables/ClassHoursTable';
import TeacherHoursTable from '../tables/TeacherHoursTable';
import CoTeachingTable from '../tables/CoTeachingTable';
import WeeklyHoursComparisonTable from '../tables/WeeklyHoursComparisonTable';

/**
 * 최종 검토 컴포넌트
 * @param {Object} props
 * @param {Object} props.data - 입력 데이터
 * @param {Function} props.updateData - 데이터 업데이트 함수
 * @param {Function} props.nextStep - 다음 단계 함수
 * @param {Function} props.prevStep - 이전 단계 함수
 */
const FinalReview = ({ data, updateData, nextStep, prevStep }) => {
  const {
    reviewData,
    totalClasses,
    totalTeachers,
    totalCoTeachingClasses
  } = useReviewData(data);

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="flex items-center">
          <span className="mr-3">🔍</span>최종 확인 - 시수 검토
        </h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          시간표 생성 전에 각 학급과 교사의 시수를 최종 확인합니다. 
          고정수업으로 인해 목표 시수를 초과하거나 교사 주간 시수를 초과하는 경우만 검토필요 항목에 표시됩니다.
          공동 수업이 있는 경우 교사 시수가 학급 시수보다 많을 수 있습니다.
        </p>

        {/* 통계 정보 */}
        <div className="flex gap-4 mb-8">
          <StatCard 
            icon="📚" 
            value={totalClasses} 
            label="총 학급 수" 
          />
          <StatCard 
            icon="👨‍🏫" 
            value={totalTeachers} 
            label="총 교사 수" 
          />
          <StatCard 
            icon="🤝" 
            value={totalCoTeachingClasses} 
            label="공동 수업" 
          />
        </div>

        {/* 주간 시수 비교 분석 */}
        <WeeklyHoursComparisonTable 
          teacherHours={reviewData.teacherHours}
          coTeachingClasses={reviewData.coTeachingClasses}
          data={data}
        />

        {/* 학급별 시수 테이블 */}
        <ClassHoursTable classHours={reviewData.classHours} />

        {/* 교사별 시수 테이블 */}
        <TeacherHoursTable 
          teacherHours={reviewData.teacherHours}
          coTeachingClasses={reviewData.coTeachingClasses}
        />

        {/* 공동 수업 목록 */}
        <CoTeachingTable coTeachingClasses={reviewData.coTeachingClasses} />

        {/* 네비게이션 */}
        <div className="navigation">
          <button className="btn btn-secondary" onClick={prevStep}>
            ← 이전 단계
          </button>
          <button className="btn btn-primary" onClick={nextStep}>
            다음 단계 →
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinalReview; 