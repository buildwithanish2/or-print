import axios from 'axios';
import { resolveApiBaseUrl } from './api-base-url.js';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_URL, import.meta.env.PROD);
export const API_ROOT_URL = API_BASE_URL.replace(/\/$/, '');
export const SHOP_PORTAL_URL = import.meta.env.PROD
  ? 'https://shop-dashboard-one-eosin.vercel.app'
  : import.meta.env.VITE_SHOP_URL || 'http://localhost:5174';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('printqr_customer_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const freePrintToken = localStorage.getItem(`printqr_free_print_token:${window.location.pathname.split('/').filter(Boolean).pop() || ''}`);
  if (freePrintToken) config.headers['X-Free-Print-Token'] = freePrintToken;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const customMessage = error.response?.data?.message || 'Network request failed. Please check connection.';
    return Promise.reject(new ApiRequestError(
      customMessage,
      error.response?.status,
      error.response?.data?.code,
      error.response?.data?.data,
    ));
  }
);
