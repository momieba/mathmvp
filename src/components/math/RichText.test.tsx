import { render } from '@testing-library/react'
import { RichText } from './RichText'
import { splitBlocks, splitMath } from './splitMath'

describe('splitBlocks', () => {
  it('extracts Markdown tables between text', () => {
    const text = 'Wertetabelle:\n\n| $x$ | 0 | 1 |\n|---|---|---|\n| $y$ | 6 | 8 |\n\nBerechne $m$.'
    expect(splitBlocks(text)).toEqual([
      { kind: 'text', text: 'Wertetabelle:' },
      { kind: 'table', header: ['$x$', '0', '1'], rows: [['$y$', '6', '8']] },
      { kind: 'text', text: 'Berechne $m$.' },
    ])
  })

  it('leaves text with stray pipes alone', () => {
    expect(splitBlocks('Betrag |x| = 3')).toEqual([{ kind: 'text', text: 'Betrag |x| = 3' }])
  })
})

describe('RichText tables', () => {
  it('renders a table with math in cells', () => {
    const { container } = render(<RichText text={'| $x$ | 1 |\n|---|---|\n| $y$ | 2 |'} />)
    expect(container.querySelectorAll('th')).toHaveLength(2)
    expect(container.querySelector('th .katex')).toBeInTheDocument()
  })
})

describe('splitMath', () => {
  it('separates text, inline and block math', () => {
    expect(splitMath('Es gilt $a^2$ und $$c = 5$$.')).toEqual([
      { kind: 'text', value: 'Es gilt ' },
      { kind: 'inline', value: 'a^2' },
      { kind: 'text', value: ' und ' },
      { kind: 'block', value: 'c = 5' },
      { kind: 'text', value: '.' },
    ])
  })

  it('keeps escaped dollars as text', () => {
    expect(splitMath('Preis: 5 \\$')).toEqual([{ kind: 'text', value: 'Preis: 5 $' }])
  })
})

describe('RichText', () => {
  it('renders KaTeX for math and bold for **text**', () => {
    const { container } = render(<RichText text={'**Achtung:** $c = 2{,}5$'} />)
    expect(container.querySelector('strong')?.textContent).toBe('Achtung:')
    expect(container.querySelector('.katex')).toBeInTheDocument()
  })
})
