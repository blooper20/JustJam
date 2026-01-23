import { toast } from 'sonner';
import { AxiosError } from 'axios';

// RFC 7807 Problem Details 타입
interface ProblemDetails {
    type: string;
    title: string;
    status: number;
    detail: string;
    instance: string;
    code?: string;
    extensions?: Record<string, unknown>;
}

// 에러 코드별 사용자 메시지
const ERROR_MESSAGES: Record<string, string> = {
    PROJECT_NOT_FOUND: '프로젝트를 찾을 수 없습니다.',
    UNAUTHORIZED: '로그인이 필요합니다.',
    FORBIDDEN: '접근 권한이 없습니다.',
    RATE_LIMIT_EXCEEDED: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    PROCESSING_TIMEOUT: '처리 시간이 초과되었습니다.',
    FILE_TOO_LARGE: '파일 크기가 너무 큽니다.',
    INVALID_FILE_TYPE: '지원하지 않는 파일 형식입니다.',
    NETWORK_ERROR: '네트워크 연결을 확인해주세요.',
    SERVER_ERROR: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
};

export function handleApiError(error: unknown): string {
    if (error instanceof AxiosError) {
        const problemDetails = error.response?.data as ProblemDetails | undefined;

        // RFC 7807 응답인 경우
        if (problemDetails?.detail) {
            return problemDetails.detail;
        }

        // 상태 코드 기반 처리
        switch (error.response?.status) {
            case 400:
                return '잘못된 요청입니다.';
            case 401:
                return '로그인이 필요합니다.';
            case 403:
                return '접근 권한이 없습니다.';
            case 404:
                return '요청한 리소스를 찾을 수 없습니다.';
            case 429:
                return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
            case 500:
                return '서버 오류가 발생했습니다.';
            default:
                break;
        }

        // 네트워크 에러
        if (error.code === 'ECONNABORTED') {
            return '요청 시간이 초과되었습니다.';
        }
        if (error.code === 'ERR_NETWORK') {
            return '네트워크 연결을 확인해주세요.';
        }
    }

    // 일반 에러
    if (error instanceof Error) {
        return error.message;
    }

    return '알 수 없는 오류가 발생했습니다.';
}

export function showErrorToast(error: unknown, title?: string) {
    const message = handleApiError(error);
    toast.error(title || '오류 발생', {
        description: message,
    });
}

export function showSuccessToast(message: string, description?: string) {
    toast.success(message, {
        description,
    });
}
