import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { BASE_API } from './config';
import { notifyAuthSessionChanged } from './authSessionEvents';
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  updateAccessToken,
} from './authTokenStorage';

const api = axios.create({
  baseURL: BASE_API,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Mark requests we've already retried so a failing refresh can't loop forever.
type RetriableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    const isRefreshCall = originalRequest?.url?.includes('/auth/refresh');

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isRefreshCall
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        // Use a bare axios call so the request/response interceptors above
        // don't re-attach the (stale) access token or re-enter this handler.
        const refreshResponse = await axios.post(`${BASE_API}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token } = refreshResponse.data.data;

        await updateAccessToken(access_token, refresh_token);
        notifyAuthSessionChanged();

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        await clearAuthTokens();
        notifyAuthSessionChanged();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
