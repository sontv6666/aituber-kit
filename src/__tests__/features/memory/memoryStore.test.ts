jest.mock('@/features/memory/repository', () => ({
  ensureStudentRow: jest.fn().mockResolvedValue(undefined),
  loadProfile: jest.fn().mockResolvedValue(null),
  loadFacts: jest.fn().mockResolvedValue([]),
  upsertProfile: jest.fn().mockResolvedValue(undefined),
  upsertFacts: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/features/memory/studentIdentity', () => ({
  getOrCreateStudentId: () => 'id-1',
}))

import { useMemoryStore } from '@/features/memory/memoryStore'
import { emptyProfile } from '@/features/memory/types'

describe('memoryStore', () => {
  it('noteMessage increments the counter', () => {
    useMemoryStore.setState({ messagesSinceExtract: 0 })
    useMemoryStore.getState().noteMessage()
    expect(useMemoryStore.getState().messagesSinceExtract).toBe(1)
  })

  it('applyMerge replaces profile and resets counter', () => {
    useMemoryStore.setState({ messagesSinceExtract: 5 })
    const p = { ...emptyProfile('id-1'), preferred_name: 'Bơ' }
    useMemoryStore.getState().applyMerge(p, [])
    expect(useMemoryStore.getState().profile?.preferred_name).toBe('Bơ')
    expect(useMemoryStore.getState().messagesSinceExtract).toBe(0)
  })

  it('resetExtractCounter sets messagesSinceExtract to 0', () => {
    useMemoryStore.setState({ messagesSinceExtract: 7 })
    useMemoryStore.getState().resetExtractCounter()
    expect(useMemoryStore.getState().messagesSinceExtract).toBe(0)
  })
})
