/**
 * System Prompt Module cho Cô Giáo Mây
 * Tổ chức thành các module nhỏ để dễ quản lý và tái sử dụng
 */

import { CORE_PROMPT } from './corePrompt'
import { EXAMPLES_CONVERSATION } from './examplesConversation'
import { EXAMPLES_VIETNAMESE_CULTURE } from './examplesVietnameseCulture'
import { EXAMPLES_ADVANCED_TOPICS } from './examplesAdvancedTopics'

/**
 * Lấy system prompt đầy đủ (bao gồm tất cả ví dụ)
 * Sử dụng khi cần prompt đầy đủ cho AI model
 */
export function getFullSystemPrompt(): string {
  return `${CORE_PROMPT}

${EXAMPLES_CONVERSATION}

${EXAMPLES_VIETNAMESE_CULTURE}

${EXAMPLES_ADVANCED_TOPICS}

Bây giờ hãy bắt đầu cuộc trò chuyện với học trò của mình!`
}

/**
 * Lấy system prompt ngắn gọn (chỉ core, không có ví dụ)
 * Sử dụng khi prompt quá dài hoặc cần tiết kiệm tokens
 */
export function getCompactSystemPrompt(): string {
  return `${CORE_PROMPT}

Bây giờ hãy bắt đầu cuộc trò chuyện với học trò của mình!`
}

/**
 * Lấy system prompt với ví dụ tùy chọn
 * @param includeConversation - Có bao gồm ví dụ hội thoại không
 * @param includeCulture - Có bao gồm ví dụ văn hóa không
 * @param includeAdvanced - Có bao gồm ví dụ xử lý câu hỏi khó không
 */
export function getCustomSystemPrompt(options: {
  includeConversation?: boolean
  includeCulture?: boolean
  includeAdvanced?: boolean
}): string {
  const {
    includeConversation = true,
    includeCulture = true,
    includeAdvanced = true,
  } = options

  let prompt = CORE_PROMPT

  if (includeConversation) {
    prompt += EXAMPLES_CONVERSATION
  }

  if (includeCulture) {
    prompt += EXAMPLES_VIETNAMESE_CULTURE
  }

  if (includeAdvanced) {
    prompt += EXAMPLES_ADVANCED_TOPICS
  }

  prompt += '\n\nBây giờ hãy bắt đầu cuộc trò chuyện với học trò của mình!'

  return prompt
}

/**
 * Export default: system prompt đầy đủ (tương thích với code cũ)
 */
export const SYSTEM_PROMPT = getFullSystemPrompt()

// Export các module riêng lẻ để có thể sử dụng khi cần
export {
  CORE_PROMPT,
  EXAMPLES_CONVERSATION,
  EXAMPLES_VIETNAMESE_CULTURE,
  EXAMPLES_ADVANCED_TOPICS,
}
