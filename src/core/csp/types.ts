// CSP 알고리즘 관련 타입 정의

import { CSPVariable, Assignment, TimeSlot, Domain } from '../../types/timetable';

export interface CSPState {
  variables: CSPVariable[];
  domains: Map<string, Domain>; // variable key -> domain
  assignments: Assignment[];
  unassigned: CSPVariable[];
}

export interface Heuristic {
  name: string;
  selectVariable: (state: CSPState) => CSPVariable | null;
  orderDomainValues: (variable: CSPVariable, domain: Domain) => TimeSlot[];
}

export interface ConstraintChecker {
  check: (assignment: Assignment, existingAssignments: Assignment[]) => boolean;
  forwardCheck?: (assignment: Assignment, domains: Map<string, Domain>) => Map<string, Domain>;
}

export interface BacktrackResult {
  success: boolean;
  assignments: Assignment[];
  iterations: number;
  backtracks: number;
  logs: string[];
  violations: string[];
}
