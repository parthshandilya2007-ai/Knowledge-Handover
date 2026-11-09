import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

const rawAxios = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json"
  }
});

let tokenGetter: (() => string | null) | null = null;
let tokenSetter: ((token: string | null) => void) | null = null;

export function configureApiAuth(
  getToken: () => string | null,
  setToken: (token: string | null) => void
) {
  tokenGetter = getToken;
  tokenSetter = setToken;
}

// Request interceptor: attach bearer token
rawAxios.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (tokenGetter) {
    const token = tokenGetter();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor: unwrap standard envelope and handle 401 token refresh
rawAxios.interceptors.response.use(
  (response) => {
    if (response.data && response.data.ok === true && response.data.data !== undefined) {
      return response.data.data;
    }
    return response.data;
  },
  async (error: AxiosError<{ ok?: boolean; error?: { code: string; message: string; details?: unknown } }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    const isAuthRoute =
      originalRequest?.url?.includes("/auth/login") ||
      originalRequest?.url?.includes("/auth/register") ||
      originalRequest?.url?.includes("/auth/refresh");

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return rawAxios(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken =
          refreshResponse.data?.data?.token || refreshResponse.data?.token;

        if (newAccessToken && tokenSetter) {
          tokenSetter(newAccessToken);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }
          processQueue(null, newAccessToken);
          return rawAxios(originalRequest);
        } else {
          throw new Error("No token returned on refresh");
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        if (tokenSetter) {
          tokenSetter(null);
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    const envelopeError = error.response?.data?.error;
    if (envelopeError?.message) {
      return Promise.reject(new Error(envelopeError.message));
    }

    return Promise.reject(error);
  }
);

// Typed wrapper so callers receive unwrapped T directly
export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    rawAxios.get(url, config) as unknown as Promise<T>,

  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    rawAxios.post(url, data, config) as unknown as Promise<T>,

  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    rawAxios.patch(url, data, config) as unknown as Promise<T>,

  delete: <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    rawAxios.delete(url, config) as unknown as Promise<T>
};
