import {
  StudentProfile,
  MemoryFact,
  ExtractionResult,
} from './types'

function pick(existing: string | null, incoming?: string): string | null {
  const trimmed = (incoming ?? '').trim()
  return trimmed ? trimmed : existing
}

export function mergeExtraction(
  current: StudentProfile,
  extraction: ExtractionResult
): { profile: StudentProfile; facts: MemoryFact[] } {
  const profile: StudentProfile = {
    ...current,
    display_name: pick(current.display_name, extraction.display_name),
    preferred_name: pick(current.preferred_name, extraction.preferred_name),
    address_form: pick(current.address_form, extraction.address_form),
    grade_level: pick(current.grade_level, extraction.grade_level),
    current_topic: pick(current.current_topic, extraction.current_topic),
    progress_notes: pick(current.progress_notes, extraction.progress_notes),
    strengths: pick(current.strengths, extraction.strengths),
    weaknesses: pick(current.weaknesses, extraction.weaknesses),
    memory_summary: pick(current.memory_summary, extraction.memory_summary),
    interests:
      extraction.interests && extraction.interests.length
        ? Array.from(
            new Set([...(current.interests ?? []), ...extraction.interests])
          )
        : current.interests,
  }

  const facts: MemoryFact[] = (extraction.facts ?? [])
    .filter((f) => f && f.key && f.value)
    .map((f) => ({
      student_id: current.id,
      category: f.category,
      key: f.key.trim(),
      value: f.value.trim(),
      confidence: typeof f.confidence === 'number' ? f.confidence : 0.7,
    }))

  return { profile, facts }
}
