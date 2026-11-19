import { normalizePoints } from './normalizeTex'

const P = String.raw`\,\mathpunct{|}`

describe('normalizePoints', () => {
  it('rewrites mid inside parentheses', () => {
    expect(normalizePoints(String.raw`A(2 \mid -1)`)).toBe(`A(2${P}-1)`)
    expect(normalizePoints(String.raw`A(-3 \mid 3)`)).toBe(`A(-3${P}3)`)
  })

  it('rewrites the thin-space bar spelling', () => {
    expect(normalizePoints(String.raw`A(0\,|\,3)`)).toBe(`A(0${P}3)`)
  })

  it('handles several points in one formula', () => {
    expect(normalizePoints(String.raw`A(2 \mid -1) \text{ und } B(-1 \mid -10)`)).toBe(
      String.raw`A(2${P}-1) \text{ und } B(-1${P}-10)`,
    )
  })

  it('does not touch \\middle and conditional probability', () => {
    for (const tex of [
      String.raw`\left( a \middle| b \right)`,
      String.raw`(2 \middle 3)`,
      String.raw`P(A \mid B)`,
      String.raw`(x \mid y)`,
    ])
      expect(normalizePoints(tex)).toBe(tex)
  })

  it('handles fractions, variables, \\left( and three coordinates', () => {
    expect(normalizePoints(String.raw`P(\frac{1}{2} \mid -\frac{3}{4})`)).toBe(
      String.raw`P(\frac{1}{2}${P}-\frac{3}{4})`,
    )
    expect(normalizePoints(String.raw`Q(x \mid 2)`)).toBe(String.raw`Q(x${P}2)`)
    expect(normalizePoints(String.raw`\left( 2 \mid 1 \right)`)).toBe(
      String.raw`\left(2${P}1\right)`,
    )
    expect(normalizePoints(String.raw`S(1 \mid 2 \mid 3)`)).toBe(String.raw`S(1${P}2${P}3)`)
  })

  it('leaves set-builder notation, absolute values and plain parentheses alone', () => {
    for (const tex of [String.raw`\{x \mid x > 0\}`, String.raw`(|x|+1)`, String.raw`(a+b)^2`])
      expect(normalizePoints(tex)).toBe(tex)
  })
})
