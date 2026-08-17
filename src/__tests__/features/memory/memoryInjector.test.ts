import { buildMemoryBlock } from '@/features/memory/memoryInjector'
import { emptyProfile } from '@/features/memory/types'

describe('buildMemoryBlock', () => {
  it('returns empty string when profile is null and no facts', () => {
    expect(buildMemoryBlock(null, [])).toBe('')
  })

  it('returns empty string when profile is entirely empty', () => {
    expect(buildMemoryBlock(emptyProfile('id-1'), [])).toBe('')
  })

  it('includes filled profile fields and facts', () => {
    const profile = {
      ...emptyProfile('id-1'),
      preferred_name: 'Bơ',
      address_form: 'cô - con',
      grade_level: 'lớp 5',
      current_topic: 'phân số',
      interests: ['bóng đá', 'vẽ'],
    }
    const block = buildMemoryBlock(profile, [
      {
        student_id: 'id-1',
        category: 'progress',
        key: 'đã học',
        value: 'phép nhân phân số',
        confidence: 0.9,
      },
    ])
    expect(block).toContain('Bơ')
    expect(block).toContain('cô - con')
    expect(block).toContain('lớp 5')
    expect(block).toContain('phân số')
    expect(block).toContain('bóng đá')
    expect(block).toContain('phép nhân phân số')
  })
})
