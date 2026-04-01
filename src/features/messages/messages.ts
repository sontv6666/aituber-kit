export type Message = {
  id?: string
  role: string // "assistant" | "system" | "user";
  content?:
    | string
    | [{ type: 'text'; text: string }, { type: 'image'; image: string }] // マルチモーダル拡張
  audio?: { id: string }
  timestamp?: string
}

export const EMOTIONS = [
  'neutral',
  'happy',
  'angry',
  'sad',
  'relaxed',
  'surprised',
] as const
export type EmotionType = (typeof EMOTIONS)[number]

const EMOTION_ALIAS_MAP: Record<string, EmotionType> = {
  neutral: 'neutral',
  netural: 'neutral',
  happy: 'happy',
  angry: 'angry',
  sad: 'sad',
  relaxed: 'relaxed',
  surprised: 'surprised',
}

export const normalizeEmotionTag = (rawEmotion?: string): EmotionType => {
  if (!rawEmotion) return 'neutral'
  const normalized = rawEmotion
    .trim()
    .replace(/[{}]/g, '')
    .toLowerCase()
  return EMOTION_ALIAS_MAP[normalized] ?? 'neutral'
}

export type Talk = {
  emotion: EmotionType
  message: string
  buffer?: ArrayBuffer
}

export const splitSentence = (text: string): string[] => {
  const splitMessages = text.split(/(?<=[。．！？\n])/g)
  return splitMessages.filter((msg) => msg !== '')
}
