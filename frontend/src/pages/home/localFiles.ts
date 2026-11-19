import type { LocalScan } from '../../viewer/cornerstone'

const IGNORED = /(^\.|^thumbs\.db$|^dicomdir$|\.(txt|json|xml|csv|md|pdf|jpg|jpeg|png|html?)$)/i
const ARCHIVE = /\.(zip|tar|tgz|gz|7z|rar)$/i

export function isNifti(name: string) {
  return /\.nii(\.gz)?$/i.test(name)
}

// One NIfTI file or the DICOM files of a single series.
export function toLocalScan(files: File[]): { scan: LocalScan } | { error: string } {
  const candidates = files.filter((file) => !IGNORED.test(file.name))
  if (candidates.length === 0) return { error: 'No DICOM or NIfTI files were found in that selection.' }

  const archives = candidates.filter((file) => ARCHIVE.test(file.name) && !isNifti(file.name))
  if (archives.length > 0) return { error: 'Archives (.zip, .gz, …) are not supported. Extract the DICOM files first.' }

  const nifti = candidates.filter((file) => isNifti(file.name))
  if (nifti.length > 0) {
    if (candidates.length > 1) return { error: 'Choose a single NIfTI file, or DICOM files only. Do not mix them.' }
    return { scan: { format: 'NIfTI', file: nifti[0] } }
  }
  return { scan: { format: 'DICOM', files: candidates } }
}

export function localScanFiles(scan: LocalScan): File[] {
  return scan.format === 'NIfTI' ? [scan.file] : scan.files
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}
