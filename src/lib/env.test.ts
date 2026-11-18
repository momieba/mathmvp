vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-key')

const { parseEnv } = await import('./env')

describe('parseEnv', () => {
  it('accepts valid values', () => {
    const valid = { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' }
    expect(parseEnv(valid)).toEqual(valid)
  })

  it('throws a helpful error on missing values', () => {
    expect(() => parseEnv({})).toThrow(/\.env\.example/)
  })
})
