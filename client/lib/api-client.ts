import axios from 'axios';
import axiosRetry from 'axios-retry';
import { getSession, signOut } from 'next-auth/react';

const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export const API_BASE_URL = `${SERVER_URL}/api/v1`;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30초 타임아웃
});

// 재시도 로직 설정
axiosRetry(apiClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // 네트워크 에러 또는 5xx 서버 에러인 경우에만 재시도
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      (error.response?.status ?? 0) >= 500;
  },
});

apiClient.interceptors.request.use(async (config) => {
  const session = await getSession();
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // RFC 7807 대응: 서버에서 내려주는 detail 메시지를 에러 객체에 담음
    if (error.response?.data) {
      const data = error.response.data;
      if (data.detail && typeof data.detail === 'string') {
        error.message = data.detail;
      } else if (data.title) {
        error.message = data.title;
      }
    }

    if (error.response?.status === 401) {
      // 401 Unauthorized인 경우 세션 만료로 간주하여 로그아웃 처리
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        await signOut({ callbackUrl: '/login' });
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
