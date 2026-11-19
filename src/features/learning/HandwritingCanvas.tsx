import { ChevronsDown, Eraser, Pencil, Redo2, Trash2, Undo2 } from 'lucide-react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { KARO_SIZE } from '@/components/paper/GridPaper'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  canRedo,
  canUndo,
  emptyHistory,
  ERASER_WIDTH,
  hasInk,
  historyReducer,
  PEN_WIDTH,
  planExport,
  type Point,
  type Stroke,
} from './drawingHistory'

export type HandwritingCanvasHandle = {
  /** PNG data URL (white background, cropped to the written area, max 1600 px) or null if empty. */
  toImage: () => string | null
  isEmpty: () => boolean
}

type Props = {
  /** Locked (e.g. while grading): no input, toolbar disabled, drawing stays visible. */
  disabled?: boolean
  /** Result shown: no toolbar, nothing can be changed. */
  readOnly?: boolean
  /** Called after every change of the sheet (stroke, undo, redo, clear) and once on mount. */
  onChange?: (hasInk: boolean) => void
}

const DEFAULT_ROWS = 18 // Karo rows of the sheet (18 × 20 px = 360 px)
const MORE_ROWS = 8
const MAX_ROWS = 60
const INK_FALLBACK = '#1e3fbf' // Königsblau, light theme token
const INK_EXPORT = '#1e3fbf' // always dark ink on white for the model, also in dark mode

/**
 * Drawing surface for handwritten solutions (stylus, finger, mouse) on squared paper.
 * Pointer Events with `touch-action: none` (no scrolling while writing). Palm rejection: once a pen
 * has been seen, touch input is ignored. Undo/redo/clear via toolbar and Ctrl+Z / Ctrl+Y.
 */
