export const apiConfig = {
  baseUrl: (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api').replace(/\/+$/, ''),
  // Mock mode defaults to on in development and off in production builds.
  useMock: (import.meta.env.VITE_USE_MOCK_API ?? String(import.meta.env.DEV)) === 'true',
}
