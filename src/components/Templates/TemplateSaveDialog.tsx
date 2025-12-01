import React, { useState } from 'react';
import { TemplateType } from '../../types/template';

interface TemplateSaveDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, type: TemplateType, description?: string) => Promise<void>;
}

export const TemplateSaveDialog: React.FC<TemplateSaveDialogProps> = ({
    isOpen,
    onClose,
    onSave
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<TemplateType>('full');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) {
            alert('템플릿 이름을 입력해주세요.');
            return;
        }

        try {
            setIsSaving(true);
            await onSave(name.trim(), type, description.trim() || undefined);
            setName('');
            setDescription('');
            setType('full');
            onClose();
        } catch (err) {
            alert('템플릿 저장에 실패했습니다.');
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        setName('');
        setDescription('');
        setType('full');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>템플릿 저장</h2>
                    <button className="close-button" onClick={handleClose}>×</button>
                </div>

                <div className="modal-body">
                    <div className="input-group">
                        <label>템플릿 이름 <span className="required">*</span></label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="예: 우리 학교 기본 설정"
                            autoFocus
                        />
                    </div>

                    <div className="input-group">
                        <label>설명 (선택)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="템플릿에 대한 설명을 입력하세요"
                            rows={3}
                        />
                    </div>

                    <div className="input-group">
                        <label>템플릿 유형 <span className="required">*</span></label>
                        <select value={type} onChange={(e) => setType(e.target.value as TemplateType)}>
                            <option value="full">전체 설정 (기본설정 + 과목 + 교사)</option>
                            <option value="config">기본 설정만</option>
                            <option value="subjects">과목만</option>
                            <option value="teachers">교사만</option>
                        </select>
                        <span className="input-hint">
                            {type === 'full' && '현재 입력된 모든 설정을 저장합니다.'}
                            {type === 'config' && '학년, 학급 수, 요일, 교시 등 기본 설정만 저장합니다.'}
                            {type === 'subjects' && '과목 목록만 저장합니다.'}
                            {type === 'teachers' && '교사 목록만 저장합니다.'}
                        </span>
                    </div>
                </div>

                <div className="modal-footer">
                    <button onClick={handleClose} disabled={isSaving} className="secondary-button">
                        취소
                    </button>
                    <button onClick={handleSave} disabled={isSaving} className="primary-button">
                        {isSaving ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
};
