import { handleApiError } from '@/lib/error-handler';
import { AxiosError, AxiosResponse } from 'axios';

describe('handleApiError', () => {
    it('RFC 7807 응답에서 detail 메시지를 추출한다', () => {
        const error = new AxiosError('Request failed');
        error.response = {
            status: 404,
            data: {
                type: 'https://justjam.ai/errors/projectnotfounderror',
                title: 'ProjectNotFoundError',
                status: 404,
                detail: '프로젝트를 찾을 수 없습니다.',
                instance: '/projects/abc123',
            },
        } as AxiosResponse;

        expect(handleApiError(error)).toBe('프로젝트를 찾을 수 없습니다.');
    });

    it('401 에러에 대해 적절한 메시지를 반환한다', () => {
        const error = new AxiosError('Unauthorized');
        error.response = { status: 401, data: {} } as AxiosResponse;

        expect(handleApiError(error)).toBe('로그인이 필요합니다.');
    });

    it('네트워크 에러를 처리한다', () => {
        const error = new AxiosError('Network Error');
        error.code = 'ERR_NETWORK';

        expect(handleApiError(error)).toBe('네트워크 연결을 확인해주세요.');
    });

    it('타임아웃 에러를 처리한다', () => {
        const error = new AxiosError('Timeout');
        error.code = 'ECONNABORTED';

        expect(handleApiError(error)).toBe('요청 시간이 초과되었습니다.');
    });
});
