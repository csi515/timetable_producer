import { UnavailableTime } from './teacher';

export interface SubjectFormData {
    name: string;
    weeklyHours: number;
    requiresSpecialRoom: boolean;
    specialRoomType: string;
    isBlockClass: boolean;
    blockHours: number;
    isCoTeaching: boolean;
    isExternalInstructor: boolean;
    preferConcentrated: boolean;
}

export interface TeacherFormData {
    name: string;
    subjects: string[];
    maxWeeklyHours: number;
    unavailableTimes: UnavailableTime[];
    isPriority: boolean;
    isExternal: boolean;
}

export interface ValidationResult {
    isValid: boolean;
    errors: Record<string, string>;
    warnings: Record<string, string>;
}

export interface FieldValidation {
    fieldName: string;
    isValid: boolean;
    errorMessage?: string;
    warningMessage?: string;
}
