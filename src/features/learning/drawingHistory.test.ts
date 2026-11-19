import {
  canRedo,
  canUndo,
  emptyHistory,
  hasInk,
  historyReducer,
  MAX_HISTORY,
  planExport,
  type History,
  type HistoryAction,
  type Stroke,
} from './drawingHistory'

const stroke = (x: number, y: number, erase = false): Stroke => ({
  points: [
    { x, y, pressure: 0.5 },
    { x: x + 10, y: y + 5, pressure: 0.5 },
  ],
  erase,
})

const run = (...actions: HistoryAction[]): History => actions.reduce(historyReducer, emptyHistory)
const add = (s: Stroke): HistoryAction => ({ type: 'add', stroke: s })

describe('historyReducer', () => {
  const a = stroke(0, 0)
  const b = stroke(50, 50)
  const c = stroke(80, 80)

  it('adds strokes and undoes them one by one', () => {
    const h = run(add(a), add(b), { type: 'undo' })
    expect(h.present).toEqual([a])
    expect(canUndo(h)).toBe(true)
    expect(canRedo(h)).toBe(true)
  })

  it('redo restores the undone stroke', () => {
    const h = run(add(a), add(b), { type: 'undo' }, { type: 'redo' })
    expect(h.present).toEqual([a, b])
    expect(canRedo(h)).toBe(false)
  })

  it('a new stroke clears the redo stack', () => {
    const h = run(add(a), add(b), { type: 'undo' }, add(c))
    expect(h.present).toEqual([a, c])
    expect(canRedo(h)).toBe(false)
  })

  it('clear is undoable and redoable', () => {
    const cleared = run(add(a), add(b), { type: 'clear' })
    expect(cleared.present).toEqual([])
    const restored = historyReducer(cleared, { type: 'undo' })
    expect(restored.present).toEqual([a, b])
    expect(historyReducer(restored, { type: 'redo' }).present).toEqual([])
  })

  it('clearing an empty sheet changes nothing', () => {
    expect(run({ type: 'clear' })).toBe(emptyHistory)
  })

  it('undo/redo on empty stacks are no-ops', () => {
    expect(run({ type: 'undo' })).toBe(emptyHistory)
    expect(run({ type: 'redo' })).toBe(emptyHistory)
  })

  it('keeps at most MAX_HISTORY undo steps', () => {
    let h = emptyHistory
    for (let i = 0; i < MAX_HISTORY + 50; i++) h = historyReducer(h, add(stroke(i, 0)))
    expect(h.past).toHaveLength(MAX_HISTORY)
    expect(h.present).toHaveLength(MAX_HISTORY + 50) // nothing drawn is lost, only old undo steps
  })

  it('hasInk ignores erasers', () => {
    expect(hasInk([])).toBe(false)
    expect(hasInk([stroke(0, 0, true)])).toBe(false)
    expect(hasInk([stroke(0, 0, true), a])).toBe(true)
  })
})

describe('planExport', () => {
  const canvas = { width: 800, height: 600 }

  it('returns null if nothing was written', () => {
    expect(planExport([], canvas)).toBeNull()
    expect(planExport([stroke(10, 10, true)], canvas)).toBeNull()
  })

  it('crops to the written area plus margin, inside the canvas', () => {
    const plan = planExport([stroke(300, 200), stroke(500, 300)], canvas)!
    expect(plan.x).toBeGreaterThan(200)
    expect(plan.x).toBeLessThan(300)
    expect(plan.x + plan.width).toBeLessThanOrEqual(canvas.width)
    expect(plan.y + plan.height).toBeLessThanOrEqual(canvas.height)
    expect(plan.width).toBeLessThan(canvas.width)
    expect(plan.outWidth).toBe(Math.round(plan.width * plan.scale))
  })

  it('ignores eraser strokes for the crop', () => {
    const only = planExport([stroke(300, 200)], canvas)
    const withEraser = planExport([stroke(300, 200), stroke(10, 10, true)], canvas)
    expect(withEraser).toEqual(only)
  })

  it('clamps at the canvas border and keeps a minimum size', () => {
    const plan = planExport([stroke(2, 2)], canvas)!
    expect(plan.x).toBe(0)
    expect(plan.y).toBe(0)
    expect(plan.width).toBeGreaterThanOrEqual(120)
  })

  it('limits the long edge to 1600 px', () => {
    const plan = planExport([stroke(0, 0), stroke(3900, 100)], { width: 4000, height: 600 })!
    expect(Math.max(plan.outWidth, plan.outHeight)).toBeLessThanOrEqual(1600)
  })
})
