import axios from 'axios';
import { PRODUCTION_CUSTOMER_WEB_URL, PRODUCTION_SHOP_WEB_URL, resolvePublicApiBaseUrl, resolvePublicPortalUrl } from '../../../../packages/config/browser-urls.mjs';

export const API_BASE_URL = resolvePublicApiBaseUrl(import.meta.env.VITE_API_URL, import.meta.env.PROD);
export const API_ROOT_URL = API_BASE_URL.replace(/\/$/, '');
export const CUSTOMER_PORTAL_URL = resolvePublicPortalUrl(import.meta.env.VITE_CUSTOMER_URL, import.meta.env.PROD, PRODUCTION_CUSTOMER_WEB_URL, 'http://localhost:5173');
export const SHOP_PORTAL_URL = resolvePublicPortalUrl(import.meta.env.VITE_SHOP_URL, import.meta.env.PROD, PRODUCTION_SHOP_WEB_URL, 'http://localhost:5174');

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
