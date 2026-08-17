describe('getSupabaseClient', () => {
  const OLD = process.env
  afterEach(() => {
    process.env = OLD
    jest.resetModules()
  })

  it('returns null when env vars are missing', () => {
    jest.resetModules()
    process.env = { ...OLD }
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const { getSupabaseClient, isMemoryEnabled } =
      require('@/features/memory/supabaseClient')
    expect(getSupabaseClient()).toBeNull()
    expect(isMemoryEnabled()).toBe(false)
  })

  it('returns a client when env vars are present', () => {
    jest.resetModules()
    process.env = {
      ...OLD,
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key',
    }
    const { getSupabaseClient, isMemoryEnabled } =
      require('@/features/memory/supabaseClient')
    expect(getSupabaseClient()).not.toBeNull()
    expect(isMemoryEnabled()).toBe(true)
  })
})
