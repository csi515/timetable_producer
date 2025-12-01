import React from 'react';

interface ValidationMessageProps {
    type: 'error' | 'warning' | 'success';
    message: string;
    fieldName?: string;
}

export const ValidationMessage: React.FC<ValidationMessageProps> = ({
    type,
    message,
    fieldName
}) => {
    const getClassName = () => {
        switch (type) {
            case 'error':
                return 'validation-message error';
            case 'warning':
                return 'validation-message warning';
            case 'success':
                return 'validation-message success';
        }
    };

    const getIcon = () => {
        switch (type) {
            case 'error':
                return '❌';
            case 'warning':
                return '⚠️';
            case 'success':
                return '✅';
        }
    };

    return (
        <div className={getClassName()} role="alert">
            <span className="validation-icon">{getIcon()}</span>
            <span className="validation-text">{message}</span>
        </div>
    );
};
