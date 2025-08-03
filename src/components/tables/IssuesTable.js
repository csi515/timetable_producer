import React from 'react';
import { safeArray } from '../../utils/reviewUtils';
import IssueItem from '../common/IssueItem';

/**
 * 이슈 테이블 컴포넌트
 * @param {Object} props
 * @param {Array} props.issues - 이슈 목록
 */
const IssuesTable = ({ issues }) => {
  const safeIssues = safeArray(issues);

  if (safeIssues.length === 0) {
    return null;
  }

  return (
    <div className="card mb-6">
      <h3 className="text-xl font-bold mb-4 text-red-600">⚠️ 검토 필요 항목</h3>
      <div className="space-y-3">
        {safeIssues.map((issue, index) => (
          <IssueItem key={index} issue={issue} index={index} />
        ))}
      </div>
    </div>
  );
};

export default IssuesTable; 