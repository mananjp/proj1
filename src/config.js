// Central API origin. Overridable via VITE_API_URL at build time.
// - Dev (vite): defaults to http://localhost:5000
// - Docker: build-arg VITE_API_URL=/api so Nginx proxies to the backend
const configured = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:5000';

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
