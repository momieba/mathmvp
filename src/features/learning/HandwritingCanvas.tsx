import { Eraser, Pencil, Trash2, Undo2 } from 'lucide-react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Point = { x: number; y: number; pressure: number }
type Stroke = { points: Point[]; erase: boolean }

export type HandwritingCanvasHandle = {
  /** PNG data URL (white background, max 1600 px wide) or null if nothing was drawn. */
  toImage: () => string | null
  isEmpty: () => boolean
}

const PEN_WIDTH = 2.6
const ERASER_WIDTH = 22
const EXPORT_MAX_WIDTH = 1600

/**
 * Drawing surface for handwritten solutions (stylus, finger, mouse).
 * Palm rejection: once a pen is detected, touch input is ignored.
 */
export const HandwritingCanvas = forwardRef<HandwritingCanvasHandle, { disabled?: boolean }>(
  function HandwritingCanvas({ disabled = false }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const strokes = useRef<Stroke[]>([])
    const current = useRef<Stroke | null>(null)
    const penSeen = useRef(false)
    const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
    const [count, setCount] = useState(0) // re-render toolbar state (undo/clear enabled)

    const redraw = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!
      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const s of [...strokes.current, ...(current.current ? [current.current] : [])]) {
        drawStroke(ctx, s)
      }
    }, [])

    // Keep the backing store in sync with the CSS size (sharp lines on high-DPI screens).
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
      const observer = new ResizeObserver(resize)
      observer.observe(canvas)
      return () => observer.disconnect()
    }, [redraw])

    useImperativeHandle(ref, () => ({
      isEmpty: () => !strokes.current.some((s) => !s.erase),
      toImage: () => {
        const canvas = canvasRef.current
        if (!canvas || !strokes.current.some((s) => !s.erase)) return null
        const { width, height } = canvas.getBoundingClientRect()
        const scale = Math.min(2, EXPORT_MAX_WIDTH / width)
        const out = document.createElement('canvas')
        out.width = Math.round(width * scale)
        out.height = Math.round(height * scale)
        const ctx = out.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, out.width, out.height)
        ctx.setTransform(scale, 0, 0, scale, 0, 0)
        for (const s of strokes.current) drawStroke(ctx, s, '#ffffff')
        return out.toDataURL('image/png')
      },
    }))

    function pointFrom(e: React.PointerEvent<HTMLCanvasElement>): Point {
      const rect = e.currentTarget.getBoundingClientRect()
      // Mouse/finger report 0 or 0.5 – treat as medium pressure.
      const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5
      return { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure }
    }

    function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
      if (disabled) return
      if (e.pointerType === 'pen') penSeen.current = true
      if (e.pointerType === 'touch' && penSeen.current) return // palm rejection
      e.currentTarget.setPointerCapture(e.pointerId)
      current.current = { points: [pointFrom(e)], erase: tool === 'eraser' }
      redraw()
    }

    function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!current.current) return
      // Use coalesced events for smooth lines with fast pens.
      const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
      const rect = e.currentTarget.getBoundingClientRect()
      for (const ev of events) {
        current.current.points.push({
          x: ev.clientX - rect.left,
          y: ev.clientY - rect.top,
          pressure: ev.pointerType === 'pen' && ev.pressure > 0 ? ev.pressure : 0.5,
        })
      }
      redraw()
    }

    function onPointerUp() {
      if (!current.current) return
      strokes.current.push(current.current)
      current.current = null
      setCount(strokes.current.length)
      redraw()
    }

    function undo() {
      strokes.current.pop()
      setCount(strokes.current.length)
      redraw()
    }

    function clear() {
      strokes.current = []
      setCount(0)
      redraw()
    }

    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Zeichenwerkzeuge">
          <Button
            type="button"
            size="sm"
            variant={tool === 'pen' ? 'default' : 'outline'}
            aria-pressed={tool === 'pen'}
            onClick={() => setTool('pen')}
          >
            <Pencil className="size-4" /> Stift
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tool === 'eraser' ? 'default' : 'outline'}
            aria-pressed={tool === 'eraser'}
            onClick={() => setTool('eraser')}
          >
            <Eraser className="size-4" /> Radierer
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={count === 0 || disabled} onClick={undo}>
            <Undo2 className="size-4" /> Rückgängig
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={count === 0 || disabled} onClick={clear}>
            <Trash2 className="size-4" /> Alles löschen
          </Button>
        </div>
        <canvas
          ref={canvasRef}
          aria-label="Schreibfläche für deinen Lösungsweg"
          className={cn(
            'h-80 w-full touch-none rounded-lg border bg-white sm:h-96',
            tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair',
            disabled && 'opacity-60',
          )}
          style={{
            backgroundImage:
              'linear-gradient(to bottom, transparent 31px, rgb(0 0 0 / 0.06) 32px)',
            backgroundSize: '100% 32px',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
    )
  },
)

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, eraseColor?: string) {
  const pts = stroke.points
  if (pts.length === 0) return
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (stroke.erase) {
    // On screen: punch a hole; on export: paint background colour.
    ctx.globalCompositeOperation = eraseColor ? 'source-over' : 'destination-out'
    ctx.strokeStyle = eraseColor ?? '#000'
    ctx.lineWidth = ERASER_WIDTH
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = '#111827'
  }
  if (pts.length === 1) {
    const p = pts[0]!
    ctx.beginPath()
    ctx.arc(p.x, p.y, (stroke.erase ? ERASER_WIDTH : PEN_WIDTH * (0.6 + p.pressure)) / 2, 0, Math.PI * 2)
    ctx.fillStyle = ctx.strokeStyle
    ctx.fill()
  }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    if (!stroke.erase) ctx.lineWidth = PEN_WIDTH * (0.6 + (a.pressure + b.pressure) / 2)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    // Midpoint smoothing for less jagged lines.
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    ctx.quadraticCurveTo(a.x, a.y, mx, my)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'
}
