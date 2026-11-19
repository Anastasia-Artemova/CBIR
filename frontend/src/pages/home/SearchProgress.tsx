import type { SearchStatus } from '../../api/search'

export type RunState =
  | { phase: 'idle' }
  | { phase: 'uploading'; progress: number }
  | { phase: 'running'; status: SearchStatus }
  | { phase: 'completed'; searchId: string }
  | { phase: 'failed'; message: string }

type Step = { key: string; label: string }

const STEPS: Step[] = [
  { key: 'upload', label: 'Uploading scan to XNAT' },
  { key: 'segmenting', label: 'Segmenting the tumour region' },
  { key: 'extracting', label: 'Extracting radiomic features and embedding' },
  { key: 'searching', label: 'Searching for similar cases' },
]

const ORDER: Record<string, number> = { upload: 0, queued: 1, segmenting: 1, extracting: 2, searching: 3, completed: 4 }

type Props = { run: RunState; includeUpload: boolean }

export function SearchProgress({ run, includeUpload }: Props) {
  const steps = includeUpload ? STEPS : STEPS.slice(1)
  const current =
    run.phase === 'uploading' ? 0 : run.phase === 'running' ? ORDER[run.status] ?? 1 : run.phase === 'completed' ? 4 : -1

  return (
    <ol className="progress">
      {steps.map((step) => {
        const index = ORDER[step.key]
        const state = index < current ? 'done' : index === current ? 'active' : 'pending'
        let detail: string | null = null
        if (state === 'active' && run.phase === 'uploading') detail = `${Math.round(run.progress * 100)}%`
        if (state === 'active' && run.phase === 'running' && run.status === 'queued') detail = 'Waiting in queue'
        return (
          <li key={step.key} className={`progress__step progress__step--${state}`}>
            <span className="progress__dot" aria-hidden="true" />
            <span className="progress__label">{step.label}</span>
            {detail && <span className="progress__detail">{detail}</span>}
          </li>
        )
      })}
    </ol>
  )
}
