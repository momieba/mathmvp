import { gradeFor, oberstufePointsFor, percentOf } from './examGrade'

describe('exam grade', () => {
  it('maps percent to grades 1–6 at the bounds', () => {
    expect(gradeFor(100)).toBe(1)
    expect(gradeFor(92)).toBe(1)
    expect(gradeFor(91)).toBe(2)
    expect(gradeFor(81)).toBe(2)
    expect(gradeFor(67)).toBe(3)
    expect(gradeFor(50)).toBe(4)
    expect(gradeFor(49)).toBe(5)
    expect(gradeFor(30)).toBe(5)
    expect(gradeFor(29)).toBe(6)
    expect(gradeFor(0)).toBe(6)
  })
  it('maps percent to 0–15 points', () => {
    expect(oberstufePointsFor(100)).toBe(15)
    expect(oberstufePointsFor(95)).toBe(15)
    expect(oberstufePointsFor(94)).toBe(14)
    expect(oberstufePointsFor(50)).toBe(6)
    expect(oberstufePointsFor(33)).toBe(3)
    expect(oberstufePointsFor(19)).toBe(0)
  })
  it('computes the share of points', () => {
    expect(percentOf(6.5, 8)).toBe(81)
    expect(percentOf(0, 0)).toBe(0)
  })
})
