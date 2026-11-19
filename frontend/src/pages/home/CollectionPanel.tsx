import { useEffect, useMemo, useState } from 'react'
import { listScans, type Scan } from '../../api/scans'

type Props = {
  selectedId: number | null
  disabled: boolean
  onSelect: (scan: Scan) => void
}

export function CollectionPanel({ selectedId, disabled, onSelect }: Props) {
  const [scans, setScans] = useState<Scan[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [modality, setModality] = useState('all')

  useEffect(() => {
    let cancelled = false
    listScans()
      .then((items) => !cancelled && setScans(items))
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load scans.'))
    return () => {
      cancelled = true
    }
  }, [])

  const modalities = useMemo(
    () => Array.from(new Set((scans ?? []).map((s) => s.modality).filter((m): m is string => !!m))).sort(),
    [scans],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (scans ?? []).filter((scan) => {
      if (modality !== 'all' && scan.modality !== modality) return false
      if (!q) return true
      return [scan.xnatProjectId, scan.xnatSubjectId, scan.xnatExperimentId, scan.xnatScanId, scan.xnatFileName]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [scans, query, modality])

  if (error) return <p className="form-error">{error}</p>
  if (!scans) return <p className="muted">Loading stored scans…</p>

  return (
    <div className="collection">
      <div className="collection__filters">
        <input
          type="search"
          placeholder="Search project, subject, experiment or file"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search stored scans"
        />
        <select value={modality} onChange={(e) => setModality(e.target.value)} aria-label="Filter by modality">
          <option value="all">All modalities</option>
          {modalities.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="collection__table" role="radiogroup" aria-label="Stored scans">
        <div className="collection__row collection__row--head" aria-hidden="true">
          <span>Subject</span>
          <span>Project</span>
          <span>Scan</span>
          <span>Modality</span>
          <span>Format</span>
        </div>
        {visible.map((scan) => (
          <button
            key={scan.id}
            type="button"
            role="radio"
            aria-checked={scan.id === selectedId}
            className={`collection__row${scan.id === selectedId ? ' collection__row--selected' : ''}`}
            onClick={() => onSelect(scan)}
            disabled={disabled}
          >
            <span className="mono">{scan.xnatSubjectId}</span>
            <span>{scan.xnatProjectId}</span>
            <span className="mono">{scan.xnatScanId}</span>
            <span>{scan.modality ?? '—'}</span>
            <span>{scan.imageFormat ?? '—'}</span>
          </button>
        ))}
        {visible.length === 0 && <p className="muted collection__empty">No scans match these filters.</p>}
      </div>
    </div>
  )
}
