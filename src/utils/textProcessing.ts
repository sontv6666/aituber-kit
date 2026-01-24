import englishToJapanese from '@/utils/englishToJapanese.json'

interface EnglishToJapanese {
  [key: string]: string
}

const typedEnglishToJapanese = englishToJapanese as EnglishToJapanese

// ソート済みキーをあらかじめメモ化
const sortedEnglishKeys = Object.keys(typedEnglishToJapanese).sort(
  (a, b) => b.length - a.length
)

// 重要な単語を明示的に含める
const importantWords = ['mastra', 'Mastra']

// 最適化: 10文字以下の単語と重要な単語を含める
const commonWordsKeys = [
  ...sortedEnglishKeys.filter((key) => key.length <= 10),
  ...importantWords,
]

// 正規表現をあらかじめコンパイルして再利用
const regexCache = new Map<string, RegExp>()

/**
 * 英語テキストを日本語読みに変換する
 * @param text 変換元の文字列
 * @returns 変換後の文字列
 */
export function convertEnglishToJapaneseReading(text: string): string {
  // 大文字小文字を区別せずに変換するために、テキストを小文字化してキャッシュ
  const lowerText = text.toLowerCase()

  // メモ化されたキーを使用
  return commonWordsKeys.reduce((result, englishWord) => {
    // 最適化: 大文字小文字を区別せずに単語の有無をチェック
    if (!lowerText.includes(englishWord.toLowerCase())) {
      return result
    }

    // 正規表現のキャッシュを利用
    let regex = regexCache.get(englishWord)
    if (!regex) {
      // 大文字小文字を区別せず、単語境界に一致する正規表現
      regex = new RegExp(`\\b${englishWord}\\b`, 'gi')
      regexCache.set(englishWord, regex)
    }

    const japaneseReading = typedEnglishToJapanese[englishWord]
    return result.replace(regex, japaneseReading)
  }, text)
}

/**
 * 非同期で英語テキストを日本語読みに変換する
 * UIスレッドをブロックしないように設計
 * @param text 変換元の文字列
 * @returns 変換後の文字列を含むPromise
 */
export async function asyncConvertEnglishToJapaneseReading(
  text: string
): Promise<string> {
  // UIスレッドをブロックしないよう、次のティックまで待機
  await new Promise((resolve) => setTimeout(resolve, 0))

  return convertEnglishToJapaneseReading(text)
}

/**
 * テキスト内に英語（ラテン文字）が含まれているかチェック
 * @param text チェック対象のテキスト
 * @returns 英語が含まれている場合はtrue
 */
export function containsEnglish(text: string): boolean {
  return /[a-zA-Z]/.test(text)
}

/**
 * テキストにpauseを追加して、子供が聞き取りやすくする
 * 句読点（。、，.）の後にpause markerを追加
 * @param text 元のテキスト
 * @param useSSML SSML形式でpauseを追加するか（Google TTSなど）
 * @returns 処理後のテキスト
 */
export function addPausesForChildren(
  text: string,
  useSSML: boolean = false
): string {
  if (!text) return text

  // SSML形式（Google TTSなど）
  if (useSSML) {
    // 句点（。）の後に長めのpause（0.8秒）、読点（、，）の後に短めのpause（0.4秒）
    // これにより子供が各文を理解する時間ができる
    return text
      .replace(/([。．！？])/g, '$1<break time="800ms"/>')
      .replace(/([，、])/g, '$1<break time="400ms"/>')
      .replace(/([.,])\s*/g, '$1<break time="400ms"/>')
  }

  // SSMLを使わない場合：複数のスペースと改行を追加して自然なpauseを演出
  // 多くのTTSエンジンは複数のスペースを無視するため、改行を追加
  // ただし、改行を無視するTTSもあるため、複数のスペースも併用
  return text
    .replace(/([。．！？])\s*/g, '$1\n\n  ') // 句点の後に改行2つとスペース2つ
    .replace(/([，、])\s*/g, '$1\n ') // 読点の後に改行1つとスペース1つ
    .replace(/([.,])\s+/g, '$1\n ') // 英語の句読点の後に改行1つとスペース1つ
    .replace(/\n\n\n+/g, '\n\n') // 連続する改行を2つに制限
}