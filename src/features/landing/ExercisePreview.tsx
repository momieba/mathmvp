import { Formula } from '@/components/math/Formula'

/** Static product preview: an example exercise with solution steps, rendered with real KaTeX. */
export function ExercisePreview() {
  return (
    <figure
      aria-label="Beispielaufgabe mit Lösungsweg"
      className="bg-card shadow-primary/10 relative rounded-2xl border p-6 shadow-xl"
    >
      <div className="text-muted-foreground mb-4 flex items-center justify-between text-xs">
        <span className="bg-secondary rounded-full px-2.5 py-1 font-medium">
          Klasse 9 · Satz des Pythagoras
        </span>
        <span>mittel</span>
      </div>
      <p className="text-foreground mb-4 text-sm leading-relaxed">
        Eine Leiter ist 5 m lang und steht 3 m von der Wand entfernt. In welcher Höhe lehnt sie an
        der Wand?
      </p>
      <ol className="space-y-3 text-sm">
        <li className="flex items-baseline gap-3">
          <StepNumber n={1} />
          <Formula tex="a^2 + b^2 = c^2" />
        </li>
        <li className="flex items-baseline gap-3">
          <StepNumber n={2} />
          <Formula tex="h^2 = 5^2 - 3^2 = 25 - 9 = 16" />
        </li>
        <li className="flex items-baseline gap-3">
          <StepNumber n={3} />
          <span>
            <Formula tex="h = \sqrt{16} = 4" />
            <span className="text-muted-foreground"> – die Leiter lehnt in 4 m Höhe.</span>
          </span>
        </li>
      </ol>
      <figcaption className="text-muted-foreground mt-5 border-t pt-4 text-xs">
        Beispiel: So sieht ein Lösungsweg aus.
      </figcaption>
    </figure>
  )
}

function StepNumber({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="bg-primary text-primary-foreground grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold"
    >
      {n}
    </span>
  )
}
