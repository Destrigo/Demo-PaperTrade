import axios from 'axios';
import { demoAdapter } from '../demo/mockApi';

export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? 'https://localhost'}/api`,
  withCredentials: true,
  // Demo build: every request is answered in the browser, no backend involved.
  adapter: demoAdapter,
});

let refreshPromise: Promise<unknown> | null = null;

// Mirrors AuthProvider's state. Without a session there is no refresh cookie
// to use, so a 401 must surface as-is instead of cascading into a failing
// /auth/refresh call (two console errors for one anonymous request).
let hasSession = false;
export function setHasSession(value: boolean) {
  hasSession = value;
}

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    const isAuthEndpoint = ['/auth/refresh', '/auth/login', '/auth/register', '/auth/logout', '/auth/session']
      .some(url => originalRequest.url?.includes(url));

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      !hasSession ||
      isAuthEndpoint ||
      originalRequest._retry
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = api.post('/auth/refresh').finally(() => {
          refreshPromise = null;
        });
      }
      await refreshPromise;
      return api(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);