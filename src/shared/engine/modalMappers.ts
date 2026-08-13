export type ModalStatus = 'ready' | 'locked'

export interface KickoffModalView {
  status: ModalStatus
  hypothesis: string | null
  style: string | null
  searchDirective: string | null
  generatedKickoffPrompt: string | null
  message?: string
}

export interface ResearchModalView {
  status: ModalStatus
  sitOut: boolean
  allocations: Array<{ symbol: string; weight: number; sector: string }>
  message?: string
}

export interface PurchasesModalView {
  status: ModalStatus
  lines: Array<{
    symbol: string
    shares: number
    rawQuote: number
    frictionFill: number
    notional: number
    commission: number
  }>
  cashResidual: number
  totals: { notional: number; commission: number }
  message?: string
}

export interface MonitoringModalView {
  status: ModalStatus
  marks: Record<string, number>
  deltas: Record<string, number>
  stops: Record<string, number>
  lastRefresh: string | null
  unrealizedNet: number
  message?: string
}

export interface OutcomeModalView {
  status: ModalStatus
  grossPnl: number | null
  netPnl: number | null
  vsSpy: number | null
  vsControl: number | null
  fullLimitReturn: number | null
  deployedReturn: number | null
  message?: string
}

export interface LessonsModalView {
  status: ModalStatus
  thoughtProcess: string | null
  nextSeed: string | null
  promoteKillNote: string | null
  message?: string
}

export function mapKickoffModal(
  artifact: {
    hypothesis?: string
    style?: string
    searchDirective?: string
    generatedKickoffPrompt?: string
  } | null
): KickoffModalView {
  if (!artifact) {
    return {
      status: 'locked',
      hypothesis: null,
      style: null,
      searchDirective: null,
      generatedKickoffPrompt: null,
      message: 'Kickoff artifact not available yet'
    }
  }
  return {
    status: 'ready',
    hypothesis: artifact.hypothesis ?? null,
    style: artifact.style ?? null,
    searchDirective: artifact.searchDirective ?? null,
    generatedKickoffPrompt: artifact.generatedKickoffPrompt ?? null
  }
}

export function mapResearchModal(
  artifact: {
    sitOut: boolean
    allocations: Array<{ symbol: string; weight: number; sector: string }>
  } | null
): ResearchModalView {
  if (!artifact) {
    return {
      status: 'locked',
      sitOut: false,
      allocations: [],
      message: 'Research artifact not available yet'
    }
  }
  return {
    status: 'ready',
    sitOut: artifact.sitOut,
    allocations: artifact.allocations
  }
}

export function mapPurchasesModal(input: {
  fills: Array<{
    symbol: string
    shares: number
    fillPrice: number
    midPrice: number
    commission: number
  }>
  cashResidual: number
  dailyLimitUsd: number
} | null): PurchasesModalView {
  if (!input) {
    return {
      status: 'locked',
      lines: [],
      cashResidual: 0,
      totals: { notional: 0, commission: 0 },
      message: 'Purchases not available yet'
    }
  }
  const lines = input.fills.map((f) => ({
    symbol: f.symbol,
    shares: f.shares,
    rawQuote: f.midPrice,
    frictionFill: f.fillPrice,
    notional: f.shares * f.fillPrice,
    commission: f.commission
  }))
  const notional = lines.reduce((s, l) => s + l.notional, 0)
  const commission = lines.reduce((s, l) => s + l.commission, 0)
  return {
    status: 'ready',
    lines,
    cashResidual: input.cashResidual,
    totals: { notional, commission }
  }
}

export function mapMonitoringModal(
  input: {
    marks: Record<string, number>
    unrealizedNet: number
    stops?: Record<string, number>
    entryMarks?: Record<string, number>
    lastRefresh?: string
  } | null
): MonitoringModalView {
  if (!input) {
    return {
      status: 'locked',
      marks: {},
      deltas: {},
      stops: {},
      lastRefresh: null,
      unrealizedNet: 0,
      message: 'Monitoring data not available yet'
    }
  }
  const deltas: Record<string, number> = {}
  const entries = input.entryMarks ?? {}
  for (const [sym, mark] of Object.entries(input.marks)) {
    const entry = entries[sym]
    deltas[sym] = entry === undefined ? 0 : mark - entry
  }
  return {
    status: 'ready',
    marks: input.marks,
    deltas,
    stops: input.stops ?? {},
    lastRefresh: input.lastRefresh ?? null,
    unrealizedNet: input.unrealizedNet
  }
}

export function mapOutcomeModal(
  input: {
    grossPnl: number
    netPnl: number
    spyReturn: number
    fullLimitReturn: number
    deployedReturn: number
    controlSameDayNet?: number
    dailyLimitUsd?: number
  } | null
): OutcomeModalView {
  if (!input) {
    return {
      status: 'locked',
      grossPnl: null,
      netPnl: null,
      vsSpy: null,
      vsControl: null,
      fullLimitReturn: null,
      deployedReturn: null,
      message: 'Outcome not available yet'
    }
  }
  const spyDollars =
    input.dailyLimitUsd !== undefined
      ? input.dailyLimitUsd * input.spyReturn
      : input.spyReturn
  return {
    status: 'ready',
    grossPnl: input.grossPnl,
    netPnl: input.netPnl,
    vsSpy: input.netPnl - spyDollars,
    vsControl:
      input.controlSameDayNet === undefined
        ? null
        : input.netPnl - input.controlSameDayNet,
    fullLimitReturn: input.fullLimitReturn,
    deployedReturn: input.deployedReturn
  }
}

export function mapLessonsModal(
  artifact: {
    thoughtProcess?: string
    nextSeed?: string
    promoteKillNote?: string
  } | null
): LessonsModalView {
  if (!artifact) {
    return {
      status: 'locked',
      thoughtProcess: null,
      nextSeed: null,
      promoteKillNote: null,
      message: 'Lessons artifact not available yet'
    }
  }
  return {
    status: 'ready',
    thoughtProcess: artifact.thoughtProcess ?? null,
    nextSeed: artifact.nextSeed ?? null,
    promoteKillNote: artifact.promoteKillNote ?? null
  }
}
