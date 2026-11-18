import { render } from '@testing-library/react'
import { RichText } from './RichText'
import { splitMath } from './splitMath'

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
