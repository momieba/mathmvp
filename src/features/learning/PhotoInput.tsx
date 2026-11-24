import { Camera, ImagePlus } from 'lucide-react'
import { useId, useRef, useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import type { Mark } from './HandwritingCanvas'
import { ImageError, prepareImage } from './image'

type Props = {
  /** Locked while grading or when a result is shown. */
  disabled?: boolean
  /** Prepared JPEG data URL, or null when there is no photo (yet / any more). */
  onChange?: (image: string | null) => void
  /** Mistakes to underline on the preview (boxes of the grader, 0–1000 of the photo). */
  marks?: readonly Mark[]
}

/**
 * Photo path of the answer sheet: take a photo (camera on phones) or pick an image, shrink it in
 * the browser, show a preview. The image only lives in memory – no storage, no upload before submit.
 */
export function PhotoInput({ disabled = false, onChange, marks }: Props) {
  const hintId = useId()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Only the latest pick may win if the student picks again while the first one is processing.
  const pickId = useRef(0)

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // the same file can be chosen again
    if (!file) return
    // the previous photo must not stay submittable while the new one is prepared
    setPreview(null)
    onChange?.(null)
    const id = ++pickId.current
    setBusy(true)
    setError(null)
    try {
      const image = await prepareImage(file)
      if (id !== pickId.current) return
      setPreview(image)
      onChange?.(image)
    } catch (err) {
      if (id !== pickId.current) return
      setError(
        err instanceof ImageError
          ? err.message
          : 'Das Bild konnte nicht verarbeitet werden. Versuch es mit einem anderen Bild.',
      )
      setPreview(null)
      onChange?.(null)
    } finally {
      if (id === pickId.current) setBusy(false)
    }
  }

  const inputProps = {
    type: 'file',
    className: 'sr-only',
    tabIndex: -1,
    'aria-hidden': true,
    disabled: disabled || busy,
    onChange: (e: ChangeEvent<HTMLInputElement>) => void onPick(e),
  } as const

  return (
    <div className="flex flex-col gap-4 p-4">
      <p id={hintId} className="text-fine text-muted-foreground">
        Nur deinen Rechenweg fotografieren – keine Gesichter oder Namen.
      </p>

      {preview && (
        // The overlay needs the box of the image itself, so the wrapper shrinks to the image.
        <div className="relative mx-auto w-fit max-w-full">
          <img
            src={preview}
            alt="Vorschau: dein fotografierter Rechenweg"
            className="bg-background block max-h-[32rem] max-w-full rounded-lg border"
          />
          {marks && marks.length > 0 && (
            <svg
              aria-hidden="true"
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
              className="text-wrong pointer-events-none absolute inset-0 size-full overflow-visible"
            >
              {marks.map(({ box: [, xmin, ymax, xmax], label }) => (
                <g key={label}>
                  <line
                    x1={xmin}
                    x2={xmax}
                    y1={Math.min(1000, ymax + 8)}
                    y2={Math.min(1000, ymax + 8)}
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              ))}
            </svg>
          )}
          {marks?.map(({ box: [, , ymax, xmax], label }) => (
            <span
              key={label}
              aria-hidden="true"
              className="casual text-wrong absolute -translate-y-1/2 pl-1 text-base font-semibold"
              style={{ left: `${xmax / 10}%`, top: `${Math.min(100, ymax / 10 + 0.8)}%` }}
            >
              {label}
            </span>
          ))}
          {marks && marks.length > 0 && (
            <ol className="sr-only">
              {marks.map((m) => (
                <li key={m.label}>Fehler in Schritt {m.label} ist rot unterstrichen.</li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant={preview ? 'outline' : 'default'}
          className="min-h-11"
          aria-describedby={hintId}
          disabled={disabled || busy}
          onClick={() => cameraRef.current?.click()}
        >
          <Camera aria-hidden="true" />
          {preview ? 'Neues Foto' : 'Foto aufnehmen'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          aria-describedby={hintId}
          disabled={disabled || busy}
          onClick={() => galleryRef.current?.click()}
        >
          <ImagePlus aria-hidden="true" />
          Bild auswählen
        </Button>
      </div>

      <input
        {...inputProps}
        ref={cameraRef}
        accept="image/*"
        capture="environment"
        data-testid="photo-camera"
      />
      <input {...inputProps} ref={galleryRef} accept="image/*" data-testid="photo-gallery" />

      <div role="status" aria-live="polite" className="text-fine text-muted-foreground">
        {busy ? 'Das Bild wird vorbereitet …' : null}
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
