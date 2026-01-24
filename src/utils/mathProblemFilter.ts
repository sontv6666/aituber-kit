/**
 * Utilities để nhận diện và filter đề bài toán từ tin nhắn
 */

/**
 * Kiểm tra xem một tin nhắn có phải là đề bài toán không
 * @param message Nội dung tin nhắn
 * @returns true nếu tin nhắn có vẻ là đề bài toán
 */
export function isMathProblem(message: string): boolean {
  if (!message || typeof message !== 'string') return false

  const text = message.trim()

  // Kiểm tra các dấu hiệu của đề bài toán:
  // 1. Có chứa số
  const hasNumbers = /\d/.test(text)

  // 2. Có chứa phép tính cơ bản
  const hasMathOperators = /[\+\-\*\/×÷=<>≤≥]|bằng|chia|nhân|cộng|trừ|tổng|hiệu|tích|thương/.test(text)

  // 3. Có từ khóa toán học
  const mathKeywords = [
    'tính', 'tìm', 'tìm x', 'giải', 'bài toán', 'bài tập', 'đề bài',
    'số', 'cái', 'viên', 'quả', 'bạn', 'người', 'con', 'cây',
    'mét', 'cm', 'km', 'kg', 'lít', 'đồng', 'tiền',
    'chia đều', 'chia hết', 'còn lại', 'thừa', 'thiếu',
    'gấp', 'nhiều hơn', 'ít hơn', 'bằng nhau',
    'chu vi', 'diện tích', 'thể tích',
    'đếm', 'so sánh', 'sắp xếp'
  ]
  const hasMathKeywords = mathKeywords.some(keyword => 
    text.toLowerCase().includes(keyword)
  )

  // 4. Có câu hỏi về toán (có dấu hỏi và số)
  const hasQuestionWithNumber = /\?/.test(text) && hasNumbers

  // 5. Có cấu trúc giống bài toán: "Con có X cái...", "Mẹ mua Y kg...", etc.
  const hasProblemStructure = /(con|có|mua|cho|nhận|được|mất|bớt|thêm)\s+\d+/.test(text.toLowerCase())

  // Đếm số dấu hiệu có
  let score = 0
  if (hasNumbers) score += 2
  if (hasMathOperators) score += 2
  if (hasMathKeywords) score += 1
  if (hasQuestionWithNumber) score += 2
  if (hasProblemStructure) score += 2

  // Nếu có ít nhất 3 điểm, coi là đề bài toán
  return score >= 3
}

/**
 * Extract chỉ phần đề bài toán từ tin nhắn (bỏ qua phần chào hỏi, cảm ơn, etc.)
 * @param message Nội dung tin nhắn
 * @returns Phần đề bài toán đã được làm sạch
 */
export function extractMathProblem(message: string): string {
  if (!message || typeof message !== 'string') return ''

  let text = message.trim()

  // Loại bỏ phần chào hỏi ở đầu
  text = text.replace(/^(con chào|chào cô|chào|em chào|dạ chào)\s*/i, '')

  // Loại bỏ phần cảm ơn ở cuối
  text = text.replace(/\s*(cảm ơn|thanks|thank you|cảm ơn cô|cảm ơn nhiều).*$/i, '')

  // Loại bỏ phần không liên quan đến toán ở đầu/cuối
  // Giữ lại phần có chứa số hoặc từ khóa toán học
  const sentences = text.split(/[.!?。．]/).filter(s => s.trim())
  
  // Tìm câu có vẻ là đề bài toán
  const mathSentences = sentences.filter(s => isMathProblem(s))
  
  if (mathSentences.length > 0) {
    return mathSentences.join('. ').trim()
  }

  // Nếu không tìm được, trả về toàn bộ nếu có vẻ là toán
  if (isMathProblem(text)) {
    return text
  }

  return ''
}

/**
 * Extract đề bài toán từ câu trả lời của AI (assistant message)
 * Loại bỏ phần chào hỏi, khen ngợi, chỉ giữ lại phần đề bài và gợi ý
 * @param message Nội dung câu trả lời từ AI
 * @returns Phần đề bài toán và gợi ý
 */
export function extractMathProblemFromAssistant(message: string): string {
  if (!message || typeof message !== 'string') return ''

  let text = message.trim()

  // Chia thành các câu
  // Sử dụng regex để tách câu, giữ lại dấu chấm
  const sentenceSplitter = /([.!?。．]+\s*)/g
  const parts = text.split(sentenceSplitter)
  const sentences: string[] = []
  
  for (let i = 0; i < parts.length; i += 2) {
    if (parts[i] && parts[i].trim()) {
      const sentence = parts[i].trim() + (parts[i + 1] || '')
      sentences.push(sentence)
    }
  }

  // Tìm câu đầu tiên chứa đề bài toán
  // Dấu hiệu: có số và từ khóa toán học như "có", "cái", "viên", "quả", "bài toán"
  let problemStartIndex = -1
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim()
    
    // Bỏ qua các câu chào hỏi, khen ngợi
    if (/^(Con muốn|Tốt lắm|Cô sẽ cho|Cô Mây|Chào con)/i.test(sentence) && 
        !/\d+/.test(sentence)) {
      continue
    }
    
    const hasNumber = /\d+/.test(sentence)
    const hasMathKeywords = /(có|cái|viên|quả|người|bạn|bài toán|tính|tìm|chia|nhân|cộng|trừ|bằng|bao nhiêu|gợi ý)/i.test(sentence)
    
    // Câu có vẻ là đề bài nếu: có số + từ khóa toán học
    // Hoặc bắt đầu với pattern như "Con có X...", "Có X...", "Mẹ có X..."
    if (hasNumber && hasMathKeywords) {
      // Đặc biệt ưu tiên câu bắt đầu với "Con có X..."
      if (/(Con có|Mẹ có|Bạn có|Có)\s+\d+\s+(cái|viên|quả|người|bạn|kg|mét|cm|km)/i.test(sentence)) {
        problemStartIndex = i
        break
      }
      // Nếu chưa tìm được, đánh dấu nhưng tiếp tục tìm câu tốt hơn
      if (problemStartIndex === -1) {
        problemStartIndex = i
      }
    }
  }
  
  // Nếu vẫn chưa tìm được, tìm câu có số bất kỳ (fallback)
  if (problemStartIndex === -1) {
    for (let i = 0; i < sentences.length; i++) {
      if (/\d+/.test(sentences[i])) {
        problemStartIndex = i
        break
      }
    }
  }

  // Nếu tìm thấy điểm bắt đầu, lấy từ đó đến cuối (bao gồm cả gợi ý)
  if (problemStartIndex >= 0) {
    const problemPart = sentences.slice(problemStartIndex).join(' ').trim()
    
    // Loại bỏ các phần không cần thiết ở đầu (nếu còn sót)
    // Nhưng giữ lại phần đề bài và gợi ý
    return problemPart
  }

  // Fallback: nếu không tìm được, thử tìm phần có chứa nhiều số và từ khóa toán học nhất
  const mathSentences = sentences.filter(s => 
    /\d+/.test(s) && 
    /(có|cái|viên|quả|bài toán|tính|tìm|chia|nhân|cộng|trừ)/i.test(s)
  )

  if (mathSentences.length > 0) {
    // Tìm vị trí của câu đầu tiên trong danh sách mathSentences
    const firstMathSentence = mathSentences[0]
    const firstMathIndex = sentences.findIndex(s => s.includes(firstMathSentence))
    
    if (firstMathIndex >= 0) {
      return sentences.slice(firstMathIndex).join(' ').trim()
    }
    
    return mathSentences.join(' ').trim()
  }

  return ''
}
