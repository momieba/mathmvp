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

/** Returns a `data:image/jpeg;base64,…` URL with at most 1600 px on the long edge and ≤ ~1.2 MB Base64. */
export async function prepareImage(file: Blob): Promise<string> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new ImageError(decodeErrorMessage)
  }
  try {
    let edge = MAX_EDGE
    while (true) {
      const { width, height } = scaledSize(bitmap.width, bitmap.height, edge)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new ImageError(decodeErrorMessage)
      ctx.fillStyle = '#ffffff' // JPEG has no transparency
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(bitmap, 0, 0, width, height)
      for (const quality of QUALITIES) {
        const url = canvas.toDataURL('image/jpeg', quality)
        if (!url.startsWith('data:image/jpeg')) throw new ImageError(decodeErrorMessage)
        if (base64Length(url) <= MAX_BASE64_LENGTH) return url
      }
      if (Math.max(width, height) <= MIN_EDGE) throw new ImageError(tooLargeMessage)
      edge = Math.max(MIN_EDGE, Math.round(Math.max(width, height) * SHRINK_FACTOR))
    }
  } finally {
    bitmap.close?.()
  }
}
