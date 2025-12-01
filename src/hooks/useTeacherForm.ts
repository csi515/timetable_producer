import { useState, useCallback } from 'react';
import { TeacherFormData, ValidationResult } from '../types/forms';
import { UnavailableTime } from '../types/teacher';

const initialFormData: TeacherFormData = {
    name: '',
    subjects: [],
    maxWeeklyHours: 20,
    unavailableTimes: [],
    isPriority: false,
    isExternal: false
};

export const useTeacherForm = () => {
    const [formData, setFormData] = useState<TeacherFormData>(initialFormData);

    const updateField = useCallback(<K extends keyof TeacherFormData>(
        field: K,
        value: TeacherFormData[K]
    ) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    }, []);

    const addUnavailableTime = useCallback((time: UnavailableTime) => {
        setFormData(prev => {
            // 중복 체크
            const exists = prev.unavailableTimes.some(
                t => t.day === time.day && t.period === time.period
            );

            if (exists) {
                return prev;
            }

            return {
                ...prev,
                unavailableTimes: [...prev.unavailableTimes, time]
            };
        });
    }, []);

    const removeUnavailableTime = useCallback((index: number) => {
        setFormData(prev => ({
            ...prev,
            unavailableTimes: prev.unavailableTimes.filter((_, i) => i !== index)
        }));
    }, []);

    const toggleSubject = useCallback((subjectId: string) => {
        setFormData(prev => {
            const subjects = prev.subjects.includes(subjectId)
                ? prev.subjects.filter(id => id !== subjectId)
                : [...prev.subjects, subjectId];

            return {
                ...prev,
                subjects
            };
        });
    }, []);

    const resetForm = useCallback(() => {
        setFormData(initialFormData);
    }, []);

    const validate = useCallback((): ValidationResult => {
        const errors: Record<string, string> = {};
        const warnings: Record<string, string> = {};

        // 교사명 검증
        if (!formData.name.trim()) {
            errors.name = '교사명을 입력해주세요.';
        }

        // 담당 과목 검증
        if (formData.subjects.length === 0) {
            errors.subjects = '최소 1개 이상의 과목을 선택해주세요.';
        }

        // 최대 시수 검증
        if (formData.maxWeeklyHours < 1 || formData.maxWeeklyHours > 40) {
            errors.maxWeeklyHours = '주간 최대 시수는 1~40 사이여야 합니다.';
        } else if (formData.maxWeeklyHours > 30) {
            warnings.maxWeeklyHours = '주간 최대 시수가 많습니다. 과부하에 주의하세요.';
        }

        // 불가능 시간 경고
        if (formData.unavailableTimes.length > 10) {
            warnings.unavailableTimes = '불가능한 시간이 많으면 시간표 생성이 어려울 수 있습니다.';
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors,
            warnings
        };
    }, [formData]);

    return {
        formData,
        updateField,
        addUnavailableTime,
        removeUnavailableTime,
        toggleSubject,
        resetForm,
        validate
    };
};
