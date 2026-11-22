export const apiConfig = {
  baseUrl: (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api').replace(/\/+$/, ''),
  // true = demo login (researcher@radiomics.local / demo1234). There is no login on the backend yet.
  useMock: (import.meta.env.VITE_USE_MOCK_API ?? String(import.meta.env.DEV)) === 'true',

  // Address of the radiomics backend (no /api at the end)
  backendUrl: (import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000').replace(/\/+$/, ''),

  // The XNAT folder every new upload goes into. It must already exist in XNAT.
  xnat: {
    project: import.meta.env.VITE_XNAT_PROJECT ?? '',
    subject: import.meta.env.VITE_XNAT_SUBJECT ?? '',
    experiment: import.meta.env.VITE_XNAT_EXPERIMENT ?? '',
  },
}
