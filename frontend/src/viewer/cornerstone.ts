import { RenderingEngine, imageLoader, init as coreInit, metaData } from '@cornerstonejs/core'
import dicomImageLoader, { init as dicomImageLoaderInit } from '@cornerstonejs/dicom-image-loader'
import { cornerstoneNiftiImageLoader } from '@cornerstonejs/nifti-volume-loader'
import { createNiftiImageIdsAndCacheMetadata } from '@cornerstonejs/nifti-volume-loader'
import { PanTool, StackScrollTool, WindowLevelTool, ZoomTool, addTool, init as toolsInit } from '@cornerstonejs/tools'

let initialized = false
let renderingEngine: RenderingEngine | null = null

export const RENDERING_ENGINE_ID = 'radiomics-engine'

export function initCornerstone() {
  if (initialized) return
  // one shared engine with a small context pool; browsers allow only ~16 WebGL contexts per page
  coreInit({ rendering: { webGlContextCount: 2 } } as Parameters<typeof coreInit>[0])
  dicomImageLoaderInit({ maxWebWorkers: Math.max(1, Math.min(4, navigator.hardwareConcurrency ?? 1)) })
  imageLoader.registerImageLoader(
    'nifti',
    cornerstoneNiftiImageLoader as unknown as Parameters<typeof imageLoader.registerImageLoader>[1],
  )
  toolsInit()
  for (const tool of [WindowLevelTool, PanTool, ZoomTool, StackScrollTool]) addTool(tool)
  initialized = true
}

export function getRenderingEngine(): RenderingEngine {
  initCornerstone()
  renderingEngine ??= new RenderingEngine(RENDERING_ENGINE_ID)
  return renderingEngine
}

export type LocalScan = { format: 'DICOM'; files: File[] } | { format: 'NIfTI'; file: File }

export type LoadedStack = { imageIds: string[]; release: () => void }

export async function imageIdsForLocalScan(scan: LocalScan): Promise<LoadedStack> {
  initCornerstone()
  if (scan.format === 'NIfTI') return niftiImageIds(scan.file)
  return dicomImageIds(scan.files)
}

async function dicomImageIds(files: File[]): Promise<LoadedStack> {
  const fileManager = dicomImageLoader.wadouri.fileManager
  const dicomFiles = await filterPart10Files(files)
  const allIds = dicomFiles.map((file) => fileManager.add(file))
  const release = () => {
    for (const id of allIds) {
      fileManager.remove(Number(id.slice('dicomfile:'.length)))
    }
  }
  // loading headers to order the images correctly and skipping files that are not DICOM images.
  const results = await Promise.allSettled(allIds.map((id) => imageLoader.loadAndCacheImage(id)))
  const imageIds = allIds.filter((_, index) => results[index].status === 'fulfilled')
  if (imageIds.length === 0) {
    release()
    throw new Error('None of these files could be read as a DICOM image.')
  }
  const series = new Set(
    imageIds.map((id) => (metaData.get('generalSeriesModule', id) as { seriesInstanceUID?: string } | undefined)?.seriesInstanceUID),
  )
  if (series.size > 1) {
    release()
    throw new Error(`These files belong to ${series.size} different series. Choose the files of one series only.`)
  }
  const sorted = imageIds
    .map((id, index) => ({ id, index, key: sliceSortKey(id) }))
    .sort((a, b) => (a.key ?? a.index) - (b.key ?? b.index))
    .map((entry) => entry.id)
  return { imageIds: sorted, release }
}

async function filterPart10Files(files: File[]): Promise<File[]> {
  const marked = await Promise.all(
    files.map(async (file) => {
      const bytes = new Uint8Array(await file.slice(128, 132).arrayBuffer())
      return String.fromCharCode(...bytes) === 'DICM'
    }),
  )
  const part10 = files.filter((_, index) => marked[index])
  return part10.length > 0 ? part10 : files
}

function sliceSortKey(imageId: string): number | null {
  const plane = metaData.get('imagePlaneModule', imageId) as
    { imagePositionPatient?: number[]; rowCosines?: number[]; columnCosines?: number[] } | undefined
  const position = plane?.imagePositionPatient
  const row = plane?.rowCosines
  const column = plane?.columnCosines
  if (position && row && column) {
    const normal = [
      row[1] * column[2] - row[2] * column[1],
      row[2] * column[0] - row[0] * column[2],
      row[0] * column[1] - row[1] * column[0],
    ]
    return position[0] * normal[0] + position[1] * normal[1] + position[2] * normal[2]
  }
  const general = metaData.get('generalImageModule', imageId) as { instanceNumber?: number } | undefined
  return general?.instanceNumber ?? null
}

async function niftiImageIds(file: File): Promise<LoadedStack> {
  let blob: Blob = file
  const magic = new Uint8Array(await file.slice(0, 2).arrayBuffer())
  if (magic[0] === 0x1f && magic[1] === 0x8b) {
    blob = await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).blob()
  }
  const url = URL.createObjectURL(blob)
  const imageIds: string[] = await createNiftiImageIdsAndCacheMetadata({ url })
  if (!imageIds?.length) {
    URL.revokeObjectURL(url)
    throw new Error('This file does not look like a valid NIfTI image.')
  }
  return { imageIds, release: () => URL.revokeObjectURL(url) }
}
