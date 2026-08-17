import { StudentProfile, MemoryFact } from './types'

export function buildMemoryBlock(
  profile: StudentProfile | null,
  facts: MemoryFact[]
): string {
  const lines: string[] = []

  if (profile) {
    const name = profile.preferred_name || profile.display_name
    if (name) lines.push(`- Tên/biệt danh: ${name}`)
    if (profile.address_form) lines.push(`- Cách xưng hô: ${profile.address_form}`)
    if (profile.grade_level) lines.push(`- Lớp/trình độ: ${profile.grade_level}`)
    if (profile.current_topic) lines.push(`- Đang học: ${profile.current_topic}`)
    if (profile.progress_notes)
      lines.push(`- Học tới đâu: ${profile.progress_notes}`)
    if (profile.interests && profile.interests.length)
      lines.push(`- Sở thích: ${profile.interests.join(', ')}`)
    if (profile.strengths) lines.push(`- Điểm mạnh: ${profile.strengths}`)
    if (profile.weaknesses) lines.push(`- Hay sai/điểm yếu: ${profile.weaknesses}`)
  }

  for (const f of facts) {
    lines.push(`- [${f.category}] ${f.key}: ${f.value}`)
  }

  if (!lines.length) return ''

  const summary = profile?.memory_summary
    ? `\nTóm tắt các buổi trước: ${profile.memory_summary}`
    : ''

  return (
    '📌 HỒ SƠ HỌC SINH (hãy nhớ và dùng khi trò chuyện, xưng hô đúng, ' +
    'nhắc lại điều đã biết một cách tự nhiên):\n' +
    lines.join('\n') +
    summary
  )
}
