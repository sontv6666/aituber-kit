import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import settingsStore from '@/features/stores/settings'
import toastStore from '@/features/stores/toast'
import homeStore from '@/features/stores/home'
import { useAudioProcessing } from './useAudioProcessing'
import { SpeakQueue } from '@/features/messages/speakQueue'

/**
 * Vosk APIを使用した音声認識のカスタムフック（ベトナム語専用）
 */
export const useVoskRecognition = (
  onChatProcessStart: (text: string) => void
) => {
  const { t } = useTranslation()

  // ----- 状態管理 -----
  const [userMessage, setUserMessage] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const isListeningRef = useRef(false)
  const transcriptRef = useRef('')

  // ----- オーディオ処理フックを使用 -----
  const { startRecording, stopRecording } = useAudioProcessing()

  // ----- Vosk APIに音声データを送信して文字起こし（ベトナム語専用） -----
  const processVoskRecognition = async (audioBlob: Blob): Promise<string> => {
    setIsProcessing(true)

    try {
      const formData = new FormData()

      // ファイル名とMIMEタイプを決定
      let fileExtension = 'wav'
      let mimeType = audioBlob.type

      // Voskは通常WAV形式を好むが、他の形式もサポート
      if (mimeType.includes('mp3')) {
        fileExtension = 'mp3'
      } else if (mimeType.includes('ogg')) {
        fileExtension = 'ogg'
      } else if (mimeType.includes('wav')) {
        fileExtension = 'wav'
      } else if (mimeType.includes('webm')) {
        fileExtension = 'webm'
      }

      const fileName = `audio.${fileExtension}`

      // FormDataにファイルを追加
      formData.append('file', audioBlob, fileName)

      // 言語をベトナム語に固定
      formData.append('language', 'vi')

      // VoskサーバーURLを追加（設定から取得）
      const voskServerUrl = settingsStore.getState().voskServerUrl
      if (voskServerUrl) {
        formData.append('voskServerUrl', voskServerUrl)
      }

      console.log(
        `Sending audio to Vosk API - size: ${audioBlob.size} bytes, type: ${mimeType}, filename: ${fileName}, language: vi`
      )

      // APIリクエストを送信
      const response = await fetch('/api/vosk', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }))
        throw new Error(
          `Vosk API error: ${response.status} - ${errorData.details || errorData.error || 'Unknown error'}`
        )
      }

      const result = await response.json()
      return result.text || ''
    } catch (error) {
      console.error('Vosk transcription error:', error)
      toastStore.getState().addToast({
        message: t('Toasts.VoskError') || 'Vosk recognition error',
        type: 'error',
        tag: 'vosk-error',
      })
      return ''
    } finally {
      setIsProcessing(false)
    }
  }

  // ----- 音声認識停止処理 -----
  const stopListening = useCallback(async () => {
    // リスニング状態を更新
    isListeningRef.current = false
    setIsListening(false)

    // 録音を停止して音声データを取得
    const audioBlob = await stopRecording()

    // 音声データが存在する場合のみ処理
    if (audioBlob) {
      try {
        console.log(
          `Processing audio blob for Vosk - size: ${audioBlob.size} bytes, type: ${audioBlob.type}`
        )

        // Vosk APIに送信
        const transcript = await processVoskRecognition(audioBlob)

        if (transcript.trim()) {
          console.log('Vosk transcription result:', transcript)

          // 文字起こし結果をセット
          transcriptRef.current = transcript

          // LLMに送信
          onChatProcessStart(transcript)
        } else {
          console.log('Vosk returned empty transcription')
          toastStore.getState().addToast({
            message: t('Toasts.NoSpeechDetected'),
            type: 'info',
            tag: 'no-speech-detected',
          })
        }
      } catch (error) {
        console.error('Error processing Vosk audio:', error)
        toastStore.getState().addToast({
          message: t('Toasts.VoskError') || 'Vosk recognition error',
          type: 'error',
          tag: 'vosk-error',
        })
      }
    } else {
      console.warn('No audio data recorded')
      toastStore.getState().addToast({
        message: t('Toasts.NoSpeechDetected'),
        type: 'info',
        tag: 'no-speech-detected',
      })
    }
  }, [stopRecording, processVoskRecognition, onChatProcessStart, t])

  // ----- 音声認識開始処理 -----
  const startListening = useCallback(async () => {
    // トランスクリプトをリセット
    transcriptRef.current = ''
    setUserMessage('')

    // オーディオ録音開始
    const success = await startRecording()

    if (success) {
      // リスニング状態を更新
      isListeningRef.current = true
      setIsListening(true)
    } else {
      toastStore.getState().addToast({
        message: t('Toasts.SpeechRecognitionError'),
        type: 'error',
        tag: 'speech-recognition-error',
      })
    }
  }, [startRecording, t])

  // ----- 音声認識トグル処理 -----
  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening()
    } else {
      // AIの発話を停止
      homeStore.setState({ isSpeaking: false })
      SpeakQueue.stopAll()
      startListening()
    }
  }, [startListening, stopListening])

  // ----- メッセージ送信 -----
  const handleSendMessage = useCallback(() => {
    if (userMessage.trim()) {
      // AIの発話を停止
      homeStore.setState({ isSpeaking: false })
      SpeakQueue.stopAll()
      onChatProcessStart(userMessage)
      setUserMessage('')
    }
  }, [userMessage, onChatProcessStart])

  // ----- メッセージ入力 -----
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setUserMessage(e.target.value)
    },
    []
  )

  return {
    userMessage,
    isListening,
    isProcessing,
    silenceTimeoutRemaining: null, // Voskモードでは使用しない
    handleInputChange,
    handleSendMessage,
    toggleListening,
    startListening,
    stopListening,
  }
}
