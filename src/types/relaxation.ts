import { ConstraintType } from './constraints';
import { Subject } from './subject';
import { Teacher } from './teacher';

export interface RelaxationSuggestion {
  level: ConstraintType;
  message: string;
  suggestion: string;
  affectedConstraints: string[];
  action?: RelaxationAction;
}

export interface RelaxationAction {
  type: 'remove_constraint' | 'modify_subject' | 'modify_teacher' | 'reduce_hours';
  target: string; // 대상 ID
  details: any;
}

export interface RelaxationConfig {
  allowLowRelaxation: boolean;
  allowMediumRelaxation: boolean;
  allowHighRelaxation: boolean;
  allowCriticalRelaxation: boolean;
}

export interface RelaxationResult {
  success: boolean;
  relaxedConstraints: string[];
  suggestions: RelaxationSuggestion[];
  modifiedSubjects?: Subject[];
  modifiedTeachers?: Teacher[];
}

