import React, { useState } from 'react';
import { Template, TemplateType } from '../../types/template';
import { useTemplates } from '../../hooks/useTemplates';
import { TemplateSaveDialog } from './TemplateSaveDialog';

interface TemplateManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({ isOpen, onClose }) => {
    const {
        templates,
        isLoading,
        error,
        saveAsTemplate,
        loadTemplateById,
        deleteTemplateById,
        loadTemplatesByTypeFilter,
        loadTemplates
    } = useTemplates();

    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [filterType, setFilterType] = useState<TemplateType | 'all'>('all');

    const handleSaveTemplate = async (
        name: string,
        type: TemplateType,
        description?: string
    ) => {
        await saveAsTemplate(name, type, description);
    };

    const handleLoadTemplate = async (id: string) => {
        if (confirm('현재 입력된 내용이 템플릿으로 대체됩니다. 계속하시겠습니까?')) {
            try {
                await loadTemplateById(id);
                alert('템플릿을 불러왔습니다.');
                onClose();
            } catch (err) {
                alert('템플릿 로드에 실패했습니다.');
            }
        }
    };

    const handleDeleteTemplate = async (id: string, name: string) => {
        if (confirm(`"${name}" 템플릿을 삭제하시겠습니까?`)) {
            try {
                await deleteTemplateById(id);
            } catch (err) {
                alert('템플릿 삭제에 실패했습니다.');
            }
        }
    };

    const handleFilterChange = (type: TemplateType | 'all') => {
        setFilterType(type);
        if (type === 'all') {
            loadTemplates();
        } else {
            loadTemplatesByTypeFilter(type);
        }
    };

    const getTypeLabel = (type: TemplateType): string => {
        switch (type) {
            case 'full': return '전체';
            case 'config': return '기본설정';
            case 'subjects': return '과목';
            case 'teachers': return '교사';
        }
    };

    const formatDate = (date: Date): string => {
        const d = new Date(date);
        return `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`;
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2>📋 템플릿 관리</h2>
                        <button className="close-button" onClick={onClose}>×</button>
                    </div>

                    <div className="modal-body">
                        <div className="template-manager-toolbar">
                            <button
                                className="primary-button"
                                onClick={() => setShowSaveDialog(true)}
                            >
                                + 새 템플릿 저장
                            </button>

                            <div className="filter-group">
                                <label>유형 필터:</label>
                                <select
                                    value={filterType}
                                    onChange={(e) => handleFilterChange(e.target.value as TemplateType | 'all')}
                                >
                                    <option value="all">전체</option>
                                    <option value="full">전체 설정</option>
                                    <option value="config">기본 설정</option>
                                    <option value="subjects">과목</option>
                                    <option value="teachers">교사</option>
                                </select>
                            </div>
                        </div>

                        {error && (
                            <div className="error-message">
                                ❌ {error}
                            </div>
                        )}

                        {isLoading ? (
                            <div className="loading-message">로딩 중...</div>
                        ) : templates.length === 0 ? (
                            <div className="empty-message">
                                <p>저장된 템플릿이 없습니다.</p>
                                <p>현재 설정을 템플릿으로 저장하여 나중에 재사용할 수 있습니다.</p>
                            </div>
                        ) : (
                            <div className="template-grid">
                                {templates.map(template => (
                                    <div key={template.id} className="template-card">
                                        <div className="template-card-header">
                                            <h3>{template.name}</h3>
                                            <span className={`template-type-badge ${template.type}`}>
                                                {getTypeLabel(template.type)}
                                            </span>
                                        </div>

                                        {template.description && (
                                            <p className="template-description">{template.description}</p>
                                        )}

                                        <div className="template-meta">
                                            <span>생성: {formatDate(template.createdAt)}</span>
                                            {template.updatedAt !== template.createdAt && (
                                                <span>수정: {formatDate(template.updatedAt)}</span>
                                            )}
                                        </div>

                                        <div className="template-actions">
                                            <button
                                                className="primary-button small"
                                                onClick={() => handleLoadTemplate(template.id)}
                                            >
                                                불러오기
                                            </button>
                                            <button
                                                className="danger-button small"
                                                onClick={() => handleDeleteTemplate(template.id, template.name)}
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="modal-footer">
                        <button onClick={onClose} className="secondary-button">
                            닫기
                        </button>
                    </div>
                </div>
            </div>

            <TemplateSaveDialog
                isOpen={showSaveDialog}
                onClose={() => setShowSaveDialog(false)}
                onSave={handleSaveTemplate}
            />
        </>
    );
};
