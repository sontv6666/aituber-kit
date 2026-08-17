export type MemoryCategory =
  | 'identity'
  | 'preference'
  | 'progress'
  | 'personal'
  | 'misc'

export interface StudentProfile {
  id: string
  display_name: string | null
  preferred_name: string | null
  address_form: string | null
  grade_level: string | null
  current_topic: string | null
  progress_notes: string | null
  interests: string[] | null
  strengths: string | null
  weaknesses: string | null
  memory_summary: string | null
  last_active: string | null
}

export interface MemoryFact {
  id?: string
  student_id: string
  category: MemoryCategory
  key: string
  value: string
  confidence: number
  source_message_id?: string | null
}

export interface ExtractionResult {
  display_name?: string
  preferred_name?: string
  address_form?: string
  grade_level?: string
  current_topic?: string
  progress_notes?: string
  interests?: string[]
  strengths?: string
  weaknesses?: string
  memory_summary?: string
  facts?: Array<{
    category: MemoryCategory
    key: string
    value: string
    confidence?: number
  }>
}

export function emptyProfile(id: string): StudentProfile {
  return {
    id,
    display_name: null,
    preferred_name: null,
    address_form: null,
    grade_level: null,
    current_topic: null,
    progress_notes: null,
    interests: null,
    strengths: null,
    weaknesses: null,
    memory_summary: null,
    last_active: null,
  }
}
