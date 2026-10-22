import { ApiError, apiRequest, delay } from './client'
import { apiConfig } from './config'

export type User = {
  id: number
  email: string
  fullName: string
}

export type LoginResponse = {
  token: string
  user: User
}

export type Credentials = {
  email: string
  password: string
}

const MOCK_ACCOUNT = {
  user: { id: 1, email: 'researcher@radiomics.local', fullName: 'Researcher' } satisfies User,
  password: 'demo1234',
}

async function mockLogin({ email, password }: Credentials): Promise<LoginResponse> {
  await delay(600)
  if (email.trim().toLowerCase() !== MOCK_ACCOUNT.user.email || password !== MOCK_ACCOUNT.password) {
    throw new ApiError(401, 'Incorrect email or password.')
  }
  return { token: `mock-token-${Date.now()}`, user: MOCK_ACCOUNT.user }
}

export function login(credentials: Credentials): Promise<LoginResponse> {
  if (apiConfig.useMock) return mockLogin(credentials)
  return apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: credentials })
}
