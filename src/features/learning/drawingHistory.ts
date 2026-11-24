// Pure logic of the drawing surface: stroke history with undo/redo (clear is undoable too) and
// the export crop. Kept free of DOM/canvas so it can be tested directly.

export type Point = { x: number; y: number; pressure: number }
export type Stroke = { points: Point[]; erase: boolean }

export const PEN_WIDTH = 2.6
export const ERASER_WIDTH = 22

/** Snapshot history; strokes are shared between snapshots, so clear/undo are cheap. */
export type History = { past: Stroke[][]; present: Stroke[]; future: Stroke[][] }

/** Undo depth; older snapshots are dropped so long sessions stay small. */
export const MAX_HISTORY = 200
const pushPast = (past: Stroke[][], present: Stroke[]) => [...past, present].slice(-MAX_HISTORY)

export const emptyHistory: History = { past: [], present: [], future: [] }

export type HistoryAction =
  { type: 'add'; stroke: Stroke } | { type: 'undo' } | { type: 'redo' } | { type: 'clear' }

export function historyReducer(state: History, action: HistoryAction): History {
  switch (action.type) {
    case 'add':
      return {
        past: pushPast(state.past, state.present),
        present: [...state.present, action.stroke],
        future: [], // a new stroke ends the redo chain
      }
    case 'undo': {
      const previous = state.past.at(-1)
      if (!previous) return state
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      }
    }
    case 'redo': {
      const [next, ...rest] = state.future
      if (!next) return state
      return { past: pushPast(state.past, state.present), present: next, future: rest }
    }
    case 'clear':
      if (state.present.length === 0) return state
      return { past: pushPast(state.past, state.present), present: [], future: [] }
  }
}

export const canUndo = (h: History) => h.past.length > 0
export const canRedo = (h: History) => h.future.length > 0
/** True if there is any pen stroke (erasing alone does not count as writing). */
export const hasInk = (strokes: readonly Stroke[]) => strokes.some((s) => !s.erase)

export type ExportPlan = {
  /** Crop rectangle in CSS px of the canvas. */
  x: number
  y: number
  width: number
  height: number
  /** Output scale (CSS px → image px). */
  scale: number
  outWidth: number
  outHeight: number
}

const EXPORT_MAX_EDGE = 1600
const EXPORT_MAX_SCALE = 2
const EXPORT_PADDING = 24
const EXPORT_MIN_SIDE = 120

/**
 * Crop to the written area (pen strokes only) plus a margin, clamped to the canvas. The scale keeps
 * the long edge at max. 1600 px (small crops are enlarged up to 2×). null = nothing written.
 */
export function planExport(
  strokes: readonly Stroke[],
  canvas: { width: number; height: number },
): ExportPlan | null {
  const ink = strokes.filter((s) => !s.erase && s.points.length > 0)
  if (ink.length === 0 || canvas.width <= 0 || canvas.height <= 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const s of ink) {
    for (const p of s.points) {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    }
  }
  const pad = EXPORT_PADDING + PEN_WIDTH * 2
  const x0 = Math.max(0, Math.floor(minX - pad))
  const y0 = Math.max(0, Math.floor(minY - pad))
  const x1 = Math.min(canvas.width, Math.ceil(maxX + pad))
  const y1 = Math.min(canvas.height, Math.ceil(maxY + pad))
  const width = Math.min(canvas.width, Math.max(EXPORT_MIN_SIDE, x1 - x0))
  const height = Math.min(canvas.height, Math.max(EXPORT_MIN_SIDE, y1 - y0))
  // keep the (possibly enlarged) rectangle inside the canvas
  const x = Math.min(x0, canvas.width - width)
  const y = Math.min(y0, canvas.height - height)

  const scale = Math.min(EXPORT_MAX_SCALE, EXPORT_MAX_EDGE / Math.max(width, height))
  return {
    x,
    y,
    width,
    height,
    scale,
    outWidth: Math.round(width * scale),
    outHeight: Math.round(height * scale),
  }
}

/** Box of the grader in the exported image: [ymin, xmin, ymax, xmax], normalised to 0–1000. */
export type Box = [number, number, number, number]

/** Where to underline a box on the canvas (CSS px): from x0 to x1 just below y. */
export type Underline = { x0: number; x1: number; y: number; top: number }

/** Maps a box of the exported (cropped) image back onto the canvas the student wrote on. */
export function boxToCanvas(box: Box, plan: Pick<ExportPlan, 'x' | 'y' | 'width' | 'height'>) {
  const [ymin, xmin, ymax, xmax] = box
  return {
    x0: plan.x + (xmin / 1000) * plan.width,
    x1: plan.x + (xmax / 1000) * plan.width,
    top: plan.y + (ymin / 1000) * plan.height,
    y: plan.y + (ymax / 1000) * plan.height,
  } satisfies Underline
}
