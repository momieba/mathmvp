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

  it('leaves set-builder notation, absolute values and plain parentheses alone', () => {
    for (const tex of [String.raw`\{x \mid x > 0\}`, String.raw`(|x|+1)`, String.raw`(a+b)^2`])
      expect(normalizePoints(tex)).toBe(tex)
  })
})
