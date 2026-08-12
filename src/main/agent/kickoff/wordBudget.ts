import { KICKOFF_HARD_WORD_LIMIT, KICKOFF_SOFT_WORD_LIMIT } from './schema'

export type WordBudgetStatus = 'ok' | 'soft' | 'hard'

export function countWords(text: string): number {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return 0
  }
  return trimmed.split(/\s+/).length
}

export function classifyKickoffWordBudget(text: string): {
  words: number
  status: WordBudgetStatus
} {
  const words = countWords(text)
  if (words > KICKOFF_HARD_WORD_LIMIT) {
    return { words, status: 'hard' }
  }
  if (words > KICKOFF_SOFT_WORD_LIMIT) {
    return { words, status: 'soft' }
  }
  return { words, status: 'ok' }
}
