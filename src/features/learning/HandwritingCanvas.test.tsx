import { act, createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { HandwritingCanvas, type HandwritingCanvasHandle } from './HandwritingCanvas'

const ctx = new Proxy(
  {},
  {
    get: (_t, prop) => (prop === 'canvas' ? undefined : vi.fn()),
    set: () => true,
  },
)

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA')
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 800,
    height: 360,
    left: 0,
    top: 0,
    right: 800,
    bottom: 360,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
  Element.prototype.setPointerCapture = vi.fn()
  // sheet height scales with the screen: 2 × 600 px = 1200 px
  Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function draw(canvas: Element, type: 'mouse' | 'pen' | 'touch' = 'mouse', x = 40, y = 40) {
  const base = { pointerId: 1, pointerType: type, isPrimary: true, button: 0, pressure: 0.5 }
  fireEvent.pointerDown(canvas, { ...base, clientX: x, clientY: y })
  fireEvent.pointerMove(canvas, { ...base, clientX: x + 30, clientY: y + 10 })
  fireEvent.pointerUp(canvas, { ...base, clientX: x + 30, clientY: y + 10 })
}

const sheet = () => screen.getByRole('img', { name: /Schreibfläche/ })
const button = (name: string) => screen.getByRole('button', { name })

describe('HandwritingCanvas', () => {
  it('offers pen, eraser, undo, redo and clear; history tools start disabled', () => {
    render(<HandwritingCanvas />)
    expect(screen.getByRole('group', { name: 'Zeichenwerkzeuge' })).toBeInTheDocument()
    expect(button('Stift')).toHaveAttribute('aria-pressed', 'true')
    expect(button('Radierer')).toHaveAttribute('aria-pressed', 'false')
    for (const name of ['Rückgängig', 'Wiederholen', 'Leeren']) expect(button(name)).toBeDisabled()
  })

  it('describes how to use the sheet', () => {
    render(<HandwritingCanvas />)
    const describedBy = sheet().getAttribute('aria-describedby')!
    expect(document.getElementById(describedBy)).toHaveTextContent(/Strg\+Z/)
  })

  it('reports ink after a stroke and supports undo/redo by button', () => {
    const onChange = vi.fn()
    render(<HandwritingCanvas onChange={onChange} />)
    draw(sheet())
    expect(onChange).toHaveBeenLastCalledWith(true)
    expect(button('Rückgängig')).toBeEnabled()

    fireEvent.click(button('Rückgängig'))
    expect(onChange).toHaveBeenLastCalledWith(false)
    expect(button('Wiederholen')).toBeEnabled()

    fireEvent.click(button('Wiederholen'))
    expect(onChange).toHaveBeenLastCalledWith(true)
  })

  it('undoes and redoes with Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z', () => {
    const onChange = vi.fn()
    render(<HandwritingCanvas onChange={onChange} />)
    draw(sheet())
    fireEvent.keyDown(sheet(), { key: 'z', ctrlKey: true })
    expect(onChange).toHaveBeenLastCalledWith(false)
    fireEvent.keyDown(sheet(), { key: 'y', ctrlKey: true })
    expect(onChange).toHaveBeenLastCalledWith(true)
    fireEvent.keyDown(sheet(), { key: 'z', ctrlKey: true })
    fireEvent.keyDown(sheet(), { key: 'Z', ctrlKey: true, shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith(true)
  })

  it('clears the sheet and brings it back with undo', () => {
    const onChange = vi.fn()
    render(<HandwritingCanvas onChange={onChange} />)
    draw(sheet())
    fireEvent.click(button('Leeren'))
    expect(onChange).toHaveBeenLastCalledWith(false)
    expect(screen.getByRole('status')).toHaveTextContent(/Blatt geleert/)
    fireEvent.click(button('Rückgängig'))
    expect(onChange).toHaveBeenLastCalledWith(true)
  })

  it('ignores touch once a pen was seen (palm rejection)', () => {
    const onChange = vi.fn()
    render(<HandwritingCanvas onChange={onChange} />)
    fireEvent.pointerDown(sheet(), { pointerId: 2, pointerType: 'pen', isPrimary: true })
    fireEvent.pointerUp(sheet(), { pointerId: 2, pointerType: 'pen', isPrimary: true })
    fireEvent.click(button('Leeren')) // pen tap wrote a dot; clear it
    draw(sheet(), 'touch')
    expect(onChange).toHaveBeenLastCalledWith(false)
  })

  it('ignores move/up of other pointers while a pen stroke is active (palm)', () => {
    const onChange = vi.fn()
    render(<HandwritingCanvas onChange={onChange} />)
    const pen = { pointerId: 1, pointerType: 'pen', isPrimary: true, pressure: 0.5 }
    const palm = { pointerId: 7, pointerType: 'touch', isPrimary: true }
    fireEvent.pointerDown(sheet(), { ...pen, clientX: 10, clientY: 10 })
    fireEvent.pointerDown(sheet(), { ...palm, clientX: 300, clientY: 200 }) // ignored
    fireEvent.pointerMove(sheet(), { ...palm, clientX: 320, clientY: 220 }) // ignored
    fireEvent.pointerUp(sheet(), { ...palm, clientX: 320, clientY: 220 }) // must not end the stroke
    expect(onChange).toHaveBeenLastCalledWith(false) // pen stroke still open, nothing committed
    fireEvent.pointerMove(sheet(), { ...pen, clientX: 40, clientY: 20 })
    fireEvent.pointerUp(sheet(), { ...pen, clientX: 40, clientY: 20 })
    expect(onChange).toHaveBeenLastCalledWith(true)
  })

  it('exports a PNG only when something was written', () => {
    const ref = createRef<HandwritingCanvasHandle>()
    render(<HandwritingCanvas ref={ref} />)
    expect(ref.current?.isEmpty()).toBe(true)
    expect(ref.current?.toImage()).toBeNull()
    draw(sheet())
    expect(ref.current?.isEmpty()).toBe(false)
    let image: string | null = null
    act(() => {
      image = ref.current!.toImage()
    })
    expect(image).toBe('data:image/png;base64,AAAA')
  })

  it('does not draw while disabled and hides the toolbar when read-only', () => {
    const onChange = vi.fn()
    const { rerender } = render(<HandwritingCanvas disabled onChange={onChange} />)
    draw(sheet())
    expect(onChange).toHaveBeenLastCalledWith(false)
    expect(button('Stift')).toBeDisabled()

    rerender(<HandwritingCanvas readOnly />)
    expect(screen.queryByRole('group', { name: 'Zeichenwerkzeuge' })).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Deine abgegebene Lösung' })).toBeInTheDocument()
  })

  it('has no "Mehr Platz" / "Weniger Platz" any more', () => {
    render(<HandwritingCanvas />)
    expect(screen.queryByRole('button', { name: /Platz/ })).not.toBeInTheDocument()
  })

  it('is about two screen heights long, in whole Karo rows', () => {
    render(<HandwritingCanvas />)
    expect(sheet().style.height).toBe('1200px') // 2 × 600 px
    Object.defineProperty(window, 'innerHeight', { value: 777, configurable: true })
    const { unmount } = render(<HandwritingCanvas />)
    expect(screen.getAllByRole('img', { name: /Schreibfläche/ })[1]!.style.height).toBe('1560px') // ceil(1554 / 20) rows
    unmount()
  })

  it('grows on resize (rotation) but never shrinks, so nothing written is cut off', () => {
    render(<HandwritingCanvas />)
    Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true })
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(sheet().style.height).toBe('1800px')
    Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true })
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(sheet().style.height).toBe('1800px')
  })

  it('writes with a pen and sticks the toolbar to the viewport bottom on desktop', () => {
    render(<HandwritingCanvas />)
    const toolbar = screen.getByRole('group', { name: 'Zeichenwerkzeuge' })
    expect(toolbar).toHaveClass('md:sticky', 'md:bottom-0')
  })

  describe('two-finger scroll', () => {
    const finger = (id: number, x: number, y: number) => ({
      pointerId: id,
      pointerType: 'touch',
      isPrimary: id === 1,
      clientX: x,
      clientY: y,
    })

    it('discards the stroke in progress and scrolls the page by the centre movement', () => {
      const scrollBy = vi.fn()
      window.scrollBy = scrollBy as unknown as typeof window.scrollBy
      const onChange = vi.fn()
      render(<HandwritingCanvas onChange={onChange} />)
      fireEvent.pointerDown(sheet(), finger(1, 100, 300))
      fireEvent.pointerMove(sheet(), finger(1, 110, 310)) // drawing so far
      fireEvent.pointerDown(sheet(), finger(2, 200, 300)) // second finger: gesture
      fireEvent.pointerMove(sheet(), finger(1, 110, 270))
      fireEvent.pointerMove(sheet(), finger(2, 200, 270)) // centre: 305 → 270, page scrolls down by 35
      expect(scrollBy).toHaveBeenLastCalledWith(0, expect.any(Number))
      const total = scrollBy.mock.calls.reduce((sum, c) => sum + (c[1] as number), 0)
      expect(total).toBe(35)
      fireEvent.pointerUp(sheet(), finger(2, 200, 270))
      fireEvent.pointerUp(sheet(), finger(1, 110, 270))
      expect(onChange).toHaveBeenLastCalledWith(false) // nothing was committed
      expect(button('Rückgängig')).toBeDisabled()
    })

    it('does not write with the remaining finger, but writes again after all fingers are up', () => {
      window.scrollBy = vi.fn() as unknown as typeof window.scrollBy
      const onChange = vi.fn()
      render(<HandwritingCanvas onChange={onChange} />)
      fireEvent.pointerDown(sheet(), finger(1, 100, 300))
      fireEvent.pointerDown(sheet(), finger(2, 200, 300))
      fireEvent.pointerUp(sheet(), finger(2, 200, 300))
      fireEvent.pointerMove(sheet(), finger(1, 130, 330))
      fireEvent.pointerUp(sheet(), finger(1, 130, 330))
      expect(onChange).toHaveBeenLastCalledWith(false)
      draw(sheet(), 'touch')
      expect(onChange).toHaveBeenLastCalledWith(true)
    })

    it('keeps a pen stroke when two palm touches land', () => {
      window.scrollBy = vi.fn() as unknown as typeof window.scrollBy
      const onChange = vi.fn()
      render(<HandwritingCanvas onChange={onChange} />)
      const pen = { pointerId: 9, pointerType: 'pen', isPrimary: true, pressure: 0.5 }
      fireEvent.pointerDown(sheet(), { ...pen, clientX: 10, clientY: 10 })
      fireEvent.pointerDown(sheet(), finger(1, 300, 200))
      fireEvent.pointerDown(sheet(), finger(2, 340, 200))
      fireEvent.pointerMove(sheet(), { ...pen, clientX: 40, clientY: 20 })
      fireEvent.pointerUp(sheet(), { ...pen, clientX: 40, clientY: 20 })
      expect(onChange).toHaveBeenLastCalledWith(true)
    })

    it('hints at the gesture on touch devices and leaves native scrolling when locked', () => {
      const { rerender } = render(<HandwritingCanvas />)
      expect(screen.getByText('Mit zwei Fingern scrollen.')).toHaveClass(
        '[@media(pointer:coarse)]:block',
      )
      expect(sheet().style.touchAction).toBe('none')
      rerender(<HandwritingCanvas readOnly />)
      expect(screen.queryByText('Mit zwei Fingern scrollen.')).not.toBeInTheDocument()
      expect(screen.getByRole('img').style.touchAction).toBe('pan-y')
    })
  })
})
