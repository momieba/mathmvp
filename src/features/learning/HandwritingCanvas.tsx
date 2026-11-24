import { ChevronsDown, ChevronsUp, Eraser, Pencil, Redo2, Trash2, Undo2 } from 'lucide-react'
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
  boxToCanvas,
  canRedo,
  canUndo,
  emptyHistory,
  ERASER_WIDTH,
  hasInk,
  historyReducer,
  PEN_WIDTH,
  planExport,
  type Box,
  type ExportPlan,
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
  /**
   * Mistakes to underline (boxes of the grader, relative to the last exported image) with the step
   * number written next to them. Shown on top of the drawing, never exported.
   */
  marks?: readonly { box: Box; label: number }[]
}

export type Mark = NonNullable<Props['marks']>[number]

const MIN_ROWS = 18 // Karo rows of the sheet (18 × 20 px = 360 px)
const MORE_ROWS = 8
/** Start height: about 60 % of the screen height (big sheet on tablets), at least MIN_ROWS. */
const defaultRows = () =>
  typeof window === 'undefined'
    ? MIN_ROWS
    : Math.min(32, Math.max(MIN_ROWS, Math.floor((window.innerHeight * 0.6) / KARO_SIZE)))
const MAX_ROWS = 60
const MAX_ROWS_PHONE = 36 // a taller sheet is hard to reach on a phone
const maxRows = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches
    ? MAX_ROWS_PHONE
    : MAX_ROWS
const INK_FALLBACK = '#1e3fbf' // Königsblau, light theme token
const WRONG_FALLBACK = '#c2132d'
const INK_EXPORT = '#1e3fbf' // always dark ink on white for the model, also in dark mode

/**
 * Drawing surface for handwritten solutions (stylus, finger, mouse) on squared paper.
 * Pointer Events with `touch-action: none` (no scrolling while writing). Palm rejection: once a pen
 * has been seen, touch input is ignored. Undo/redo/clear via toolbar and Ctrl+Z / Ctrl+Y.
 */
export const HandwritingCanvas = forwardRef<HandwritingCanvasHandle, Props>(
  function HandwritingCanvas({ disabled = false, readOnly = false, onChange, marks }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const hintId = useId()
    const [history, dispatch] = useReducer(historyReducer, emptyHistory)
    const strokes = history.present
    const current = useRef<Stroke | null>(null)
    const penSeen = useRef(false)
    const activePointer = useRef<number | null>(null) // the pointer that owns the current stroke
    const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
    const [minRows] = useState(defaultRows)
    const [rows, setRows] = useState(minRows)
    const lastPlan = useRef<ExportPlan | null>(null) // crop of the last exported image (for marks)
    const [announcement, setAnnouncement] = useState('')
    const locked = disabled || readOnly
    // shrinking must not cut off anything that was written
    const lowestInk = strokes.reduce((m, s) => s.points.reduce((a, p) => Math.max(a, p.y), m), 0)
    const canShrink = rows > minRows && lowestInk <= (rows - MORE_ROWS) * KARO_SIZE - 20

    const strokesRef = useRef(strokes)
    useEffect(() => {
      strokesRef.current = strokes
    }, [strokes])
    const marksRef = useRef(marks)
    useEffect(() => {
      marksRef.current = marks
    }, [marks])
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
      const plan = lastPlan.current
      if (plan && marksRef.current?.length) {
        const wrong = getComputedStyle(canvas).getPropertyValue('--wrong').trim() || WRONG_FALLBACK
        for (const m of marksRef.current) drawMark(ctx, boxToCanvas(m.box, plan), m.label, wrong)
      }
    }, [])

    useEffect(() => redraw(), [strokes, marks, redraw])

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
        lastPlan.current = plan
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
      if (current.current) return // a stroke is in progress: further pointers (palm) are ignored
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      activePointer.current = e.pointerId
      current.current = {
        points: [pointOf(e, e.currentTarget.getBoundingClientRect())],
        erase: tool === 'eraser',
      }
      redraw()
    }

    function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
      const stroke = current.current
      if (!stroke || e.pointerId !== activePointer.current) return
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

    function onPointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
      const stroke = current.current
      if (!stroke || e.pointerId !== activePointer.current) return
      current.current = null
      activePointer.current = null
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
              role="group"
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
                onClick={() => setRows((r) => Math.min(maxRows(), r + MORE_ROWS))}
                disabled={disabled || rows >= maxRows()}
                className="md:ml-auto"
              />
              <ToolButton
                label="Weniger Platz"
                icon={<ChevronsUp className="size-4" />}
                onClick={() => setRows((r) => Math.max(minRows, r - MORE_ROWS))}
                disabled={disabled || !canShrink}
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
      className={cn('min-h-11 min-w-11', className)}
    >
      {icon}
      <span className="max-md:sr-only">{label}</span>
    </Button>
  )
}

/** Teacher's correction: red wavy line under the mistake, step number at its right end. */
function drawMark(
  ctx: CanvasRenderingContext2D,
  u: { x0: number; x1: number; y: number },
  label: number,
  color: string,
) {
  const y = u.y + 4
  const amp = 2.5
  const wave = 8
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(u.x0, y)
  for (let x = u.x0, up = true; x < u.x1; x += wave / 2, up = !up) {
    const nx = Math.min(u.x1, x + wave / 2)
    ctx.quadraticCurveTo((x + nx) / 2, y + (up ? -amp : amp) * 2, nx, y)
  }
  ctx.stroke()
  ctx.font = '600 15px "Recursive Variable", "Recursive", sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(label), u.x1 + 6, y)
  ctx.restore()
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
