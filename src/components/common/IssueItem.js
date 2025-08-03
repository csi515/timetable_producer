import React from 'react';
import { getIssueMessage, getIssueTitle } from '../../utils/reviewUtils';

/**
 * 개별 이슈 아이템 컴포넌트
 * @param {Object} props
 * @param {Object} props.issue - 이슈 객체
 * @param {number} props.index - 이슈 인덱스
 */
const IssueItem = ({ issue, index }) => {
  const issueTitle = getIssueTitle(issue);
  const issueMessage = getIssueMessage(issue);

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start">
        <span className="text-red-600 font-bold mr-3">#{index + 1}</span>
        <div className="flex-1">
          <h4 className="text-red-800 font-semibold mb-1">{issueTitle}</h4>
          <p className="text-red-700">{issueMessage}</p>
        </div>
      </div>
    </div>
  );
};

export default IssueItem; 