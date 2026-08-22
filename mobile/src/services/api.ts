import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { BASE_API } from './config';
import { notifyAuthSessionChanged } from './authSessionEvents';
import {
  clearAuthTokensIfCurrent,
  getAccessToken,
  getAuthTokenSnapshot,
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

type RefreshedAccess = {accessToken: string};
let refreshRequest: Promise<RefreshedAccess> | null = null;

export function isDefinitiveAuthRejection(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }
  const status = error.response?.status;
  return status === 400 || status === 401 || status === 403;
}

async function refreshAccessToken(): Promise<RefreshedAccess> {
  const snapshot = await getAuthTokenSnapshot();
  if (!snapshot) {
    throw new Error('No refresh token');
  }

  try {
    const refreshResponse = await axios.post(
      `${BASE_API}/auth/refresh`,
      {refresh_token: snapshot.refreshToken},
      {timeout: 15000},
    );
    const accessToken = refreshResponse.data?.data?.access_token;
    const refreshToken = refreshResponse.data?.data?.refresh_token;
    if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
      throw new Error('Invalid refresh response');
    }

    const updated = await updateAccessToken(
      accessToken,
      refreshToken,
      snapshot,
    );
    if (!updated) {
      throw new Error('Authentication session changed');
    }
    notifyAuthSessionChanged();
    return {accessToken};
  } catch (error) {
    if (isDefinitiveAuthRejection(error)) {
      const cleared = await clearAuthTokensIfCurrent(snapshot);
      if (cleared) {
        notifyAuthSessionChanged();
      }
    }
    throw error;
  }
}

function getRefreshRequest(): Promise<RefreshedAccess> {
  if (!refreshRequest) {
    const sharedRequest = refreshAccessToken().finally(() => {
      if (refreshRequest === sharedRequest) {
        refreshRequest = null;
      }
    });
    refreshRequest = sharedRequest;
  }
  return refreshRequest;
}

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
        const {accessToken} = await getRefreshRequest();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
