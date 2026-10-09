export const ENV = {
  API_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787',

  GOOGLE_MAPS_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  GOOGLE_MAP_ID: import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID',

  AUTH_CLIENT_ID: import.meta.env.VITE_GOOGLE_AUTH_CLIENT_ID
};
