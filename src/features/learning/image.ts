/**
 * Client-side preparation of a photographed solution: decode with EXIF rotation applied, scale down,
 * re-encode as JPEG (drops all EXIF data incl. GPS) until the Base64 payload fits the server limit.
 * Nothing is stored; the result only lives in memory.
 */

export const MAX_EDGE = 1600
/** Base64 characters; the server accepts 2,000,000, this leaves a buffer. */
export const MAX_BASE64_LENGTH = 1_200_000
export const QUALITIES = [0.8, 0.7, 0.6, 0.5, 0.4] as const
const SHRINK_FACTOR = 0.8
const MIN_EDGE = 500

export const decodeErrorMessage =
  'Dieses Bild konnte nicht geöffnet werden. Nimm ein neues Foto auf oder wähl ein Bild im Format JPEG, PNG oder WebP.'
export const tooLargeMessage =
  'Das Bild ist zu groß, um es zu verkleinern. Mach ein neues Foto mit weniger Details im Hintergrund.'

export class ImageError extends Error {}

export function scaledSize(width: number, height: number, maxEdge = MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function base64Length(dataUrl: string) {
  return dataUrl.length - dataUrl.indexOf(',') - 1
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void }

async function decodeWithImageElement(file: Blob): Promise<Decoded> {
  const url = URL.createObjectURL(file)
  const release = () => URL.revokeObjectURL(url)
  try {
    const img = new Image()
    img.src = url
    await img.decode() // browsers apply the EXIF orientation to <img> by default
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release }
  } catch (e) {
    release()
    throw e
  }
}

/** Decodes with EXIF rotation. Older Safari rejects the options (TypeError) or lacks createImageBitmap. */
async function decode(file: Blob): Promise<Decoded> {
  const fromBitmap = (bitmap: ImageBitmap): Decoded => ({
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    release: () => bitmap.close?.(),
  })
  try {
    return fromBitmap(await createImageBitmap(file, { imageOrientation: 'from-image' }))
  } catch (e) {
    if (e instanceof TypeError) {
      try {
        return fromBitmap(await createImageBitmap(file))
      } catch {
        // fall through to the <img> path
      }
    }
  }
  try {
    return await decodeWithImageElement(file)
  } catch {
    throw new ImageError(decodeErrorMessage)
  }
}

/** Returns a `data:image/jpeg;base64,…` URL with at most 1600 px on the long edge and ≤ ~1.2 MB Base64. */
export async function prepareImage(file: Blob): Promise<string> {
  const decoded = await decode(file)
  const canvas = document.createElement('canvas')
  try {
    let edge = MAX_EDGE
    let q = 0 // keeps the quality reached so far when the edge shrinks (no restart at 0.8)
    while (true) {
      const { width, height } = scaledSize(decoded.width, decoded.height, edge)
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new ImageError(decodeErrorMessage)
      ctx.fillStyle = '#ffffff' // JPEG has no transparency
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(decoded.source, 0, 0, width, height)
      for (; q < QUALITIES.length; q++) {
        const url = canvas.toDataURL('image/jpeg', QUALITIES[q])
        if (!url.startsWith('data:image/jpeg')) throw new ImageError(decodeErrorMessage)
        if (base64Length(url) <= MAX_BASE64_LENGTH) return url
      }
      q = QUALITIES.length - 1
      if (Math.max(width, height) <= MIN_EDGE) throw new ImageError(tooLargeMessage)
      edge = Math.max(MIN_EDGE, Math.round(Math.max(width, height) * SHRINK_FACTOR))
    }
  } finally {
    canvas.width = 0 // free the pixel buffer
    canvas.height = 0
    decoded.release()
  }
}
