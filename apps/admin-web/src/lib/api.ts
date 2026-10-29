import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const API_ROOT_URL = API_BASE_URL.replace(/\/$/, '');
const PRODUCTION_CUSTOMER_PORTAL_URL = 'https://customer-web-six-livid.vercel.app';
const configuredCustomerPortalUrl = import.meta.env.VITE_CUSTOMER_URL;
export const CUSTOMER_PORTAL_URL = import.meta.env.PROD
  ? (() => {
    try {
      const url = new URL(configuredCustomerPortalUrl);
      const isLocalHost = url.hostname === 'localhost'
        || url.hostname.endsWith('.localhost')
        || url.hostname === '127.0.0.1'
        || url.hostname === '[::1]';
      return url.protocol === 'https:' && !isLocalHost && !url.username && !url.password
        ? `${url.origin}${url.pathname.replace(/\/+$/, '')}`
        : PRODUCTION_CUSTOMER_PORTAL_URL;
    } catch {
      return PRODUCTION_CUSTOMER_PORTAL_URL;
    }
  })()
  : configuredCustomerPortalUrl || 'http://localhost:5173';
export const SHOP_PORTAL_URL = import.meta.env.VITE_SHOP_URL || 'http://localhost:5174';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('printqr_admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('printqr_admin_token');
      localStorage.removeItem('printqr_admin_user');
    }
    const status = error.response?.status;
    const message = status === 429
      ? 'Too many sign-in attempts. Please wait before trying again.'
      : error.response?.data?.message || (error.response
        ? 'The request could not be completed. Please try again.'
        : 'Cannot reach the OR PRINT API. Check that the API server is running and try again.');
    return Promise.reject(new Error(message));
  }
);
