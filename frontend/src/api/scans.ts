import { apiRequest, apiUpload, delay } from './client'
import { apiConfig } from './config'

export type Scan = {
  id: number
  xnatProjectId: string
  xnatSubjectId: string
  xnatExperimentId: string
  xnatScanId: string
  xnatResourceLabel: string
  xnatFileName: string
  modality: string | null
  imageFormat: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type ScanFormat = 'DICOM' | 'NIfTI'

const MOCK_SCANS: Scan[] = [
  mockScan(101, 'LUNG1', 'LUNG1-001', 'E01', '2', 'CT', 'DICOM', { bodyPart: 'Chest', sliceThickness: 3, manufacturer: 'Siemens', studyDate: '2024-03-11' }),
  mockScan(102, 'LUNG1', 'LUNG1-014', 'E01', '3', 'CT', 'DICOM', { bodyPart: 'Chest', sliceThickness: 2.5, manufacturer: 'GE', studyDate: '2024-04-02' }),
  mockScan(103, 'LUNG1', 'LUNG1-027', 'E02', '1', 'CT', 'NIfTI', { bodyPart: 'Chest', sliceThickness: 1.25, manufacturer: 'Philips', studyDate: '2024-05-19' }),
  mockScan(104, 'BRATS', 'BRATS-0042', 'E01', 'T1C', 'MR', 'NIfTI', { bodyPart: 'Brain', sequence: 'T1 post-contrast', fieldStrength: '3T', studyDate: '2023-11-08' }),
  mockScan(105, 'BRATS', 'BRATS-0057', 'E01', 'FLAIR', 'MR', 'NIfTI', { bodyPart: 'Brain', sequence: 'FLAIR', fieldStrength: '1.5T', studyDate: '2023-12-15' }),
  mockScan(106, 'KITS', 'KITS-0103', 'E01', '4', 'CT', 'NIfTI', { bodyPart: 'Abdomen', phase: 'Arterial', sliceThickness: 5, studyDate: '2024-01-22' }),
  mockScan(107, 'KITS', 'KITS-0118', 'E01', '4', 'CT', 'DICOM', { bodyPart: 'Abdomen', phase: 'Portal venous', sliceThickness: 3, studyDate: '2024-02-09' }),
  mockScan(108, 'LIVER', 'LIVER-0009', 'E03', '5', 'MR', 'DICOM', { bodyPart: 'Abdomen', sequence: 'T2', fieldStrength: '3T', studyDate: '2024-06-30' }),
]

function mockScan(
  id: number,
  project: string,
  subject: string,
  experiment: string,
  scan: string,
  modality: string,
  imageFormat: ScanFormat,
  metadata: Record<string, unknown>,
): Scan {
  return {
    id,
    xnatProjectId: project,
    xnatSubjectId: subject,
    xnatExperimentId: `${subject}_${experiment}`,
    xnatScanId: scan,
    xnatResourceLabel: imageFormat,
    xnatFileName: imageFormat === 'NIfTI' ? `${subject}_${scan}.nii.gz` : `${subject}_${scan}.zip`,
    modality,
    imageFormat,
    metadata,
    createdAt: `${metadata.studyDate}T09:00:00Z`,
  }
}

export async function listScans(): Promise<Scan[]> {
  if (apiConfig.useMock) {
    await delay(400)
    return MOCK_SCANS
  }
  const { items } = await apiRequest<{ items: Scan[] }>('/scans')
  return items
}

export async function uploadScan(
  files: File[],
  format: ScanFormat,
  onProgress?: (fraction: number) => void,
): Promise<Scan> {
  if (apiConfig.useMock) {
    for (let step = 1; step <= 10; step++) {
      await delay(120)
      onProgress?.(step / 10)
    }
    const scan = mockScan(900 + Math.floor(Math.random() * 99), 'UPLOADS', 'UPLOAD', 'E01', '1', 'CT', format, {
      studyDate: new Date().toISOString().slice(0, 10),
    })
    return { ...scan, xnatFileName: files.length === 1 ? files[0].name : `${files.length} DICOM files` }
  }

  const form = new FormData()
  form.append('format', format)
  for (const file of files) form.append('files', file, file.name)
  return apiUpload<Scan>('/scans', form, onProgress)
}
