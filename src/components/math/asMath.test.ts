import { asMath } from './asMath'

describe('asMath', () => {
  it('wraps bare LaTeX', () => {
    expect(asMath('-3 \\cdot (-1) + b = -2')).toBe('$-3 \\cdot (-1) + b = -2$')
  })
  it('wraps bare equations', () => {
    expect(asMath('b = -5')).toBe('$b = -5$')
  })
  it('keeps text that already has delimiters', () => {
    expect(asMath('$b = 6$')).toBe('$b = 6$')
    expect(asMath('Also $b = 6$')).toBe('Also $b = 6$')
  })
  it('keeps plain text', () => {
    expect(asMath('Antwort 6')).toBe('Antwort 6')
    expect(asMath('  ')).toBe('')
  })
})
