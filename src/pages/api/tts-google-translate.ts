import type { NextApiRequest, NextApiResponse } from 'next'

type Data = {
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const message = String(req.body?.message || '').trim()
  const language = String(req.body?.language || 'vi')

  if (!message) {
    return res.status(400).json({ error: 'Empty message' })
  }

  try {
    const ttsUrl = new URL('https://translate.google.com/translate_tts')
    ttsUrl.searchParams.set('ie', 'UTF-8')
    ttsUrl.searchParams.set('q', message)
    ttsUrl.searchParams.set('tl', language)
    ttsUrl.searchParams.set('client', 'tw-ob')

    const response = await fetch(ttsUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'audio/mpeg',
      },
    })

    if (!response.ok) {
      throw new Error(`Google Translate TTS request failed: ${response.status}`)
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer())
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Content-Length', audioBuffer.length.toString())
    res.status(200).send(audioBuffer as any)
  } catch (error) {
    console.error('Error in Google Translate TTS:', error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
}
