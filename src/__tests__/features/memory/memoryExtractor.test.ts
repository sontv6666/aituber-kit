import { parseExtraction } from '@/features/memory/memoryExtractor'

describe('parseExtraction', () => {
  it('parses a plain JSON object', () => {
    const r = parseExtraction('{"preferred_name":"Bơ"}')
    expect(r?.preferred_name).toBe('Bơ')
  })

  it('parses JSON wrapped in a ```json fence', () => {
    const r = parseExtraction('```json\n{"grade_level":"lớp 5"}\n```')
    expect(r?.grade_level).toBe('lớp 5')
  })

  it('returns null for non-JSON', () => {
    expect(parseExtraction('không có gì')).toBeNull()
  })
})
