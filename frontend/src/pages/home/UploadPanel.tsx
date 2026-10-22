import { useRef, useState, type DragEvent } from 'react'
import type { LocalScan } from '../../viewer/cornerstone'
import { formatBytes, localScanFiles, toLocalScan } from './localFiles'

type Props = {
  scan: LocalScan | null
  disabled: boolean
  onChange: (scan: LocalScan | null) => void
}

export function UploadPanel({ scan, disabled, onChange }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function accept(files: File[]) {
    if (files.length === 0) return
    const result = toLocalScan(files)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setError(null)
    onChange(result.scan)
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    if (!disabled) accept(Array.from(event.dataTransfer.files))
  }

  if (scan) {
    const files = localScanFiles(scan)
    const size = files.reduce((sum, file) => sum + file.size, 0)
    return (
      <div className="selected-file">
        <div>
          <div className="selected-file__name">
            {scan.format === 'NIfTI' ? scan.file.name : `${files.length} DICOM file${files.length === 1 ? '' : 's'}`}
          </div>
          <div className="selected-file__meta">
            {scan.format} · {formatBytes(size)}
          </div>
        </div>
        <button type="button" className="link-button" onClick={() => onChange(null)} disabled={disabled}>
          Remove
        </button>
      </div>
    )
  }

  return (
    <>
      <div
        className={`dropzone${dragging ? ' dropzone--active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <p className="dropzone__title">Drop a scan here</p>
        <p className="dropzone__hint">One NIfTI file (.nii, .nii.gz) or the DICOM files of one series</p>
        <div className="dropzone__actions">
          <button type="button" className="secondary-button" onClick={() => fileInput.current?.click()} disabled={disabled}>
            Choose files
          </button>
          <button type="button" className="secondary-button" onClick={() => folderInput.current?.click()} disabled={disabled}>
            Choose DICOM folder
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".dcm,.dicom,.nii,.gz,application/dicom"
          hidden
          onChange={(e) => {
            accept(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
        <input
          ref={folderInput}
          type="file"
          hidden
          {...{ webkitdirectory: '' }}
          onChange={(e) => {
            accept(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  )
}
