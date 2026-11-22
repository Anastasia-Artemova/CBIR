import { apiConfig } from './config'

export const DEFAULT_TOP_K = 5

export type XnatTarget = {
  project: string
  subject: string
  experiment: string
}

export type UploadResult = {
  image_id: number
  scan_id: string
  filename: string
}

export type SegmentationResult = {
  segmentation_id: number
  filename: string
}

export type SimilarCase = {
  radiomics_id: number
  xnat_project_id: string
  xnat_subject_id: string
  xnat_experiment_id: string
  xnat_scan_id: string
  xnat_file_name: string
  mask_xnat_file_name: string
  distance: number
}

async function callBackend(path: string, options: RequestInit) {
  let response: Response
  try {
    response = await fetch(apiConfig.backendUrl + path, options)
  } catch {
    throw new Error(
      `No answer from ${path}. The server may have failed on this request. ` +
        'Open the Network tab in the browser, or try the same call in Swagger, to see the real error.',
    )
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const detail = data && data.detail ? JSON.stringify(data.detail) : response.statusText
    throw new Error(`${path} failed (error ${response.status}): ${detail}`)
  }
  return data
}

function postJson(path: string, body: object) {
  return callBackend(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function checkHealth(): Promise<boolean> {
  try {
    await callBackend('/health', { method: 'GET' })
    return true
  } catch {
    return false
  }
}

export function uploadToXnat(file: File, xnat: XnatTarget): Promise<UploadResult> {
  const form = new FormData()
  form.append('image_file', file)
  form.append('project', xnat.project)
  form.append('subject', xnat.subject)
  form.append('experiment', xnat.experiment)
  return callBackend('/upload_scan', { method: 'POST', body: form })
}

export function runSegmentation(xnat: XnatTarget, upload: UploadResult): Promise<SegmentationResult> {
  return postJson('/run_segmentation', {
    project: xnat.project,
    subject: xnat.subject,
    experiment: xnat.experiment,
    scan: upload.scan_id,
    input_file: upload.filename,
    image_id: upload.image_id,
  })
}

export function extractRadiomics(xnat: XnatTarget, upload: UploadResult, segmentation: SegmentationResult) {
  return postJson('/extract_radiomics', {
    project: xnat.project,
    subject: xnat.subject,
    experiment: xnat.experiment,
    scan: upload.scan_id,
    scan_file: upload.filename,
    segmentation_file: segmentation.filename,
    segmentation_id: segmentation.segmentation_id,
  })
}

export async function similaritySearch(
  xnat: XnatTarget,
  upload: UploadResult,
  segmentation: SegmentationResult,
  k: number,
): Promise<SimilarCase[]> {
  const data = await postJson('/similarity_search', {
    project: xnat.project,
    subject: xnat.subject,
    experiment: xnat.experiment,
    scan_id: upload.scan_id,
    scan_file: upload.filename,
    segmentation_file: segmentation.filename,
    k: k,
  })
  return data.results
}
