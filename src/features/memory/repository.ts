import { getSupabaseClient } from './supabaseClient'
import { StudentProfile, MemoryFact } from './types'

export async function ensureStudentRow(id: string): Promise<void> {
  const client = getSupabaseClient()
  if (!client || !id) return
  try {
    await client
      .from('students')
      .upsert(
        { id, last_active: new Date().toISOString() },
        { onConflict: 'id' }
      )
  } catch (e) {
    console.warn('ensureStudentRow failed', e)
  }
}

export async function loadProfile(id: string): Promise<StudentProfile | null> {
  const client = getSupabaseClient()
  if (!client || !id) return null
  try {
    const { data } = await client
      .from('students')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    return (data as StudentProfile) ?? null
  } catch (e) {
    console.warn('loadProfile failed', e)
    return null
  }
}

export async function upsertProfile(profile: StudentProfile): Promise<void> {
  const client = getSupabaseClient()
  if (!client || !profile.id) return
  try {
    await client
      .from('students')
      .upsert(
        { ...profile, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )
  } catch (e) {
    console.warn('upsertProfile failed', e)
  }
}

export async function loadFacts(id: string): Promise<MemoryFact[]> {
  const client = getSupabaseClient()
  if (!client || !id) return []
  try {
    const { data } = await client
      .from('memory_facts')
      .select('*')
      .eq('student_id', id)
      .order('updated_at', { ascending: false })
    return (data as MemoryFact[]) ?? []
  } catch (e) {
    console.warn('loadFacts failed', e)
    return []
  }
}

export async function upsertFacts(facts: MemoryFact[]): Promise<void> {
  const client = getSupabaseClient()
  if (!client || !facts.length) return
  try {
    await client.from('memory_facts').upsert(
      facts.map((f) => ({ ...f, updated_at: new Date().toISOString() })),
      { onConflict: 'student_id,category,key' }
    )
  } catch (e) {
    console.warn('upsertFacts failed', e)
  }
}

export async function persistMessage(
  studentId: string,
  role: string,
  content: string,
  emotion?: string | null
): Promise<void> {
  const client = getSupabaseClient()
  if (!client || !studentId) return
  try {
    await client.from('messages').insert({
      student_id: studentId,
      role,
      content,
      emotion: emotion ?? null,
    })
  } catch (e) {
    console.warn('persistMessage failed', e)
  }
}
