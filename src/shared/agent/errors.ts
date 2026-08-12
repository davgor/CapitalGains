export type AgentFailureKind =
  | 'MissingApiKey'
  | 'Timeout'
  | 'SdkError'
  | 'SchemaInvalid'
  | 'BudgetExceeded'
  | 'DiversityCollision'
  | 'OffTapeSymbol'

export class AgentError extends Error {
  readonly kind: AgentFailureKind
  readonly infraSkip: boolean
  readonly details: Record<string, unknown> | undefined

  constructor(
    kind: AgentFailureKind,
    message: string,
    opts?: { infraSkip?: boolean; details?: Record<string, unknown>; cause?: unknown }
  ) {
    super(message, opts?.cause !== undefined ? { cause: opts.cause } : undefined)
    this.name = 'AgentError'
    this.kind = kind
    this.infraSkip = opts?.infraSkip ?? isOperationalFailure(kind)
    this.details = opts?.details
  }
}

export function isOperationalFailure(kind: AgentFailureKind): boolean {
  return kind === 'MissingApiKey' || kind === 'Timeout' || kind === 'SdkError'
}

export function isAgentError(err: unknown): err is AgentError {
  return err instanceof AgentError
}
