import type { CSSProperties, ReactNode } from 'react'
import { Formula } from '@/components/math/Formula'
import { StatusMark } from '@/components/paper/StatusMark'

// Prerendered with the landing page: static markup only, the tick animation is pure CSS.

const steps: { tex: string }[] = [
  { tex: 'a^2 + b^2 = c^2' },
  { tex: 'h^2 = 5^2 - 3^2 = 25 - 9 = 16' },
  { tex: String.raw`h = \sqrt{16} = 4` },
]

/**
 * Hero demo: an exercise on squared paper with its worked solution; the ticks in the margin are drawn
 * one after another once. Shows what exists today (model solution) – not a handwriting correction.
 */
export function ExercisePreview({ className }: { className?: string }) {
  return (
    <figure aria-label="Beispielaufgabe mit Lösungsweg" className={className}>
      <div className="text-fine mb-2 flex items-baseline justify-between">
        <span className="casual">Klasse 9, Satz des Pythagoras</span>
        <span className="text-muted-foreground">mittel</span>
      </div>
      <p className="text-prose mb-4">
        Eine Leiter ist 5 m lang und steht 3 m von der Wand entfernt. In welcher Höhe lehnt sie an
        der Wand?
      </p>
      <div className="grid-paper rounded-paper shadow-sheet border">
        <ol>
          {steps.map((step, i) => (
            <Row
              key={step.tex}
              mark={
                <div className="margin-animate" style={{ '--i': i } as CSSProperties}>
                  <StatusMark status="correct" compact />
                </div>
              }
            >
              <Formula tex={step.tex} />
            </Row>
          ))}
        </ol>
        <p className="text-prose border-t-2 px-4 py-3">
          Die Leiter lehnt in{' '}
          <mark className="bg-marker text-marker-foreground rounded-[2px] px-1 font-semibold">
            4 m
          </mark>{' '}
          Höhe an der Wand.
        </p>
      </div>
      <figcaption className="text-muted-foreground text-fine mt-3">
        So sieht ein Lösungsweg aus: jeder Schritt einzeln, zum Nachvollziehen.
      </figcaption>
    </figure>
  )
}

function Row({ children, mark }: { children: ReactNode; mark: ReactNode }) {
  return (
    <li className="grid min-h-[3.5rem] grid-cols-[minmax(0,1fr)_4.5rem] items-stretch">
      <div className="flex items-center overflow-x-auto px-4 text-lg">{children}</div>
      <div className="flex items-center border-l-2 px-3">{mark}</div>
    </li>
  )
}
