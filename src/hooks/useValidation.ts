import { useState, useCallback } from 'react';
import { ValidationResult, FieldValidation } from '../types/forms';
import { Subject } from '../types/subject';
import { Teacher } from '../types/teacher';

export const useValidation = () => {
    const [validationResults, setValidationResults] = useState<Record<string, FieldValidation>>({});

    const validateSubjectName = useCallback((name: string, existingSubjects: Subject[]): FieldValidation => {
        const trimmedName = name.trim();

        if (!trimmedName) {
            return {
                fieldName: 'name',
                isValid: false,
                errorMessage: '과목명을 입력해주세요.'
            };
        }

        if (existingSubjects.some(s => s.name === trimmedName)) {
            return {
                fieldName: 'name',
                isValid: false,
                errorMessage: '이미 등록된 과목입니다.'
            };
        }

        return { fieldName: 'name', isValid: true };
    }, []);

    const validateWeeklyHours = useCallback((hours: number): FieldValidation => {
        if (hours < 1 || hours > 10) {
            return {
                fieldName: 'weeklyHours',
                isValid: false,
                errorMessage: '주간 시수는 1~10 사이여야 합니다.'
            };
        }

        if (hours > 7) {
            return {
                fieldName: 'weeklyHours',
                isValid: true,
                warningMessage: '주간 시수가 많습니다. 시간표 생성이 어려울 수 있습니다.'
            };
        }

        return { fieldName: 'weeklyHours', isValid: true };
    }, []);

    const validateTeacherName = useCallback((name: string, existingTeachers: Teacher[]): FieldValidation => {
        const trimmedName = name.trim();

        if (!trimmedName) {
            return {
                fieldName: 'name',
                isValid: false,
                errorMessage: '교사명을 입력해주세요.'
            };
        }

        if (existingTeachers.some(t => t.name === trimmedName)) {
            return {
                fieldName: 'name',
                isValid: false,
                errorMessage: '이미 등록된 교사입니다.'
            };
        }

        return { fieldName: 'name', isValid: true };
    }, []);

    const validateTeacherSubjects = useCallback((subjects: string[]): FieldValidation => {
        if (subjects.length === 0) {
            return {
                fieldName: 'subjects',
                isValid: false,
                errorMessage: '최소 1개 이상의 과목을 선택해주세요.'
            };
        }

        return { fieldName: 'subjects', isValid: true };
    }, []);

    const validateMaxWeeklyHours = useCallback((hours: number, subjects: string[], allSubjects: Subject[]): FieldValidation => {
        if (hours < 1 || hours > 40) {
            return {
                fieldName: 'maxWeeklyHours',
                isValid: false,
                errorMessage: '주간 최대 시수는 1~40 사이여야 합니다.'
            };
        }

        // 담당 과목의 총 시수와 비교
        const totalSubjectHours = allSubjects
            .filter(s => subjects.includes(s.id))
            .reduce((sum, s) => sum + s.weeklyHours, 0);

        if (totalSubjectHours > hours) {
            return {
                fieldName: 'maxWeeklyHours',
                isValid: true,
                warningMessage: `담당 과목의 총 시수(${totalSubjectHours})가 최대 시수를 초과합니다.`
            };
        }

        return { fieldName: 'maxWeeklyHours', isValid: true };
    }, []);

    const setFieldValidation = useCallback((validation: FieldValidation) => {
        setValidationResults(prev => ({
            ...prev,
            [validation.fieldName]: validation
        }));
    }, []);

    const clearValidation = useCallback((fieldName?: string) => {
        if (fieldName) {
            setValidationResults(prev => {
                const newResults = { ...prev };
                delete newResults[fieldName];
                return newResults;
            });
        } else {
            setValidationResults({});
        }
    }, []);

    const getFieldValidation = useCallback((fieldName: string): FieldValidation | undefined => {
        return validationResults[fieldName];
    }, [validationResults]);

    const hasErrors = useCallback((): boolean => {
        return Object.values(validationResults).some(v => !v.isValid);
    }, [validationResults]);

    return {
        validationResults,
        validateSubjectName,
        validateWeeklyHours,
        validateTeacherName,
        validateTeacherSubjects,
        validateMaxWeeklyHours,
        setFieldValidation,
        clearValidation,
        getFieldValidation,
        hasErrors
    };
};
