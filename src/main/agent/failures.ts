import { AgentError, type AgentFailureKind, isOperationalFailure } from '../../shared/agent/errors'

/**
 * Failure taxonomy for Kickoff / Research / Lessons.
 * Operational failures set session.infra_skip; thesis failures do not.
 * Valid SitOut is success — never infra_skip.
 */
export const AGENT_FAILURE_TAXONOMY: Record<
  AgentFailureKind,
  { infraSkip: boolean; terminalStageLabel: string; description: string }
> = {
  MissingApiKey: {
    infraSkip: true,
    terminalStageLabel: 'Failed/MissingApiKey',
    description: 'CURSOR_API_KEY absent'
  },
  Timeout: {
    infraSkip: true,
    terminalStageLabel: 'Failed/Timeout',
    description: 'Agent SDK timed out'
  },
  SdkError: {
    infraSkip: true,
    terminalStageLabel: 'Failed/SdkError',
    description: 'Cursor SDK unavailable or run errored'
  },
  SchemaInvalid: {
    infraSkip: false,
    terminalStageLabel: 'Failed/SchemaInvalid',
    description: 'Agent output failed Zod after retry'
  },
  BudgetExceeded: {
    infraSkip: false,
    terminalStageLabel: 'Failed/BudgetExceeded',
    description: 'Kickoff word budget exceeded after compress retry'
  },
  DiversityCollision: {
    infraSkip: false,
    terminalStageLabel: 'Failed/Skipped',
    description: 'Explorer hypothesis collided after diversity retry'
  },
  OffTapeSymbol: {
    infraSkip: false,
    terminalStageLabel: 'Failed/Skipped',
    description: 'Research emitted symbols outside the feature tape'
  }
}

export interface StageErrorPayload {
  kind: AgentFailureKind
  message: string
  infraSkip: boolean
  terminalStageLabel: string
  details?: Record<string, unknown>
}

export function mapAgentFailureToSessionFlags(err: unknown): {
  infraSkip: boolean
  errorPayload: StageErrorPayload
} {
  if (err instanceof AgentError) {
    const meta = AGENT_FAILURE_TAXONOMY[err.kind]
    return {
      infraSkip: err.infraSkip || meta.infraSkip,
      errorPayload: {
        kind: err.kind,
        message: err.message,
        infraSkip: err.infraSkip || meta.infraSkip,
        terminalStageLabel: meta.terminalStageLabel,
        details: err.details
      }
    }
  }
  const message = err instanceof Error ? err.message : 'unknown agent failure'
  return {
    infraSkip: true,
    errorPayload: {
      kind: 'SdkError',
      message,
      infraSkip: true,
      terminalStageLabel: AGENT_FAILURE_TAXONOMY.SdkError.terminalStageLabel
    }
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new AgentError('Timeout', `${label} timed out after ${ms}ms`, {
          infraSkip: isOperationalFailure('Timeout')
        })
      )
    }, ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err: unknown) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}
