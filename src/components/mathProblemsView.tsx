import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import type { MathProblem } from '@/features/stores/home'

export const MathProblemsView = () => {
  const { t } = useTranslation()
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const chatLogWidth = settingsStore((s) => s.chatLogWidth)
  const characterName = settingsStore((s) => s.characterName)

  // Lấy danh sách đề bài toán đã được lưu, chỉ lấy các đề bài từ học sinh (user)
  const allMathProblems = homeStore((s) => s.mathProblems)
  const mathProblems = allMathProblems.filter((mp) => mp.source === 'user')

  useEffect(() => {
    if (chatScrollRef.current && mathProblems.length > 0) {
      chatScrollRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      })
    }
  }, [mathProblems])

  if (mathProblems.length === 0) {
    return (
      <div
        className="absolute h-[100svh] pb-16 z-10 max-w-full"
        style={{ width: `${chatLogWidth}px` }}
      >
        <div className="max-h-full px-4 pt-24 pb-16 overflow-y-auto scroll-hidden flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="text-xl font-bold mb-2">{t('NoMathProblems')}</div>
            <div className="text-sm">{t('NoMathProblemsDescription')}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="absolute h-[100svh] pb-16 z-10 max-w-full"
      style={{ width: `${chatLogWidth}px` }}
    >
      <div className="max-h-full px-4 pt-24 pb-16 overflow-y-auto scroll-hidden">
        {mathProblems.map((mathProblem, i) => {
          return (
            <div
              key={mathProblem.id || i}
              ref={mathProblems.length - 1 === i ? chatScrollRef : null}
              className="mx-auto ml-0 md:ml-10 lg:ml-20 my-4 pl-10"
            >
              <div className="bg-white rounded-lg border-2 border-blue-300 shadow-md">
                <div className="px-6 py-2 rounded-t-lg font-bold tracking-wider bg-blue-500 text-white">
                  💬 Đề bài {i + 1} (Con hỏi)
                </div>
                <div className="px-6 py-4 bg-white rounded-b-lg">
                  <div className="font-bold text-primary text-lg whitespace-pre-wrap">
                    {mathProblem.problem}
                  </div>
                  {mathProblem.timestamp && (
                    <div className="text-xs text-gray-400 mt-2">
                      {new Date(mathProblem.timestamp).toLocaleString('vi-VN')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
