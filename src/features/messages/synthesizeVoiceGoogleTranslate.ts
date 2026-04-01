import { Talk } from './messages'
import { Language } from '@/features/constants/settings'

const languageMap: Partial<Record<Language, string>> = {
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  zh: 'zh-CN',
  vi: 'vi',
  fr: 'fr',
  es: 'es',
  pt: 'pt',
  de: 'de',
  ru: 'ru',
  it: 'it',
  ar: 'ar',
  hi: 'hi',
  pl: 'pl',
  th: 'th',
}

export async function synthesizeVoiceGoogleTranslateApi(
  talk: Talk,
  selectLanguage: Language
) {
  try {
    const res = await fetch('/api/tts-google-translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: talk.message,
        language: languageMap[selectLanguage] || 'vi',
      }),
    })

    if (!res.ok) {
      throw new Error(
        `Google Translate TTS APIからの応答が異常です。ステータスコード: ${res.status}`
      )
    }

    return await res.arrayBuffer()
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Google Translate TTSでエラーが発生しました: ${error.message}`
      )
    } else {
      throw new Error('Google Translate TTSで不明なエラーが発生しました')
    }
  }
}
