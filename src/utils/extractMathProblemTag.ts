/**
 * Extract đề bài toán từ tag [MATH_PROBLEM]...[/MATH_PROBLEM]
 */

/**
 * Extract đề bài toán từ message có chứa tag [MATH_PROBLEM]
 * @param message Nội dung message
 * @returns Đề bài toán được extract, hoặc null nếu không có
 */
export function extractMathProblemTag(message: string): string | null {
  if (!message || typeof message !== 'string') return null

  // Tìm tag [MATH_PROBLEM]...[/MATH_PROBLEM]
  const mathProblemRegex = /\[MATH_PROBLEM\]\s*([\s\S]*?)\s*\[\/MATH_PROBLEM\]/i
  const match = message.match(mathProblemRegex)

  if (match && match[1]) {
    return match[1].trim()
  }

  return null
}

/**
 * Loại bỏ tag [MATH_PROBLEM] khỏi message để hiển thị bình thường
 * @param message Nội dung message có chứa tag
 * @returns Message đã loại bỏ tag
 */
export function removeMathProblemTag(message: string): string {
  if (!message || typeof message !== 'string') return message

  // Loại bỏ tag [MATH_PROBLEM]...[/MATH_PROBLEM] nhưng giữ lại nội dung xung quanh
  return message
    .replace(/\[MATH_PROBLEM\]\s*[\s\S]*?\s*\[\/MATH_PROBLEM\]\s*/gi, '')
    .trim()
}
