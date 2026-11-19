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
    expect(screen.getByRole('toolbar', { name: 'Zeichenwerkzeuge' })).toBeInTheDocument()
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
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Deine abgegebene Lösung' })).toBeInTheDocument()
  })

  it('lets the sheet grow with "Mehr Platz"', () => {
    render(<HandwritingCanvas />)
    expect(sheet().style.height).toBe('360px')
    fireEvent.click(button('Mehr Platz'))
    expect(sheet().style.height).toBe('520px')
  })
})
