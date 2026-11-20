import type { Mock } from 'vitest'
import {
  decodeErrorMessage,
  ImageError,
  MAX_BASE64_LENGTH,
  prepareImage,
  scaledSize,
  tooLargeMessage,
} from './image'

const drawImage = vi.fn()
const close = vi.fn()
let toDataURL: Mock<(...args: unknown[]) => string>
const sizes: { width: number; height: number }[] = []

const urlOfLength = (n: number) => `data:image/jpeg;base64,${'A'.repeat(n)}`

beforeEach(() => {
  drawImage.mockClear()
  close.mockClear()
  sizes.length = 0
  toDataURL = vi.fn<(...args: unknown[]) => string>(() => urlOfLength(1000))
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 4000, height: 3000, close })),
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    return { fillRect: vi.fn(), drawImage, fillStyle: '' } as unknown as CanvasRenderingContext2D
  } as never)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function (
    this: HTMLCanvasElement,
    ...args: unknown[]
  ) {
    sizes.push({ width: this.width, height: this.height })
    return toDataURL(...args)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('scaledSize', () => {
  it('scales the long edge down to 1600 and keeps the ratio', () => {
    expect(scaledSize(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(scaledSize(3000, 4000)).toEqual({ width: 1200, height: 1600 })
  })

  it('never enlarges', () => {
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 })
  })
})

describe('prepareImage', () => {
  it('decodes with EXIF orientation and scales a 12 MP photo to 1600 px', async () => {
    const file = new Blob(['x'], { type: 'image/jpeg' })
    const url = await prepareImage(file)
    expect(createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' })
    expect(url.startsWith('data:image/jpeg;base64,')).toBe(true)
    expect(sizes[0]).toEqual({ width: 1600, height: 1200 })
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8)
    expect(close).toHaveBeenCalled()
  })

  it('lowers the quality step by step until the payload fits', async () => {
    toDataURL
      .mockReturnValueOnce(urlOfLength(MAX_BASE64_LENGTH + 1))
      .mockReturnValueOnce(urlOfLength(MAX_BASE64_LENGTH + 1))
      .mockReturnValue(urlOfLength(MAX_BASE64_LENGTH))
    const url = await prepareImage(new Blob(['x']))
    expect(toDataURL.mock.calls.map((c) => c[1])).toEqual([0.8, 0.7, 0.6])
    expect(url.length).toBeGreaterThan(MAX_BASE64_LENGTH)
    expect(sizes.every((s) => s.width === 1600)).toBe(true)
  })

  it('shrinks the image further when the lowest quality is still too big', async () => {
    toDataURL.mockImplementation(() =>
      urlOfLength(sizes.at(-1)!.width > 1300 ? MAX_BASE64_LENGTH + 1 : 1000),
    )
    await prepareImage(new Blob(['x']))
    expect(sizes.at(-1)!.width).toBeLessThan(1600)
    expect(sizes.at(-1)!.width).toBeGreaterThan(500)
  })

  it('gives up with a clear message when nothing fits', async () => {
    toDataURL.mockReturnValue(urlOfLength(MAX_BASE64_LENGTH + 1))
    await expect(prepareImage(new Blob(['x']))).rejects.toThrow(tooLargeMessage)
    expect(close).toHaveBeenCalled()
  })

  it('reports undecodable files (e.g. HEIC in desktop Chrome) in German', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new DOMException('no decoder', 'InvalidStateError')
      }),
    )
    const err = await prepareImage(new Blob(['x'], { type: 'image/heic' })).catch((e) => e)
    expect(err).toBeInstanceOf(ImageError)
    expect(err.message).toBe(decodeErrorMessage)
  })
})
