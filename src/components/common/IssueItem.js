import React from 'react';

/**
 * 개별 이슈 아이템 컴포넌트
 * @param {Object} props
 * @param {string} props.issue - 이슈 메시지
 * @param {number} props.index - 이슈 인덱스
 */
const IssueItem = ({ issue, index }) => {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start">
        <span className="text-red-600 font-bold mr-3">#{index + 1}</span>
        <div className="flex-1">
          <p className="text-red-800 font-medium">{issue}</p>
        </div>
      </div>
    </div>
  );
};

export default IssueItem; 