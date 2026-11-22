import type { SimilarCase } from '../../api/pipeline'

export type RunState =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | { phase: 'segmenting' }
  | { phase: 'extracting' }
  | { phase: 'searching' }
  | { phase: 'completed'; results: SimilarCase[] }
  | { phase: 'failed'; message: string }

const STEPS = [
  { phase: 'uploading', label: 'Uploading scan to XNAT' },
  { phase: 'segmenting', label: 'Segmenting the tumour region' },
  { phase: 'extracting', label: 'Extracting radiomic features' },
  { phase: 'searching', label: 'Searching for similar cases' },
]

type Props = { run: RunState }

export function SearchProgress({ run }: Props) {
  let current = STEPS.findIndex((step) => step.phase === run.phase)
  if (run.phase === 'completed') current = STEPS.length

  return (
    <ol className="progress">
      {STEPS.map((step, index) => {
        let state = 'pending'
        if (index < current) state = 'done'
        if (index === current) state = 'active'
        return (
          <li key={step.phase} className={`progress__step progress__step--${state}`}>
            <span className="progress__dot" aria-hidden="true" />
            <span className="progress__label">{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
