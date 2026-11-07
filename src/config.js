// Central API origin. Overridable via VITE_API_URL at build time.
// - Local dev (Vite): defaults to http://localhost:5000 if VITE_API_URL is unset
// - Production (Single container): defaults to "" (same-origin relative paths) if VITE_API_URL is unset
// - Custom/Split deployment: pass VITE_API_URL (e.g. https://api.yourdomain.com)
const envApiUrl = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_URL : undefined;
const isDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
const defaultBase = isDev ? 'http://localhost:5000' : '';
const configured = (envApiUrl !== undefined && envApiUrl !== null) ? envApiUrl : defaultBase;

export const API_BASE = String(configured).replace(/\/+$/, '');

export const apiUrl = (path) => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

export const API_URLS = {
  auth: apiUrl('/api/auth'),
  tasks: apiUrl('/api/tasks'),
  reports: apiUrl('/api/reports'),
  settings: apiUrl('/api/settings'),
  events: apiUrl('/api/events'),
  jobs: apiUrl('/api/jobs'),
  ai: apiUrl('/api/ai'),
  health: apiUrl('/api/health')
};
