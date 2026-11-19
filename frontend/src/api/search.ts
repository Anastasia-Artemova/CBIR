import { apiRequest, delay } from './client'
import { apiConfig } from './config'

export type SearchStatus = 'queued' | 'segmenting' | 'extracting' | 'searching' | 'completed' | 'failed'

export type SearchJob = {
  id: string
  medicalImageId: number
  topK: number
  status: SearchStatus
  error?: string | null
}

export const DEFAULT_TOP_K = 5

const mockJobs = new Map<string, { job: SearchJob; startedAt: number }>()
const MOCK_STAGES: SearchStatus[] = ['queued', 'segmenting', 'extracting', 'searching', 'completed']
const MOCK_STAGE_MS = 1500

export async function startSearch(medicalImageId: number, topK = DEFAULT_TOP_K): Promise<SearchJob> {
  if (apiConfig.useMock) {
    await delay(300)
    const job: SearchJob = { id: `mock-${Date.now()}`, medicalImageId, topK, status: 'queued' }
    mockJobs.set(job.id, { job, startedAt: Date.now() })
    return job
  }
  return apiRequest<SearchJob>('/searches', { method: 'POST', body: { medicalImageId, topK } })
}

export async function getSearch(id: string): Promise<SearchJob> {
  if (apiConfig.useMock) {
    const entry = mockJobs.get(id)
    if (!entry) throw new Error('Search not found.')
    const stage = Math.min(Math.floor((Date.now() - entry.startedAt) / MOCK_STAGE_MS), MOCK_STAGES.length - 1)
    return { ...entry.job, status: MOCK_STAGES[stage] }
  }
  return apiRequest<SearchJob>(`/searches/${encodeURIComponent(id)}`)
}
