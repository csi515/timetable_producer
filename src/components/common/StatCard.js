import React from 'react';

/**
 * 통계 카드 컴포넌트
 * @param {Object} props
 * @param {string} props.icon - 아이콘
 * @param {string|number} props.value - 값
 * @param {string} props.label - 라벨
 * @param {string} props.className - 추가 CSS 클래스
 */
const StatCard = ({ icon, value, label, className = '' }) => {
  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
};

export default StatCard; 