export const HandwritingCanvas = forwardRef<HandwritingCanvasHandle, Props>(
  function HandwritingCanvas({ disabled = false, readOnly = false, onChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const hintId = useId()
    const [history, dispatch] = useReducer(historyReducer, emptyHistory)
    const strokes = history.present
    const current = useRef<Stroke | null>(null)
    const penSeen = useRef(false)
    const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
    const [rows, setRows] = useState(DEFAULT_ROWS)
    const [announcement, setAnnouncement] = useState('')
    const locked = disabled || readOnly

    const strokesRef = useRef(strokes)
    useEffect(() => {
      strokesRef.current = strokes
    }, [strokes])
    const onChangeRef = useRef(onChange)
    useEffect(() => {
      onChangeRef.current = onChange
    }, [onChange])
    useEffect(() => {
      onChangeRef.current?.(hasInk(strokes))
    }, [strokes])

    const redraw = useCallback(() => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const color = screenInk(canvas)
      for (const s of [...strokesRef.current, ...(current.current ? [current.current] : [])]) {
        drawStroke(ctx, s, { ink: color })
      }
    }, [])

    useEffect(() => redraw(), [strokes, redraw])

    // Keep the backing store in sync with the CSS size (sharp lines on high-DPI screens) and
    // repaint when the theme changes (ink colour is a theme token).
    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const resize = () => {
        const dpr = window.devicePixelRatio || 1
        const { width, height } = canvas.getBoundingClientRect()
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(height * dpr)
        redraw()
      }
      resize()
      const resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(canvas)
      const themeObserver = new MutationObserver(redraw)
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      })
      return () => {
        resizeObserver.disconnect()
        themeObserver.disconnect()
      }
    }, [redraw])

    useImperativeHandle(ref, () => ({
      isEmpty: () => !hasInk(strokesRef.current),
      toImage: () => {
        const canvas = canvasRef.current
        if (!canvas) return null
        const { width, height } = canvas.getBoundingClientRect()
        const plan = planExport(strokesRef.current, { width, height })
        const out = document.createElement('canvas')
        const ctx = plan && out.getContext('2d')
        if (!plan || !ctx) return null
        out.width = plan.outWidth
        out.height = plan.outHeight
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, out.width, out.height)
        ctx.setTransform(plan.scale, 0, 0, plan.scale, -plan.x * plan.scale, -plan.y * plan.scale)
        for (const s of strokesRef.current) {
          drawStroke(ctx, s, { ink: INK_EXPORT, eraseColor: '#ffffff' })
        }
        return out.toDataURL('image/png')
      },
    }))

    function pointOf(ev: PointerEvent | ReactPointerEvent, rect: DOMRect): Point {
      // Mouse/finger report 0 or 0.5 – treat as medium pressure.
      const pressure = ev.pointerType === 'pen' && ev.pressure > 0 ? ev.pressure : 0.5
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top, pressure }
    }

    function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
      if (locked || !e.isPrimary) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (e.pointerType === 'pen') penSeen.current = true
      if (e.pointerType === 'touch' && penSeen.current) return // palm rejection
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      current.current = {
        points: [pointOf(e, e.currentTarget.getBoundingClientRect())],
        erase: tool === 'eraser',
      }
      redraw()
    }

    function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
      const stroke = current.current
      if (!stroke) return
      // Coalesced events give smooth lines with fast pens.
      const events = e.nativeEvent.getCoalescedEvents?.() ?? []
      const rect = e.currentTarget.getBoundingClientRect()
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      for (const ev of events.length > 0 ? events : [e.nativeEvent]) {
        const before = stroke.points.length
        stroke.points.push(pointOf(ev, rect))
        // Draw only the new segment while writing; the full repaint happens on pointer up.
        if (canvas && ctx && before > 0) {
          const dpr = window.devicePixelRatio || 1
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          drawStroke(ctx, stroke, { ink: screenInk(canvas), from: before })
        }
      }
    }

    function onPointerUp() {
      const stroke = current.current
      if (!stroke) return
      current.current = null
      dispatch({ type: 'add', stroke })
      setAnnouncement('')
    }

    function act(type: 'undo' | 'redo' | 'clear') {
      if (locked) return
      if (type === 'undo' && !canUndo(history)) return
      if (type === 'redo' && !canRedo(history)) return
      dispatch({ type })
      setAnnouncement(
        type === 'undo'
          ? 'Rückgängig gemacht.'
          : type === 'redo'
            ? 'Wiederhergestellt.'
            : 'Blatt geleert. Mit Rückgängig holst du es zurück.',
      )
    }

    function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        act(e.shiftKey ? 'redo' : 'undo')
      } else if (key === 'y') {
        e.preventDefault()
        act('redo')
      }
    }

    return (
      <div role="group" aria-label="Schreibbereich" className="flex flex-col" onKeyDown={onKeyDown}>
        <p id={hintId} className="sr-only">
          Schreib deinen Rechenweg mit Stift, Finger oder Maus auf das Karopapier. Rückgängig mit
          Strg+Z, Wiederholen mit Strg+Y. Zum Schreiben brauchst du einen Zeiger oder Touchscreen.
        </p>
        <canvas
          ref={canvasRef}
          tabIndex={locked ? -1 : 0}
          role="img"
          aria-label={readOnly ? 'Deine abgegebene Lösung' : 'Schreibfläche für deinen Lösungsweg'}
          aria-describedby={locked ? undefined : hintId}
          className={cn(
            'grid-paper block w-full touch-none select-none',
            !locked && (tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'),
            disabled && 'opacity-60',
          )}
          style={{
            height: rows * KARO_SIZE,
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
        />
        <p role="status" className="sr-only">
          {announcement}
        </p>

        {!readOnly && (
          <>
            {/* On phones the toolbar sits at the bottom edge, within thumb reach. */}
            <div
              role="toolbar"
              aria-label="Zeichenwerkzeuge"
              className="bg-background flex flex-wrap items-center gap-1 border-t-2 p-2 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:flex-nowrap max-md:justify-between max-md:px-3 max-md:pb-[max(0.5rem,env(safe-area-inset-bottom))]"
            >
              <ToolButton
                label="Stift"
                icon={<Pencil className="size-4" />}
                pressed={tool === 'pen'}
                onClick={() => setTool('pen')}
                disabled={disabled}
              />
              <ToolButton
                label="Radierer"
                icon={<Eraser className="size-4" />}
                pressed={tool === 'eraser'}
                onClick={() => setTool('eraser')}
                disabled={disabled}
              />
              <ToolButton
                label="Rückgängig"
                icon={<Undo2 className="size-4" />}
                onClick={() => act('undo')}
                disabled={disabled || !canUndo(history)}
              />
              <ToolButton
                label="Wiederholen"
                icon={<Redo2 className="size-4" />}
                onClick={() => act('redo')}
                disabled={disabled || !canRedo(history)}
              />
              <ToolButton
                label="Leeren"
                icon={<Trash2 className="size-4" />}
                onClick={() => act('clear')}
                disabled={disabled || strokes.length === 0}
              />
              <ToolButton
                label="Mehr Platz"
                icon={<ChevronsDown className="size-4" />}
                onClick={() => setRows((r) => Math.min(MAX_ROWS, r + MORE_ROWS))}
                disabled={disabled || rows >= MAX_ROWS}
                className="md:ml-auto"
              />
            </div>
          </>
        )}
      </div>
    )
  },
)

function ToolButton({
  label,
  icon,
  pressed,
  onClick,
  disabled,
  className,
}: {
  label: string
  icon: ReactNode
  pressed?: boolean
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={pressed ? 'default' : 'ghost'}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={className}
    >
      {icon}
      <span className="max-md:sr-only">{label}</span>
    </Button>
  )
}

function screenInk(canvas: HTMLCanvasElement) {
  return getComputedStyle(canvas).getPropertyValue('--koenigsblau').trim() || INK_FALLBACK
}

/** Draws a stroke (or only its segments from index `from`). `eraseColor`: paint instead of cutting a hole. */
function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  opts: { ink: string; eraseColor?: string; from?: number },
) {
  const pts = stroke.points
  if (pts.length === 0) return
  const from = opts.from ?? 1
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (stroke.erase) {
    // On screen: punch a hole; on export: paint the background colour.
    ctx.globalCompositeOperation = opts.eraseColor ? 'source-over' : 'destination-out'
    ctx.strokeStyle = opts.eraseColor ?? '#000'
    ctx.lineWidth = ERASER_WIDTH
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = opts.ink
  }
  if (pts.length === 1) {
    const p = pts[0]!
    ctx.beginPath()
    ctx.arc(
      p.x,
      p.y,
      (stroke.erase ? ERASER_WIDTH : PEN_WIDTH * (0.6 + p.pressure)) / 2,
      0,
      Math.PI * 2,
    )
    ctx.fillStyle = ctx.strokeStyle
    ctx.fill()
  }
  for (let i = Math.max(1, from); i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    if (!stroke.erase) ctx.lineWidth = PEN_WIDTH * (0.6 + (a.pressure + b.pressure) / 2)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    // Midpoint smoothing for less jagged lines.
    ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'
}
