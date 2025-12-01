import { useState, useEffect, useCallback } from 'react';
import { Template, TemplateType } from '../types/template';
import { useTimetableStore } from '../store/timetableStore';
import {
    saveTemplate,
    loadAllTemplates,
    loadTemplate,
    deleteTemplate as deleteTemplateFromDB,
    loadTemplatesByType
} from '../utils/templateStorage';

export const useTemplates = () => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const config = useTimetableStore(state => state.config);
    const classes = useTimetableStore(state => state.classes);
    const subjects = useTimetableStore(state => state.subjects);
    const teachers = useTimetableStore(state => state.teachers);
    const setConfig = useTimetableStore(state => state.setConfig);
    const setClasses = useTimetableStore(state => state.setClasses);
    const setSubjects = useTimetableStore(state => state.setSubjects);
    const setTeachers = useTimetableStore(state => state.setTeachers);

    // 템플릿 목록 로드
    const loadTemplates = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const loadedTemplates = await loadAllTemplates();
            setTemplates(loadedTemplates);
        } catch (err) {
            setError(err instanceof Error ? err.message : '템플릿 로드 실패');
            console.error('Failed to load templates:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 타입별 템플릿 로드
    const loadTemplatesByTypeFilter = useCallback(async (type: TemplateType) => {
        try {
            setIsLoading(true);
            setError(null);
            const loadedTemplates = await loadTemplatesByType(type);
            setTemplates(loadedTemplates);
        } catch (err) {
            setError(err instanceof Error ? err.message : '템플릿 로드 실패');
            console.error('Failed to load templates by type:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 템플릿으로 저장
    const saveAsTemplate = useCallback(async (
        name: string,
        type: TemplateType,
        description?: string
    ): Promise<void> => {
        try {
            setIsLoading(true);
            setError(null);

            const template: Template = {
                id: `template-${Date.now()}`,
                name,
                description,
                type,
                createdAt: new Date(),
                updatedAt: new Date(),
                data: (() => {
                    switch (type) {
                        case 'config':
                            return { config: config!, classes };
                        case 'subjects':
                            return { subjects };
                        case 'teachers':
                            return { teachers };
                        case 'full':
                            return { config: config!, classes, subjects, teachers };
                    }
                })()
            };

            await saveTemplate(template);
            await loadTemplates(); // 목록 갱신
        } catch (err) {
            setError(err instanceof Error ? err.message : '템플릿 저장 실패');
            console.error('Failed to save template:', err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [config, classes, subjects, teachers, loadTemplates]);

    // 템플릿 불러오기
    const loadTemplateById = useCallback(async (id: string): Promise<void> => {
        try {
            setIsLoading(true);
            setError(null);

            const template = await loadTemplate(id);
            if (!template) {
                throw new Error('템플릿을 찾을 수 없습니다.');
            }

            // 타입에 따라 적절한 데이터만 로드
            switch (template.type) {
                case 'config':
                    if ('config' in template.data) {
                        setConfig(template.data.config);
                        setClasses(template.data.classes);
                    }
                    break;
                case 'subjects':
                    if ('subjects' in template.data) {
                        setSubjects(template.data.subjects);
                    }
                    break;
                case 'teachers':
                    if ('teachers' in template.data) {
                        setTeachers(template.data.teachers);
                    }
                    break;
                case 'full':
                    if ('config' in template.data && 'subjects' in template.data && 'teachers' in template.data) {
                        setConfig(template.data.config);
                        setClasses(template.data.classes);
                        setSubjects(template.data.subjects);
                        setTeachers(template.data.teachers);
                    }
                    break;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '템플릿 불러오기 실패');
            console.error('Failed to load template:', err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [setConfig, setClasses, setSubjects, setTeachers]);

    // 템플릿 삭제
    const deleteTemplateById = useCallback(async (id: string): Promise<void> => {
        try {
            setIsLoading(true);
            setError(null);
            await deleteTemplateFromDB(id);
            await loadTemplates(); // 목록 갱신
        } catch (err) {
            setError(err instanceof Error ? err.message : '템플릿 삭제 실패');
            console.error('Failed to delete template:', err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [loadTemplates]);

    // 초기 로드
    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    return {
        templates,
        isLoading,
        error,
        saveAsTemplate,
        loadTemplateById,
        deleteTemplateById,
        loadTemplates,
        loadTemplatesByTypeFilter
    };
};
