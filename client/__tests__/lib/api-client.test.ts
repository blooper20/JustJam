import apiClient, { API_BASE_URL } from '@/lib/api-client';
import axios from 'axios';
import { getSession, signOut } from 'next-auth/react';

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
    getSession: jest.fn(),
    signOut: jest.fn(),
}));

describe('apiClient', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('기본 URL이 올바르게 설정되어 있다', () => {
        expect(apiClient.defaults.baseURL).toBe(API_BASE_URL);
    });

    it('타임아웃이 30초로 설정되어 있다', () => {
        expect(apiClient.defaults.timeout).toBe(30000);
    });

    it('요청 인터셉터에서 Authorization 헤더를 추가한다', async () => {
        const mockSession = { accessToken: 'test-token' };
        (getSession as jest.Mock).mockResolvedValue(mockSession);

        // 내부 _interceptors 접근이 어려우므로 실제 요청을 모킹하여 확인
        // Axios static mock 보다는 직접 요청 전 구성을 확인하는 것이 좋음
        const config = { headers: {} as any };
        // @ts-ignore - access private interceptor for testing
        const requestInterceptor = apiClient.interceptors.request.handlers[0].fulfilled;
        const resultConfig = await requestInterceptor(config);

        expect(resultConfig.headers.Authorization).toBe('Bearer test-token');
    });

    it('401 에러 발생 시 로그아웃을 처리한다', async () => {
        // @ts-ignore - access private interceptor for testing
        const responseInterceptor = apiClient.interceptors.response.handlers[0].rejected;

        const error = {
            response: {
                status: 401,
                data: {}
            },
            config: {}
        };

        // window.location mocking
        delete (window as any).location;
        window.location = { pathname: '/dashboard' } as any;

        try {
            await responseInterceptor(error);
        } catch (e) {
            // Expected rejection
        }

        expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/login' });
    });

    it('RFC 7807 detail이 있으면 에러 메시지로 사용한다', async () => {
        // @ts-ignore
        const responseInterceptor = apiClient.interceptors.response.handlers[0].rejected;

        const error = {
            response: {
                status: 404,
                data: {
                    detail: '프로젝트를 찾을 수 없습니다.'
                }
            },
            message: 'Original Message'
        };

        try {
            await responseInterceptor(error);
        } catch (e: any) {
            expect(e.message).toBe('프로젝트를 찾을 수 없습니다.');
        }
    });
});
