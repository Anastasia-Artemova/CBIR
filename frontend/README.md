# Frontend

React + Vite + TypeScript, plain CSS. Cornerstone3D (core, tools, DICOM image loader, NIfTI volume loader) is installed for the viewer pages.

```bash
npm install
npm run dev
```

## Configuration

Copy `.env.example` to `.env.local`:

- `VITE_API_BASE_URL`: backend base URL, e.g. `http://localhost:8000/api`.
- `VITE_USE_MOCK_API`: `true` uses the single fixed researcher account `researcher@radiomics.local` / `demo1234` (see `src/api/auth.ts`); set `false` once the backend exists.

## Backend contract (what the mock currently fakes)

All requests send `Authorization: Bearer <token>` after sign-in.

| Call | Request | Response |
| --- | --- | --- |
| Sign in | `POST /auth/login` `{ email, password }` | `{ token, user: { id, email, fullName } }`, 401 on bad credentials |
| Stored scans | `GET /scans` | `{ items: Scan[] }` (fields mirror `medical_image`, see `src/api/scans.ts`) |
| Upload scan | `POST /scans` multipart: `format` (`DICOM` or `NIfTI`) + one or more `files` | the stored `Scan` |
| Start search | `POST /searches` `{ medicalImageId, topK }` | `{ id, medicalImageId, topK, status }` |
| Search status | `GET /searches/{id}` | same, `status` is `queued`, `segmenting`, `extracting`, `searching`, `completed` or `failed` (with `error`) |

## Auth details

`POST {VITE_API_BASE_URL}/auth/login` with `{ "email", "password" }` returns
`{ "token": string, "user": { "id", "email", "fullName" } }`, or 401 for bad credentials.
There is no registration endpoint; accounts are created by an administrator.
