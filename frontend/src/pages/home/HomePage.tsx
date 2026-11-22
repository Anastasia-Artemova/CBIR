import { useEffect, useState } from 'react'
import { apiConfig } from '../../api/config'
import {
  DEFAULT_TOP_K,
  checkHealth,
  extractRadiomics,
  runSegmentation,
  similaritySearch,
  uploadToXnat,
} from '../../api/pipeline'
import { AppHeader } from '../../components/AppHeader'
import type { LocalScan } from '../../viewer/cornerstone'
import { ScanViewer } from '../../viewer/ScanViewer'
import { ResultsList } from './ResultsList'
import { SearchProgress, type RunState } from './SearchProgress'
import { UploadPanel } from './UploadPanel'
import './HomePage.css'

export function HomePage() {
  const [scan, setScan] = useState<LocalScan | null>(null)
  const [run, setRun] = useState<RunState>({ phase: 'idle' })
  const [serverOnline, setServerOnline] = useState<boolean | null>(null)

  useEffect(() => {
    checkHealth().then(setServerOnline)
  }, [])

  // new uploads go into (set in .env.local)--> the folder in XNAT 
  const xnat = apiConfig.xnat
  const xnatSet = xnat.project !== '' && xnat.subject !== '' && xnat.experiment !== ''

  const running = run.phase !== 'idle' && run.phase !== 'completed' && run.phase !== 'failed'
  const canRun = scan !== null && xnatSet

  async function handleRun() {
    if (!scan) return
    if (scan.format !== 'NIfTI') {
      setRun({ phase: 'failed', message: 'The backend accepts NIfTI files (.nii, .nii.gz) only.' })
      return
    }

    try {
      setRun({ phase: 'uploading' })
      const upload = await uploadToXnat(scan.file, xnat)

      setRun({ phase: 'segmenting' })
      const segmentation = await runSegmentation(xnat, upload)

      setRun({ phase: 'extracting' })
      await extractRadiomics(xnat, upload, segmentation)

      setRun({ phase: 'searching' })
      const results = await similaritySearch(xnat, upload, segmentation, DEFAULT_TOP_K)

      setRun({ phase: 'completed', results: results })
    } catch (err) {
      setRun({ phase: 'failed', message: err instanceof Error ? err.message : 'Something went wrong.' })
    }
  }

  function reset() {
    setRun({ phase: 'idle' })
    setScan(null)
  }

  return (
    <div className="app">
      <AppHeader />
      <main className="home">
        <div className="home__intro">
          <h1>Similarity search</h1>
          <p>Upload a CT scan. It will be segmented, its radiomic features extracted, and the most similar cases found.</p>
        </div>

        <div className="home__grid">
          <div className="home__main">
            {/* choose a scan */}
            <section className="card">
              <h2 className="card__title">
                <span className="card__step">1</span> Query scan
              </h2>
              <UploadPanel scan={scan} disabled={run.phase !== 'idle'} onChange={setScan} />
            </section>

            {/* preview of chosen scan */}
            <section className="card">
              <h2 className="card__title">Preview</h2>
              {scan ? (
                <>
                  <ScanViewer scan={scan} />
                  <p className="hint">
                    Scroll to change slice · drag for window/level · right-drag to zoom · middle-drag to pan
                  </p>
                </>
              ) : (
                <div className="empty-preview">Your scan will appear here once you choose it.</div>
              )}
            </section>
          </div>

          {/* run the analysis */}
          <aside className="home__side">
            <section className="card">
              <h2 className="card__title">
                <span className="card__step">2</span> Analyse and search
              </h2>

              {run.phase === 'idle' && (
                <>
                  <p className="muted">Returns the top {DEFAULT_TOP_K} most similar cases, ranked by radiomic features.</p>
                  <button type="button" className="primary-button" disabled={!canRun} onClick={handleRun}>
                    Run analysis and search
                  </button>
                  {!scan && <p className="hint">Choose a scan first.</p>}
                  {!xnatSet && (
                    <p className="form-error">
                      Set VITE_XNAT_PROJECT, VITE_XNAT_SUBJECT and VITE_XNAT_EXPERIMENT in .env.local, then restart npm
                      run dev.
                    </p>
                  )}
                  {serverOnline === true && <p className="hint">Analysis server connected.</p>}
                  {serverOnline === false && (
                    <p className="form-error">Cannot reach the analysis server at {apiConfig.backendUrl}.</p>
                  )}
                </>
              )}

              {run.phase !== 'idle' && <SearchProgress run={run} />}

              {running && <p className="hint">Segmentation can take a few minutes. Keep this tab open.</p>}

              {run.phase === 'completed' && (
                <div className="result-ready">
                  <p>
                    <strong>Analysis complete.</strong>{' '}
                    {run.results.length === 0 ? 'No similar cases were found.' : 'The most similar cases are below.'}
                  </p>
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

        {/* results */}
        {run.phase === 'completed' && run.results.length > 0 && (
          <section className="card results">
            <h2 className="card__title">
              <span className="card__step">3</span> Similar cases 
            </h2>
            <ResultsList results={run.results} />
          </section>
        )}
      </main>
    </div>
  )
}
