import { describe, expect, it } from 'vitest'
import { classifyKickoffWordBudget, countWords } from './wordBudget'
import { KICKOFF_HARD_WORD_LIMIT, KICKOFF_SOFT_WORD_LIMIT } from './schema'

describe('countWords', () => {
  it('returns 0 for empty/whitespace and counts tokens otherwise', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   ')).toBe(0)
    expect(countWords('one')).toBe(1)
    expect(countWords('one two three')).toBe(3)
  })
})

describe('classifyKickoffWordBudget thresholds', () => {
  it('returns ok at soft limit and soft just above soft', () => {
    const ok = Array.from({ length: KICKOFF_SOFT_WORD_LIMIT }, () => 'w').join(' ')
    const soft = Array.from({ length: KICKOFF_SOFT_WORD_LIMIT + 1 }, () => 'w').join(' ')
    expect(classifyKickoffWordBudget(ok).status).toBe('ok')
    expect(classifyKickoffWordBudget(soft).status).toBe('soft')
  })

  it('returns hard above hard limit', () => {
    const hard = Array.from({ length: KICKOFF_HARD_WORD_LIMIT + 1 }, () => 'w').join(' ')
    expect(classifyKickoffWordBudget(hard).status).toBe('hard')
    expect(classifyKickoffWordBudget(hard).words).toBe(KICKOFF_HARD_WORD_LIMIT + 1)
  })
})
