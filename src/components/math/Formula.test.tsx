import { render } from '@testing-library/react'
import { Formula } from './Formula'

describe('Formula', () => {
  it('renders inline LaTeX as KaTeX markup', () => {
    const { container } = render(<Formula tex="\frac{1}{2}" />)
    expect(container.querySelector('span .katex')).toBeInTheDocument()
    expect(container.querySelector('.katex-display')).not.toBeInTheDocument()
  })

  it('renders block math in display mode', () => {
    const { container } = render(<Formula block tex="x^2" />)
    expect(container.querySelector('div .katex-display')).toBeInTheDocument()
  })

  it('does not throw on invalid LaTeX', () => {
    expect(() => render(<Formula tex="\frac{1" />)).not.toThrow()
  })

  it('keeps point coordinates unbreakable: no relation or binary operator inside the point', () => {
    for (const tex of [String.raw`B(-1 \mid -10)`, String.raw`B(-1\,|\,-10)`]) {
      const { container } = render(<Formula tex={tex} />)
      expect(container.querySelector('.mrel, .mbin')).not.toBeInTheDocument()
      expect(container.querySelector('.mpunct')).toHaveTextContent('∣')
    }
  })
})
