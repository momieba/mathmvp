import { Eraser, Pencil, Redo2, Trash2, Undo2 } from 'lucide-react'
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
const MAX_ROWS = 150 // 3000 px: keeps the backing store small enough for phones/tablets
const SCREENS = 2 // the sheet is about two screen heights long; the page scrolls
/** Sheet height in whole Karo rows for the current screen height. */
const rowsForScreen = () =>
  typeof window === 'undefined'
    ? MIN_ROWS
    : Math.min(MAX_ROWS, Math.max(MIN_ROWS, Math.ceil((window.innerHeight * SCREENS) / KARO_SIZE)))
const INK_FALLBACK = '#1e3fbf' // Königsblau, light theme token
const WRONG_FALLBACK = '#c2132d'
const INK_EXPORT = '#1e3fbf' // always dark ink on white for the model, also in dark mode

/**
 * Drawing surface for handwritten solutions (stylus, finger, mouse) on squared paper.
 * Pointer Events with `touch-action: none` (no scrolling while writing). One finger/pen writes, two
 * fingers scroll the page (the stroke in progress is discarded). Palm rejection: once a pen has
 * been seen, one-finger touch is ignored. Undo/redo/clear via toolbar and Ctrl+Z / Ctrl+Y.
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
    // Only grows (rotation, bigger window), so nothing written can ever be cut off and the
    // mobile address bar showing/hiding does not make the sheet jump.
    const [rows, setRows] = useState(rowsForScreen)
    const touches = useRef(new Map<number, { x: number; y: number }>()) // active fingers
    const gesture = useRef(false) // two-finger scroll in progress (until all fingers are up)
    const lastCentre = useRef<{ x: number; y: number } | null>(null)
    const lastPlan = useRef<ExportPlan | null>(null) // crop of the last exported image (for marks)
    const [announcement, setAnnouncement] = useState('')
    const locked = disabled || readOnly

    useEffect(() => {
      const onResize = () => setRows((r) => Math.max(r, rowsForScreen()))
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }, [])

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

    const centre = () => {
      const pts = [...touches.current.values()]
      return {
        x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
        y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
      }
    }

    function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
      if (locked) return // touch-action: pan-y then: the browser scrolls natively
      if (e.pointerType === 'touch') {
        touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (touches.current.size >= 2) {
          // Second finger: this is a scroll gesture, not a stroke. Drop the touch stroke (never
          // into the history); a pen stroke stays untouched (palm).
          gesture.current = true
          lastCentre.current = centre()
          if (current.current && touches.current.has(activePointer.current ?? -1)) {
            current.current = null
            activePointer.current = null
            redraw()
          }
          e.preventDefault()
          return
        }
      }
      if (!e.isPrimary || gesture.current) return
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
      if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
        touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (gesture.current) {
          if (touches.current.size >= 2 && lastCentre.current) {
            const c = centre()
            window.scrollBy(0, lastCentre.current.y - c.y)
            lastCentre.current = c
          }
          return // a remaining single finger after the gesture does not write
        }
      }
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
      if (e.pointerType === 'touch' && touches.current.delete(e.pointerId)) {
        if (touches.current.size === 0) gesture.current = false
        lastCentre.current = touches.current.size >= 2 ? centre() : null
      }
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
          Auf Touchscreens schreibt ein Finger und zwei Finger scrollen die Seite.
        </p>
        {!locked && (
          <p
            aria-hidden="true"
            className="text-fine text-muted-foreground hidden px-4 pb-1 [@media(pointer:coarse)]:block"
          >
            Mit zwei Fingern scrollen.
          </p>
        )}
        <canvas
          ref={canvasRef}
          tabIndex={locked ? -1 : 0}
          role="img"
          aria-label={readOnly ? 'Deine abgegebene Lösung' : 'Schreibfläche für deinen Lösungsweg'}
          aria-describedby={locked ? undefined : hintId}
          className={cn(
            // No own grid: the sheet around it (task + canvas) provides one continuous Karo pattern.
            'block w-full select-none',
            !locked && (tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'),
            disabled && 'opacity-60',
          )}
          style={{
            height: rows * KARO_SIZE,
            touchAction: locked ? 'pan-y' : 'none',
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
            {/* Phones: fixed at the bottom edge (thumb reach). Bigger screens: sticks to the bottom
                of the viewport, so the long sheet never needs scrolling back to the tools. */}
            <div
              role="group"
              aria-label="Zeichenwerkzeuge"
              className="bg-background flex flex-wrap items-center gap-1 border-t-2 p-2 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:flex-nowrap max-md:justify-between max-md:px-3 max-md:pb-[max(0.5rem,env(safe-area-inset-bottom))] md:sticky md:bottom-0 md:z-10"
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

/** Teacher's correction: red wavy line under the mistake, step number in a circle at its right end. */
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
  // Step number in a circle (same look as the badge in the margin note).
  const r = 10
  const cx = u.x1 + 8 + r
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(cx, y, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.font = '600 13px "Recursive Variable", "Recursive", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(label), cx, y + 0.5)
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
