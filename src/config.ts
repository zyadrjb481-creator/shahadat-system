// Client API configuration for separate Vercel (Frontend) and Render (Backend) deployments
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Prepends the API base URL if defined.
 * Useful when the frontend is hosted on Vercel and the backend on Render.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}
