import { useEffect, useId, useRef, useState } from 'react'
import { Enums, type Types } from '@cornerstonejs/core'
import {
  Enums as ToolEnums,
  PanTool,
  StackScrollTool,
  ToolGroupManager,
  WindowLevelTool,
  ZoomTool,
} from '@cornerstonejs/tools'
import { RENDERING_ENGINE_ID, getRenderingEngine, imageIdsForLocalScan, type LocalScan } from './cornerstone'
import './ScanViewer.css'

type Props = { scan: LocalScan }

export function ScanViewer({ scan }: Props) {
  const elementRef = useRef<HTMLDivElement>(null)
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [slice, setSlice] = useState({ index: 0, total: 0 })

  useEffect(() => {
    const element = elementRef.current
    if (!element) return
    let cancelled = false
    let release: (() => void) | undefined
    const viewportId = `viewport-${reactId}`
    const toolGroupId = `tools-${reactId}`

    const engine = getRenderingEngine()
    engine.enableElement({ viewportId, type: Enums.ViewportType.STACK, element })
    const viewport = engine.getViewport(viewportId) as Types.IStackViewport

    const toolGroup = ToolGroupManager.createToolGroup(toolGroupId)
    if (toolGroup) {
      for (const tool of [WindowLevelTool, PanTool, ZoomTool, StackScrollTool]) toolGroup.addTool(tool.toolName)
      const { MouseBindings } = ToolEnums
      toolGroup.setToolActive(WindowLevelTool.toolName, { bindings: [{ mouseButton: MouseBindings.Primary }] })
      toolGroup.setToolActive(PanTool.toolName, { bindings: [{ mouseButton: MouseBindings.Auxiliary }] })
      toolGroup.setToolActive(ZoomTool.toolName, { bindings: [{ mouseButton: MouseBindings.Secondary }] })
      toolGroup.setToolActive(StackScrollTool.toolName, { bindings: [{ mouseButton: MouseBindings.Wheel }] })
      toolGroup.addViewport(viewportId, RENDERING_ENGINE_ID)
    }

    const onSliceChange = () => {
      setSlice({ index: viewport.getCurrentImageIdIndex(), total: viewport.getImageIds().length })
    }
    element.addEventListener(Enums.Events.STACK_NEW_IMAGE, onSliceChange)

    setState('loading')
    setError(null)
    imageIdsForLocalScan(scan)
      .then(async (stack) => {
        release = stack.release
        if (cancelled) {
          stack.release()
          return
        }
        const middle = Math.floor(stack.imageIds.length / 2)
        await viewport.setStack(stack.imageIds, middle)
        if (cancelled) return
        viewport.render()
        onSliceChange()
        setState('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'The scan could not be displayed.')
        setState('error')
      })

    const resizeObserver = new ResizeObserver(() => engine.resize(true, true))
    resizeObserver.observe(element)

    return () => {
      cancelled = true
      resizeObserver.disconnect()
      element.removeEventListener(Enums.Events.STACK_NEW_IMAGE, onSliceChange)
      ToolGroupManager.destroyToolGroup(toolGroupId)
      engine.disableElement(viewportId)
      release?.()
    }
  }, [scan, reactId])

  return (
    <div className="scan-viewer">
      <div
        ref={elementRef}
        className="scan-viewer__canvas"
        onContextMenu={(e) => e.preventDefault()}
      />
      {state === 'loading' && <div className="scan-viewer__overlay">Loading scan…</div>}
      {state === 'error' && <div className="scan-viewer__overlay scan-viewer__overlay--error">{error}</div>}
      {state === 'ready' && slice.total > 0 && (
        <div className="scan-viewer__hud">
          Slice {slice.index + 1} / {slice.total}
        </div>
      )}
    </div>
  )
}
