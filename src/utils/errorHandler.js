// 전역 에러 처리 유틸리티

// 에러 타입 정의
export const ERROR_TYPES = {
  VALIDATION: 'validation',
  NETWORK: 'network',
  RUNTIME: 'runtime',
  USER_INPUT: 'user_input'
};

// 에러 메시지 매핑
const ERROR_MESSAGES = {
  [ERROR_TYPES.VALIDATION]: {
    TEACHER_NAME_REQUIRED: '교사명을 입력해주세요.',
    SUBJECTS_REQUIRED: '담당 과목을 선택해주세요.',
    INVALID_DATA: '입력 데이터가 올바르지 않습니다.',
    SCHEDULE_GENERATION_FAILED: '시간표 생성에 실패했습니다.'
  },
  [ERROR_TYPES.NETWORK]: {
    EXPORT_FAILED: '파일 내보내기에 실패했습니다.',
    IMPORT_FAILED: '파일 가져오기에 실패했습니다.'
  },
  [ERROR_TYPES.RUNTIME]: {
    UNEXPECTED_ERROR: '예상치 못한 오류가 발생했습니다.',
    MEMORY_ERROR: '메모리 부족으로 인한 오류가 발생했습니다.'
  },
  [ERROR_TYPES.USER_INPUT]: {
    INVALID_FORMAT: '입력 형식이 올바르지 않습니다.',
    DUPLICATE_ENTRY: '중복된 항목이 있습니다.'
  }
};

// 에러 로깅 함수
export const logError = (error, context = '') => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent
  };
  
  console.error('Application Error:', errorInfo);
  
  // 개발 환경에서만 상세 로그 출력
  if (process.env.NODE_ENV === 'development') {
    console.group('Error Details');
    console.error('Context:', context);
    console.error('Error:', error);
    console.groupEnd();
  }
};

// 사용자 친화적 에러 메시지 생성
export const getUserFriendlyMessage = (error, type = ERROR_TYPES.RUNTIME) => {
  if (error.userMessage) {
    return error.userMessage;
  }
  
  const messages = ERROR_MESSAGES[type];
  if (messages && messages[error.code]) {
    return messages[error.code];
  }
  
  return ERROR_MESSAGES[ERROR_TYPES.RUNTIME].UNEXPECTED_ERROR;
};

// 에러 처리 래퍼 함수
export const handleError = (error, context = '', type = ERROR_TYPES.RUNTIME) => {
  logError(error, context);
  
  const userMessage = getUserFriendlyMessage(error, type);
  
  // 사용자에게 알림 (선택적)
  if (typeof window !== 'undefined' && window.alert) {
    alert(userMessage);
  }
  
  return {
    success: false,
    error: userMessage,
    originalError: error
  };
};

// 비동기 함수 에러 처리 래퍼
export const asyncErrorHandler = (asyncFn) => {
  return async (...args) => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      return handleError(error, 'Async function execution');
    }
  };
};

// 입력 검증 에러 생성
export const createValidationError = (message, field = '') => {
  const error = new Error(message);
  error.type = ERROR_TYPES.VALIDATION;
  error.field = field;
  error.userMessage = message;
  return error;
};

// 네트워크 에러 생성
export const createNetworkError = (message) => {
  const error = new Error(message);
  error.type = ERROR_TYPES.NETWORK;
  error.userMessage = message;
  return error;
}; 