import { describe, expect, it } from 'vitest'
import { AgentError } from '../../shared/agent/errors'
import {
  AGENT_FAILURE_TAXONOMY,
  mapAgentFailureToSessionFlags,
  withTimeout
} from './failures'

describe('failure taxonomy + infra_skip', () => {
  it('documents taxonomy and maps timeout to infra_skip', () => {
    expect(AGENT_FAILURE_TAXONOMY.Timeout.infraSkip).toBe(true)
    expect(AGENT_FAILURE_TAXONOMY.BudgetExceeded.infraSkip).toBe(false)
    const mapped = mapAgentFailureToSessionFlags(
      new AgentError('Timeout', 'kickoff timed out', { infraSkip: true })
    )
    expect(mapped.infraSkip).toBe(true)
    expect(mapped.errorPayload.terminalStageLabel).toContain('Timeout')
  })

  it('maps BudgetExceeded without infra_skip', () => {
    const mapped = mapAgentFailureToSessionFlags(
      new AgentError('BudgetExceeded', 'too many words', { infraSkip: false })
    )
    expect(mapped.infraSkip).toBe(false)
    expect(mapped.errorPayload.kind).toBe('BudgetExceeded')
  })

  it('withTimeout raises Timeout infra_skip errors', async () => {
    await expect(withTimeout(new Promise(() => undefined), 20, 'kickoff')).rejects.toMatchObject({
      kind: 'Timeout',
      infraSkip: true
    } satisfies Partial<AgentError>)
  })
})
