// 휴리스틱 함수 구현

import { CSPVariable, TimeSlot, Subject, TimetableData } from '../../types/timetable';
import { Heuristic, CSPState } from './types';

// 최소 도메인 크기 우선 (MRV - Minimum Remaining Values)
export class MRVHeuristic implements Heuristic {
  name = 'MRV (Minimum Remaining Values)';

  selectVariable(state: CSPState): CSPVariable | null {
    if (state.unassigned.length === 0) return null;

    // 도메인 크기가 가장 작은 변수 선택
    let minSize = Infinity;
    let selected: CSPVariable | null = null;

    for (const variable of state.unassigned) {
      const key = this.getVariableKey(variable);
      const domain = state.domains.get(key) || [];
      const size = domain.length;

      if (size < minSize && size > 0) {
        minSize = size;
        selected = variable;
      }
    }

    return selected;
  }

  orderDomainValues(variable: CSPVariable, domain: TimeSlot[]): TimeSlot[] {
    // 도메인 값은 그대로 반환 (추가 정렬 필요시 구현)
    return domain;
  }

  private getVariableKey(variable: CSPVariable): string {
    return `${variable.classId}_${variable.subjectId}`;
  }
}

// 난이도 기반 휴리스틱
export class DifficultyHeuristic implements Heuristic {
  name = 'Difficulty-based';

  constructor(private data: TimetableData) {}

  selectVariable(state: CSPState): CSPVariable | null {
    if (state.unassigned.length === 0) return null;

    // 난이도가 높은 과목 우선 배정
    let maxDifficulty = -1;
    let selected: CSPVariable | null = null;

    for (const variable of state.unassigned) {
      const subject = this.data.subjects.find(s => s.id === variable.subjectId);
      const difficulty = subject?.difficulty ?? 0;
      const key = `${variable.classId}_${variable.subjectId}`;
      const domain = state.domains.get(key) || [];

      if (domain.length > 0 && difficulty > maxDifficulty) {
        maxDifficulty = difficulty;
        selected = variable;
      }
    }

    return selected || state.unassigned[0];
  }

  orderDomainValues(variable: CSPVariable, domain: TimeSlot[]): TimeSlot[] {
    // 연강이 필요한 경우, 연속 가능한 슬롯 우선
    const subject = this.data.subjects.find(s => s.id === variable.subjectId);
    
    if (subject?.requiresConsecutive) {
      // 연속 가능한 슬롯을 앞으로
      const consecutiveSlots: TimeSlot[] = [];
      const otherSlots: TimeSlot[] = [];

      for (const slot of domain) {
        const hasConsecutive = domain.some(
          s => s.day === slot.day && Math.abs(s.period - slot.period) === 1
        );
        if (hasConsecutive) {
          consecutiveSlots.push(slot);
        } else {
          otherSlots.push(slot);
        }
      }

      return [...consecutiveSlots, ...otherSlots];
    }

    return domain;
  }
}

// 결합 휴리스틱 (MRV + 난이도)
export class CombinedHeuristic implements Heuristic {
  name = 'Combined (MRV + Difficulty)';

  constructor(private data: TimetableData) {}

  selectVariable(state: CSPState): CSPVariable | null {
    if (state.unassigned.length === 0) return null;

    // 도메인 크기와 난이도를 결합한 점수 계산
    let bestScore = -Infinity;
    let selected: CSPVariable | null = null;

    for (const variable of state.unassigned) {
      const key = `${variable.classId}_${variable.subjectId}`;
      const domain = state.domains.get(key) || [];
      
      if (domain.length === 0) continue;

      const subject = this.data.subjects.find(s => s.id === variable.subjectId);
      const difficulty = subject?.difficulty ?? 0;
      
      // 도메인 크기가 작을수록, 난이도가 높을수록 높은 점수
      const score = difficulty * 10 - domain.length;

      if (score > bestScore) {
        bestScore = score;
        selected = variable;
      }
    }

    return selected || state.unassigned[0];
  }

  orderDomainValues(variable: CSPVariable, domain: TimeSlot[]): TimeSlot[] {
    const subject = this.data.subjects.find(s => s.id === variable.subjectId);
    
    if (subject?.requiresConsecutive) {
      const consecutiveSlots: TimeSlot[] = [];
      const otherSlots: TimeSlot[] = [];

      for (const slot of domain) {
        const hasConsecutive = domain.some(
          s => s.day === slot.day && Math.abs(s.period - slot.period) === 1
        );
        if (hasConsecutive) {
          consecutiveSlots.push(slot);
        } else {
          otherSlots.push(slot);
        }
      }

      return [...consecutiveSlots, ...otherSlots];
    }

    return domain;
  }
}
