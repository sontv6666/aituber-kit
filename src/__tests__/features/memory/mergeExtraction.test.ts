import { mergeExtraction } from '@/features/memory/mergeExtraction'
import { emptyProfile } from '@/features/memory/types'

describe('mergeExtraction', () => {
  it('fills empty profile fields from extraction', () => {
    const { profile } = mergeExtraction(emptyProfile('id-1'), {
      preferred_name: 'Bơ',
      grade_level: 'lớp 5',
      interests: ['bóng đá'],
    })
    expect(profile.preferred_name).toBe('Bơ')
    expect(profile.grade_level).toBe('lớp 5')
    expect(profile.interests).toEqual(['bóng đá'])
  })

  it('does not overwrite an existing value with an empty one', () => {
    const current = { ...emptyProfile('id-1'), preferred_name: 'Bơ' }
    const { profile } = mergeExtraction(current, { preferred_name: '' })
    expect(profile.preferred_name).toBe('Bơ')
  })

  it('maps facts and stamps student_id and default confidence', () => {
    const { facts } = mergeExtraction(emptyProfile('id-1'), {
      facts: [{ category: 'preference', key: 'môn thích', value: 'Toán' }],
    })
    expect(facts).toHaveLength(1)
    expect(facts[0].student_id).toBe('id-1')
    expect(facts[0].confidence).toBeGreaterThan(0)
  })
})
