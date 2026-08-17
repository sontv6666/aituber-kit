import { Message } from '@/features/messages/messages'
import { getVercelAIChatResponse } from '@/features/chat/vercelAIChat'
import { ExtractionResult, emptyProfile } from './types'
import { mergeExtraction } from './mergeExtraction'
import { upsertProfile, upsertFacts } from './repository'
import { useMemoryStore } from './memoryStore'
import { isMemoryEnabled } from './supabaseClient'

const EXTRACT_PROMPT = `Bạn là trợ lý trích xuất thông tin học sinh cho một gia sư AI.
Đọc đoạn hội thoại và trả về DUY NHẤT một JSON (không giải thích) với các khóa tùy có:
display_name, preferred_name (thích được gọi là), address_form (cách xưng hô, vd "cô - con"),
grade_level (lớp), current_topic (đang học gì), progress_notes (học tới đâu),
interests (mảng sở thích), strengths (điểm mạnh), weaknesses (hay sai gì),
memory_summary (tóm tắt ngắn buổi học), facts (mảng {category,key,value} với
category ∈ identity|preference|progress|personal|misc).
CHỈ ghi điều chắc chắn từ hội thoại; bỏ khóa nếu không rõ. Không bịa.`

export function parseExtraction(text: string): ExtractionResult | null {
  if (!text) return null
  let raw = text.trim()
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) raw = fence[1].trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1)) as ExtractionResult
  } catch {
    return null
  }
}

function threshold(): number {
  const n = Number(process.env.NEXT_PUBLIC_MEMORY_EXTRACT_EVERY_N)
  return Number.isFinite(n) && n > 0 ? n : 6
}

export async function maybeExtract(recentMessages: Message[]): Promise<void> {
  if (!isMemoryEnabled()) return
  const store = useMemoryStore.getState()
  if (!store.studentId) return
  if (store.messagesSinceExtract < threshold()) return

  // Bound extraction attempts to at most once per N new messages,
  // regardless of whether the AI response parses successfully.
  useMemoryStore.getState().resetExtractCounter()

  try {
    const transcript = recentMessages
      .slice(-12)
      .map((m) => {
        const c =
          typeof m.content === 'string'
            ? m.content
            : Array.isArray(m.content)
              ? (m.content[0]?.text ?? '')
              : ''
        return `${m.role}: ${c}`
      })
      .join('\n')

    const { text } = await getVercelAIChatResponse([
      { role: 'system', content: EXTRACT_PROMPT },
      { role: 'user', content: transcript },
    ])

    const extraction = parseExtraction(text)
    if (!extraction) return

    const current = store.profile ?? emptyProfile(store.studentId)
    const { profile, facts } = mergeExtraction(current, extraction)
    await Promise.all([upsertProfile(profile), upsertFacts(facts)])
    useMemoryStore.getState().applyMerge(profile, facts)
  } catch (e) {
    console.warn('maybeExtract failed', e)
  }
}
