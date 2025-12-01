import { useState, useCallback } from 'react';
import { SubjectFormData, ValidationResult } from '../types/forms';

const initialFormData: SubjectFormData = {
    name: '',
    weeklyHours: 3,
    requiresSpecialRoom: false,
    specialRoomType: '',
    isBlockClass: false,
    blockHours: 3,
    isCoTeaching: false,
    isExternalInstructor: false,
    preferConcentrated: false
};

export const useSubjectForm = () => {
    const [formData, setFormData] = useState<SubjectFormData>(initialFormData);

    const updateField = useCallback(<K extends keyof SubjectFormData>(
        field: K,
        value: SubjectFormData[K]
    ) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    }, []);

    const resetForm = useCallback(() => {
        setFormData(initialFormData);
    }, []);

    const validate = useCallback((): ValidationResult => {
        const errors: Record<string, string> = {};
        const warnings: Record<string, string> = {};

        // 과목명 검증
        if (!formData.name.trim()) {
            errors.name = '과목명을 입력해주세요.';
        }

        // 주간 시수 검증
        if (formData.weeklyHours < 1 || formData.weeklyHours > 10) {
            errors.weeklyHours = '주간 시수는 1~10 사이여야 합니다.';
        } else if (formData.weeklyHours > 7) {
            warnings.weeklyHours = '주간 시수가 많습니다. 시간표 생성이 어려울 수 있습니다.';
        }

        // 특별실 검증
        if (formData.requiresSpecialRoom && !formData.specialRoomType.trim()) {
            errors.specialRoomType = '특별실 종류를 입력해주세요.';
        }

        // 블록 수업 검증
        if (formData.isBlockClass) {
            if (formData.blockHours < 2 || formData.blockHours > 4) {
                errors.blockHours = '블록 수업은 2~4교시 연속이어야 합니다.';
            }
            if (formData.weeklyHours < formData.blockHours) {
                errors.blockHours = '블록 교시 수는 주간 시수보다 작아야 합니다.';
            }
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
        resetForm,
        validate
    };
};
