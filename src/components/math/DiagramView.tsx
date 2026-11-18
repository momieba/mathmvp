import type { Diagram } from '@/features/exercises/schema'

type Point = [number, number]

/** Renders diagram data (see diagramSchema) as SVG. Function plots follow later. */
export function DiagramView({ diagram }: { diagram: Diagram }) {
  if (diagram.kind === 'table') return <TableView diagram={diagram} />
  if (diagram.kind === 'geometry') return <GeometryView diagram={diagram} />
  return null
}

function TableView({ diagram }: { diagram: Extract<Diagram, { kind: 'table' }> }) {
  return (
    <table className="my-2 border-collapse text-sm">
      <thead>
        <tr>
          {diagram.header.map((h, i) => (
            <th key={i} className="bg-secondary border px-3 py-1.5 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {diagram.rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => (
              <td key={c} className="border px-3 py-1.5 text-center">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function GeometryView({ diagram }: { diagram: Extract<Diagram, { kind: 'geometry' }> }) {
  const named = diagram.points
  const all: Point[] = [...Object.values(named), ...(diagram.labels ?? []).map((l) => l.at)]
  const xs = all.map((p) => p[0])
  const ys = all.map((p) => p[1])
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ]
  const span = Math.max(maxX - minX, maxY - minY, 1)
  const pad = span * 0.12
  // SVG y grows downwards → flip y.
  const toSvg = ([x, y]: Point): Point => [x - minX + pad, maxY - y + pad]
  const width = maxX - minX + 2 * pad
  const height = maxY - minY + 2 * pad
  const stroke = span / 120
  const font = span / 16
  const p = (name: string) => toSvg(named[name] ?? [0, 0])

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="text-foreground my-3 max-h-64 w-full max-w-sm"
      role="img"
      aria-label="Skizze zur Aufgabe"
    >
      {(diagram.polygons ?? []).map((poly, i) => (
        <polygon
          key={`poly-${i}`}
          points={poly.map((n) => p(n).join(',')).join(' ')}
          className="fill-primary/10 stroke-current"
          strokeWidth={stroke}
          strokeLinejoin="round"
        />
      ))}
      {(diagram.segments ?? []).map(([a, b], i) => {
        const [x1, y1] = p(a)
        const [x2, y2] = p(b)
        return (
          <line
            key={`seg-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className="stroke-current"
            strokeWidth={stroke}
          />
        )
      })}
      {(diagram.circles ?? []).map((c, i) => {
        const [cx, cy] = p(c.center)
        return (
          <circle
            key={`circle-${i}`}
            cx={cx}
            cy={cy}
            r={c.radius}
            className="fill-none stroke-current"
            strokeWidth={stroke}
          />
        )
      })}
      {(diagram.rightAngles ?? []).map((vertex) => (
        <RightAngle
          key={`ra-${vertex}`}
          diagram={diagram}
          vertex={vertex}
          toSvg={toSvg}
          size={span / 14}
          stroke={stroke}
        />
      ))}
      {Object.entries(named).map(([name, pt]) => {
        const [x, y] = toSvg(pt)
        return (
          <text
            key={`pt-${name}`}
            x={x}
            y={y}
            dx={-font * 0.9}
            dy={font * 1.1}
            fontSize={font * 0.9}
            className="fill-muted-foreground"
          >
            {name}
          </text>
        )
      })}
      {(diagram.labels ?? []).map((l, i) => {
        const [x, y] = toSvg(l.at)
        return (
          <text
            key={`label-${i}`}
            x={x}
            y={y}
            fontSize={font}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-current font-medium"
          >
            {l.text}
          </text>
        )
      })}
    </svg>
  )
}

/** Draws the right-angle square at `vertex`, using its two neighbours in a polygon. */
function RightAngle({
  diagram,
  vertex,
  toSvg,
  size,
  stroke,
}: {
  diagram: Extract<Diagram, { kind: 'geometry' }>
  vertex: string
  toSvg: (p: Point) => Point
  size: number
  stroke: number
}) {
  const poly = (diagram.polygons ?? []).find((ps) => ps.includes(vertex))
  const v = diagram.points[vertex]
  if (!poly || !v) return null
  const i = poly.indexOf(vertex)
  const a = diagram.points[poly[(i - 1 + poly.length) % poly.length]!]
  const b = diagram.points[poly[(i + 1) % poly.length]!]
  if (!a || !b) return null
  const unit = (q: Point): Point => {
    const d = Math.hypot(q[0] - v[0], q[1] - v[1]) || 1
    return [(q[0] - v[0]) / d, (q[1] - v[1]) / d]
  }
  const [ua, ub] = [unit(a), unit(b)]
  const p1 = toSvg([v[0] + ua[0] * size, v[1] + ua[1] * size])
  const p2 = toSvg([v[0] + (ua[0] + ub[0]) * size, v[1] + (ua[1] + ub[1]) * size])
  const p3 = toSvg([v[0] + ub[0] * size, v[1] + ub[1] * size])
  return (
    <polyline
      points={[p1, p2, p3].map((q) => q.join(',')).join(' ')}
      className="fill-none stroke-current"
      strokeWidth={stroke}
    />
  )
}
