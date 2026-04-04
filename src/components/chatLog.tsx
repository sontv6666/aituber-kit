import Image from 'next/image'
import { useEffect, useRef, useState, useMemo } from 'react'
import { EMOTIONS, Message } from '@/features/messages/messages'

import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { messageSelectors } from '@/features/messages/messageSelectors'
import type { MathProblem } from '@/features/stores/home'

export const ChatLog = () => {
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const resizeHandleRef = useRef<HTMLDivElement>(null)
  const chatLogRef = useRef<HTMLDivElement>(null)

  const characterName = settingsStore((s) => s.characterName)
  const chatLogWidth = settingsStore((s) => s.chatLogWidth)
  const messages = messageSelectors.getTextAndImageMessages(
    homeStore((s) => s.chatLog)
  )
  const mathProblems = homeStore((s) => s.mathProblems)

  // Tạo map để tìm mathProblem theo messageId
  const mathProblemsByMessageId = useMemo(() => {
    const map = new Map<string, MathProblem>()
    mathProblems
      .filter((mp) => mp.source === 'assistant' && mp.messageId)
      .forEach((mp) => {
        if (mp.messageId) {
          map.set(mp.messageId, mp)
        }
      })
    return map
  }, [mathProblems])

  const [isDragging, setIsDragging] = useState<boolean>(false)

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({
      behavior: 'auto',
      block: 'center',
    })
  }, [])

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }, [messages])

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      setIsDragging(true)
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return

      const newWidth = e.clientX

      const constrainedWidth = Math.max(
        300,
        Math.min(newWidth, window.innerWidth * 0.8)
      )

      settingsStore.setState({ chatLogWidth: constrainedWidth })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    const resizeHandle = resizeHandleRef.current
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', handleMouseDown)
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      if (resizeHandle) {
        resizeHandle.removeEventListener('mousedown', handleMouseDown)
      }
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  return (
    <div
      ref={chatLogRef}
      className="absolute h-[100svh] pb-16 z-10 max-w-full"
      style={{ width: `${chatLogWidth}px` }}
    >
      <div className="max-h-full px-4 pt-24 pb-16 overflow-y-auto scroll-hidden">
        {messages.map((msg, i) => {
          // Tìm mathProblem tương ứng nếu là message từ assistant
          const relatedMathProblem =
            msg.role === 'assistant' && msg.id
              ? mathProblemsByMessageId.get(msg.id)
              : null

          return (
            <div
              key={msg.id || i}
              ref={messages.length - 1 === i ? chatScrollRef : null}
            >
              {typeof msg.content === 'string' ? (
                <Chat
                  role={msg.role}
                  message={msg.content}
                  characterName={characterName}
                />
              ) : (
                <>
                  <Chat
                    role={msg.role}
                    message={msg.content ? msg.content[0].text : ''}
                    characterName={characterName}
                  />
                  <ChatImage
                    role={msg.role}
                    imageUrl={msg.content ? msg.content[1].image : ''}
                    characterName={characterName}
                  />
                </>
              )}
              {/* Hiển thị đề bài toán ngay sau message từ assistant nếu có */}
              {relatedMathProblem && (
                <MathProblemCard
                  mathProblem={relatedMathProblem}
                  characterName={characterName}
                />
              )}
            </div>
          )
        })}
      </div>
      <div
        ref={resizeHandleRef}
        className="absolute top-0 right-0 h-full w-4 cursor-ew-resize hover:bg-secondary hover:bg-opacity-20"
        style={{
          cursor: isDragging ? 'grabbing' : 'ew-resize',
        }}
      >
        <div className="absolute top-1/2 right-1 h-16 w-1 bg-secondary bg-opacity-40 rounded-full transform -translate-y-1/2"></div>
      </div>
    </div>
  )
}

const Chat = ({
  role,
  message,
  characterName,
}: {
  role: string
  message: string
  characterName: string
}) => {
  const emotionPattern = new RegExp(`\\[(${EMOTIONS.join('|')})\\]\\s*`, 'gi')
  const processedMessage = message.replace(emotionPattern, '')

  const roleColor =
    role !== 'user' ? 'bg-secondary text-theme ' : 'bg-base-light text-primary'
  const roleText = role !== 'user' ? 'text-secondary' : 'text-primary'
  const offsetX = role === 'user' ? 'pl-10' : 'pr-10'

  return (
    <div className={`mx-auto ml-0 md:ml-10 lg:ml-20 my-4 ${offsetX}`}>
      {role === 'code' ? (
        <pre className="whitespace-pre-wrap break-words bg-[#1F2937] text-theme p-4 rounded-lg">
          <code className="font-mono text-sm">{message}</code>
        </pre>
      ) : (
        <>
          <div
            className={`px-6 py-2 rounded-t-lg font-bold tracking-wider ${roleColor}`}
          >
            {role !== 'user' ? characterName || 'Cô Mây' : 'Con'}
          </div>
          <div className="px-6 py-4 bg-white rounded-b-lg">
            <div className={`font-bold ${roleText}`}>{processedMessage}</div>
          </div>
        </>
      )}
    </div>
  )
}

const ChatImage = ({
  role,
  imageUrl,
  characterName,
}: {
  role: string
  imageUrl: string
  characterName: string
}) => {
  const offsetX = role === 'user' ? 'pl-40' : 'pr-40'

  return (
    <div className={`mx-auto ml-0 md:ml-10 lg:ml-20 my-4 ${offsetX}`}>
      <Image
        src={imageUrl}
        alt="Generated Image"
        className="rounded-lg"
        width={512}
        height={512}
      />
    </div>
  )
}

const MathProblemCard = ({
  mathProblem,
  characterName,
}: {
  mathProblem: MathProblem
  characterName: string
}) => {
  return (
    <div className="mx-auto ml-0 md:ml-10 lg:ml-20 my-4 pr-10">
      <div className="bg-green-50 rounded-lg border-2 border-green-300 shadow-md mt-2">
        <div className="px-6 py-2 bg-green-500 text-white rounded-t-lg font-bold tracking-wider text-sm">
          📚 Đề bài toán (Cô Mây đưa ra)
        </div>
        <div className="px-6 py-4 bg-white rounded-b-lg">
          <div className="font-bold text-primary text-base whitespace-pre-wrap">
            {mathProblem.problem}
          </div>
        </div>
      </div>
    </div>
  )
}
