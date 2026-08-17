import { create } from 'zustand'
import { StudentProfile, MemoryFact, emptyProfile } from './types'
import { getOrCreateStudentId } from './studentIdentity'
import {
  ensureStudentRow,
  loadProfile,
  loadFacts,
  upsertProfile,
} from './repository'

interface MemoryState {
  studentId: string
  profile: StudentProfile | null
  facts: MemoryFact[]
  ready: boolean
  messagesSinceExtract: number
  bootstrap: () => Promise<void>
  applyMerge: (profile: StudentProfile, facts: MemoryFact[]) => void
  noteMessage: () => void
  resetExtractCounter: () => void
  setProfile: (patch: Partial<StudentProfile>) => void
}

function mergeFactLists(a: MemoryFact[], b: MemoryFact[]): MemoryFact[] {
  const map = new Map<string, MemoryFact>()
  for (const f of [...a, ...b]) map.set(`${f.category}|${f.key}`, f)
  return Array.from(map.values())
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  studentId: '',
  profile: null,
  facts: [],
  ready: false,
  messagesSinceExtract: 0,

  bootstrap: async () => {
    const studentId = getOrCreateStudentId()
    if (!studentId) return
    await ensureStudentRow(studentId)
    const [loaded, facts] = await Promise.all([
      loadProfile(studentId),
      loadFacts(studentId),
    ])
    set({
      studentId,
      profile: loaded ?? emptyProfile(studentId),
      facts,
      ready: true,
    })
  },

  applyMerge: (profile, facts) =>
    set((s) => ({
      profile,
      facts: mergeFactLists(s.facts, facts),
      messagesSinceExtract: 0,
    })),

  noteMessage: () =>
    set((s) => ({ messagesSinceExtract: s.messagesSinceExtract + 1 })),

  resetExtractCounter: () => set({ messagesSinceExtract: 0 }),

  setProfile: (patch) =>
    set((s) => {
      const next = { ...(s.profile ?? emptyProfile(s.studentId)), ...patch }
      void upsertProfile(next)
      return { profile: next }
    }),
}))
