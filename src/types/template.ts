import { ScheduleConfig, ClassInfo } from './timetable';
import { Subject } from './subject';
import { Teacher } from './teacher';

export type TemplateType = 'config' | 'subjects' | 'teachers' | 'full';

export interface Template {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  type: TemplateType;
  data: ConfigTemplate | SubjectsTemplate | TeachersTemplate | FullTemplate;
}

export interface ConfigTemplate {
  config: ScheduleConfig;
  classes: ClassInfo[];
}

export interface SubjectsTemplate {
  subjects: Subject[];
}

export interface TeachersTemplate {
  teachers: Teacher[];
}

export interface FullTemplate {
  config: ScheduleConfig;
  classes: ClassInfo[];
  subjects: Subject[];
  teachers: Teacher[];
}
