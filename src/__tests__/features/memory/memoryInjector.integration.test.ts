import { buildMemoryBlock } from '@/features/memory/memoryInjector'
import { emptyProfile } from '@/features/memory/types'

// Guards the contract handlers.ts relies on: a non-empty profile yields a
// block that starts with the memory header so it is recognizable as system context.
it('produces an injectable system block for a known student', () => {
  const block = buildMemoryBlock(
    { ...emptyProfile('id-1'), preferred_name: 'Bơ' },
    []
  )
  expect(block.startsWith('📌 HỒ SƠ HỌC SINH')).toBe(true)
})
