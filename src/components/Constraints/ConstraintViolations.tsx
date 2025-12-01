import React from 'react';
import { ConstraintViolation } from '../../types/constraints';

interface ConstraintViolationsProps {
  violations: ConstraintViolation[];
}

export const ConstraintViolations: React.FC<ConstraintViolationsProps> = ({ violations }) => {
  const critical = violations.filter(v => v.type === 'critical');
  const high = violations.filter(v => v.type === 'high');
  const medium = violations.filter(v => v.type === 'medium');
  const low = violations.filter(v => v.type === 'low');

  if (violations.length === 0) {
    return (
      <div className="constraint-violations">
        <div className="success-message">✅ 모든 제약조건을 만족합니다!</div>
      </div>
    );
  }

  return (
    <div className="constraint-violations">
      <h2>제약조건 위반 보고서</h2>
      
      {critical.length > 0 && (
        <div className="violation-group critical">
          <h3>Critical ({critical.length})</h3>
          <ul>
            {critical.map((v, i) => (
              <li key={i}>{v.message}</li>
            ))}
          </ul>
        </div>
      )}

      {high.length > 0 && (
        <div className="violation-group high">
          <h3>High ({high.length})</h3>
          <ul>
            {high.map((v, i) => (
              <li key={i}>{v.message}</li>
            ))}
          </ul>
        </div>
      )}

      {medium.length > 0 && (
        <div className="violation-group medium">
          <h3>Medium ({medium.length})</h3>
          <ul>
            {medium.map((v, i) => (
              <li key={i}>{v.message}</li>
            ))}
          </ul>
        </div>
      )}

      {low.length > 0 && (
        <div className="violation-group low">
          <h3>Low ({low.length})</h3>
          <ul>
            {low.map((v, i) => (
              <li key={i}>{v.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

