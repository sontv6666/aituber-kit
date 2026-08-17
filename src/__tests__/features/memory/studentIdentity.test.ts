import { getOrCreateStudentId } from '@/features/memory/studentIdentity'

describe('getOrCreateStudentId', () => {
  beforeEach(() => localStorage.clear())

  it('creates and stores an id when none exists', () => {
    expect(localStorage.getItem('aituber-student-id')).toBeNull()
    const id = getOrCreateStudentId()
    expect(id).toMatch(/[0-9a-f-]{36}/)
    expect(localStorage.getItem('aituber-student-id')).toBe(id)
  })

  it('returns the same id on subsequent calls', () => {
    const first = getOrCreateStudentId()
    const second = getOrCreateStudentId()
    expect(second).toBe(first)
  })
})
