import { useEffect, useRef, useState } from 'react'
import { uploadScan, type Scan } from '../../api/scans'
import { DEFAULT_TOP_K, getSearch, startSearch } from '../../api/search'
import { AppHeader } from '../../components/AppHeader'
import type { LocalScan } from '../../viewer/cornerstone'
import { ScanViewer } from '../../viewer/ScanViewer'
import { CollectionPanel } from './CollectionPanel'
import { localScanFiles } from './localFiles'
import { SearchProgress, type RunState } from './SearchProgress'
import { UploadPanel } from './UploadPanel'
import './HomePage.css'

type Source = 'upload' | 'collection'

const POLL_MS = 1500

export function HomePage() {
  const [source, setSource] = useState<Source>('upload')
  const [localScan, setLocalScan] = useState<LocalScan | null>(null)
  const [storedScan, setStoredScan] = useState<Scan | null>(null)
  const [run, setRun] = useState<RunState>({ phase: 'idle' })
  const pollTimer = useRef<number | undefined>(undefined)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      window.clearTimeout(pollTimer.current)
    }
  }, [])

  const busy = run.phase === 'uploading' || run.phase === 'running'
  const locked = busy || run.phase === 'completed'
  const ready = source === 'upload' ? localScan !== null : storedScan !== null

  async function handleRun() {
    try {
      let scanId: number
      if (source === 'upload' && localScan) {
        setRun({ phase: 'uploading', progress: 0 })
        const stored = await uploadScan(localScanFiles(localScan), localScan.format, (progress) =>
          setRun({ phase: 'uploading', progress }),
        )
        scanId = stored.id
      } else if (storedScan) {
        scanId = storedScan.id
      } else {
        return
      }

      const job = await startSearch(scanId, DEFAULT_TOP_K)
      if (!mounted.current) return
      setRun({ phase: 'running', status: job.status })

      const poll = async () => {
        try {
          const current = await getSearch(job.id)
          if (!mounted.current) return
          if (current.status === 'completed') setRun({ phase: 'completed', searchId: current.id })
          else if (current.status === 'failed')
            setRun({ phase: 'failed', message: current.error || 'The analysis failed.' })
          else {
            setRun({ phase: 'running', status: current.status })
            pollTimer.current = window.setTimeout(poll, POLL_MS)
          }
        } catch (err) {
          setRun({ phase: 'failed', message: err instanceof Error ? err.message : 'Lost contact with the server.' })
        }
      }
      pollTimer.current = window.setTimeout(poll, POLL_MS)
    } catch (err) {
      setRun({ phase: 'failed', message: err instanceof Error ? err.message : 'The request failed.' })
    }
  }

  function reset() {
    window.clearTimeout(pollTimer.current)
    setRun({ phase: 'idle' })
    setLocalScan(null)
    setStoredScan(null)
  }

  return (
    <div className="app">
      <AppHeader />
      <main className="home">
        <div className="home__intro">
          <h1>similarity search</h1>
          <p>
            Choose a query scan. It will be segmented, its radiomic features extracted, and the most similar cases
            found.
          </p>
        </div>

        <div className="home__grid">
          <div className="home__main">
            <section className="card">
              <h2 className="card__title">
                <span className="card__step">1</span> Query scan
              </h2>
              <div className="tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={source === 'upload'}
                  className={source === 'upload' ? 'tabs__tab tabs__tab--active' : 'tabs__tab'}
                  onClick={() => setSource('upload')}
                  disabled={locked}
                >
                  Upload new scan
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={source === 'collection'}
                  className={source === 'collection' ? 'tabs__tab tabs__tab--active' : 'tabs__tab'}
                  onClick={() => setSource('collection')}
                  disabled={locked}
                >
                  From stored collection
                </button>
              </div>

              {source === 'upload' ? (
                <UploadPanel scan={localScan} disabled={locked} onChange={setLocalScan} />
              ) : (
                <CollectionPanel selectedId={storedScan?.id ?? null} disabled={locked} onSelect={setStoredScan} />
              )}
            </section>

            <section className="card">
              <h2 className="card__title">Preview</h2>
              <Preview source={source} localScan={localScan} storedScan={storedScan} />
            </section>
          </div>

          <aside className="home__side">
            <section className="card">
              <h2 className="card__title">
                <span className="card__step">2</span> Analyse and search
              </h2>
              {run.phase === 'idle' && (
                <>
                  <p className="muted">
                    Returns the top {DEFAULT_TOP_K} matches, ranked by a fusion of radiomic features and tumour
                    embeddings.
                  </p>
                  <button type="button" className="primary-button" disabled={!ready} onClick={handleRun}>
                    Run analysis and search
                  </button>
                  {!ready && <p className="hint">Choose a scan first.</p>}
                </>
              )}

              {run.phase !== 'idle' && <SearchProgress run={run} includeUpload={source === 'upload'} />}

              {run.phase === 'completed' && (
                <div className="result-ready">
                  <p>
                    <strong>Analysis complete.</strong> The top {DEFAULT_TOP_K} matches are ready.
                  </p>
                  <button type="button" className="primary-button" disabled title="The results page is built next">
                    View results
                  </button>
                  <button type="button" className="link-button" onClick={reset}>
                    Start a new search
                  </button>
                </div>
              )}

              {run.phase === 'failed' && (
                <div className="form-error" role="alert">
                  {run.message}{' '}
                  <button type="button" className="link-button" onClick={() => setRun({ phase: 'idle' })}>
                    Try again
                  </button>
                </div>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}

function Preview({
  source,
  localScan,
  storedScan,
}: {
  source: Source
  localScan: LocalScan | null
  storedScan: Scan | null
}) {
  if (source === 'upload') {
    if (!localScan) return <EmptyPreview text="Your scan will appear here once you choose it." />
    return (
      <>
        <ScanViewer scan={localScan} />
        <p className="hint">Scroll to change slice · drag for window/level · right-drag to zoom · middle-drag to pan</p>
      </>
    )
  }

  if (!storedScan) return <EmptyPreview text="Select a scan from the collection to see its details." />
  const details: Array<[string, unknown]> = [
    ['Project', storedScan.xnatProjectId],
    ['Subject', storedScan.xnatSubjectId],
    ['Experiment', storedScan.xnatExperimentId],
    ['Scan', storedScan.xnatScanId],
    ['File', storedScan.xnatFileName],
    ['Modality', storedScan.modality],
    ['Format', storedScan.imageFormat],
    ...Object.entries(storedScan.metadata).map(([key, value]): [string, unknown] => [humanize(key), value]),
  ]
  return (
    <>
      <EmptyPreview text="Image preview will load from XNAT once the backend is connected." />
      <dl className="details">
        {details.map(([label, value]) => (
          <div key={label} className="details__row">
            <dt>{label}</dt>
            <dd>{value === null || value === undefined || value === '' ? '—' : String(value)}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}

function EmptyPreview({ text }: { text: string }) {
  return <div className="empty-preview">{text}</div>
}

function humanize(key: string) {
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}
