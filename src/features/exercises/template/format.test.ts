import {
  formatNumber,
  renderText,
  singlePlaceholder,
  texCoef,
  texParen,
  texSignedTimes,
  texSignedTerm,
  texTimes,
} from './format'

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

describe('coefficient helpers', () => {
  it('texCoef omits 1 and writes -1 as a bare minus', () => {
    expect(texCoef(1)).toBe('')
    expect(texCoef(-1)).toBe('-')
    expect(texCoef(3)).toBe('3')
    expect(texCoef(-2.5)).toBe('-2{,}5')
  })

  it('texTimes never writes a factor 1', () => {
    expect(texTimes(1, 3)).toBe('3')
    expect(texTimes(1, -3)).toBe('-3')
    expect(texTimes(-1, 3)).toBe('-3')
    expect(texTimes(-1, -3)).toBe('-(-3)')
    expect(texTimes(2, 3)).toBe('2 \\cdot 3')
    expect(texTimes(2, -3)).toBe('2 \\cdot (-3)')
    expect(texTimes(-2, 0.5)).toBe('-2 \\cdot 0{,}5')
    expect(texTimes(-1, 0)).toBe('0')
  })

  it('texSignedTerm builds terms without "+ -" and "1x"', () => {
    expect(texSignedTerm(3, 'x')).toBe('+ 3x')
    expect(texSignedTerm(-3, 'x')).toBe('- 3x')
    expect(texSignedTerm(1, 'x')).toBe('+ x')
    expect(texSignedTerm(-1, 'y')).toBe('- y')
    expect(texSignedTerm(1.5, 'y')).toBe('+ 1{,}5y')
  })

  it('texParen brackets negative values only', () => {
    expect(texParen(3)).toBe('3')
    expect(texParen(-3)).toBe('(-3)')
    expect(texParen(-0.5)).toBe('(-0{,}5)')
  })

  it('texSignedTimes signs by coefficient and brackets negative values', () => {
    expect(texSignedTimes(1, -3)).toBe('+ (-3)')
    expect(texSignedTimes(-1, 3)).toBe('- 3')
    expect(texSignedTimes(-4, -3)).toBe('- 4 \\cdot (-3)')
    expect(texSignedTimes(2, 3)).toBe('+ 2 \\cdot 3')
  })
})
