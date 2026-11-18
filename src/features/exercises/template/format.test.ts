import { formatNumber, renderText, singlePlaceholder } from './format'

describe('formatNumber', () => {
  it('uses a German decimal comma and removes float noise', () => {
    expect(formatNumber(2.5)).toBe('2,5')
    expect(formatNumber(0.1 + 0.2)).toBe('0,3')
    expect(formatNumber(10)).toBe('10')
  })

  it('honours fixed decimals', () => {
    expect(formatNumber(5, { decimals: 1 })).toBe('5,0')
    expect(formatNumber(6.403124, { decimals: 3 })).toBe('6,403')
  })

  it('writes {,} inside LaTeX and never "-0"', () => {
    expect(formatNumber(2.5, { tex: true })).toBe('2{,}5')
    expect(formatNumber(-0.0001, { decimals: 1 })).toBe('0,0')
  })

  it('rejects non-finite values', () => {
    expect(() => formatNumber(Number.NaN)).toThrow()
  })
})

describe('renderText', () => {
  const evaluate = (e: string) => ({ a: 2.5, b: 'x', 'a*2': 5 })[e]

  it('formats placeholders depending on math mode', () => {
    expect(renderText('a = {{a}} cm, $a = {{a}}$, $$ {{a*2}} $$', evaluate)).toBe(
      'a = 2,5 cm, $a = 2{,}5$, $$ 5 $$',
    )
  })

  it('supports decimals and string values', () => {
    expect(renderText('{{a:2}} {{b}}', evaluate)).toBe('2,50 x')
  })

  it('ignores escaped dollars when detecting math mode', () => {
    expect(renderText('Preis \\$ {{a}}', evaluate)).toBe('Preis \\$ 2,5')
  })

  it('detects single placeholders', () => {
    expect(singlePlaceholder('{{ a/2 }}')).toBe('a/2')
    expect(singlePlaceholder('a = {{a}}')).toBeNull()
  })
})
