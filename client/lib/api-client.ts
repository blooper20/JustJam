import axios from 'axios';
import { getSession, signOut } from 'next-auth/react';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
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
      // If 401, sign out and redirect to login
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        await signOut({ callbackUrl: '/login' });
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
