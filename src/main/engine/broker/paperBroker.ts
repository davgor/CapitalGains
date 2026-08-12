import type { BrokerPort, PlaceOrderRequest, Position } from '../../../shared/engine/ports'
import type { FrictionConfig } from '../../../shared/engine/types'
import { DEFAULT_FRICTION } from '../../../shared/engine/types'
import type { MarketDataPort } from '../../../shared/engine/ports'

interface PaperBrokerOptions {
  marketData: MarketDataPort
  clock: { now(): Date }
  startingCash: number
  friction?: FrictionConfig
}

type FillHydration = {
  symbol: string
  side: 'buy' | 'sell'
  shares: number
  fillPrice: number
  commission: number
  idempotencyKey: string
}

export function createPaperBroker(opts: PaperBrokerOptions): BrokerPort & {
  hydrateFromFills: (fills: FillHydration[]) => void
} {
  const friction = opts.friction ?? DEFAULT_FRICTION
  const state = emptyState(opts.startingCash)
  return {
    placeOrder: (req) => place(opts, friction, state, req),
    getPositions: () => [...state.positions.values()],
    flattenAll: () => flatten(opts, friction, state),
    getCash: () => state.cash,
    hydrateFromFills: (fills) => hydrate(state, opts.startingCash, fills)
  }
}

export function applyFriction(opts: {
  side: 'buy' | 'sell'
  mid: number
  friction: FrictionConfig
}): number {
  const halfSpread = opts.mid * (opts.friction.spreadBps / 10_000) * 0.5
  const slip = opts.mid * (opts.friction.slippageBps / 10_000)
  if (opts.side === 'buy') {
    return opts.mid + halfSpread + slip
  }
  return opts.mid - halfSpread - slip
}

export function grossPnl(opts: {
  buyMidNotional: number
  sellMidNotional: number
}): number {
  return opts.sellMidNotional - opts.buyMidNotional
}

export function netPnl(opts: {
  buyFillNotional: number
  sellFillNotional: number
  commissions: number
}): number {
  return opts.sellFillNotional - opts.buyFillNotional - opts.commissions
}

export function allocateWholeShares(opts: {
  dailyLimitUsd: number
  weights: Array<{ symbol: string; weight: number; price: number }>
}): Array<{ symbol: string; shares: number; notional: number }> {
  const legs = []
  for (const w of opts.weights) {
    const budget = opts.dailyLimitUsd * w.weight
    const shares = Math.floor(budget / w.price)
    legs.push({ symbol: w.symbol, shares, notional: shares * w.price })
  }
  return legs
}

interface BrokerState {
  cash: number
  positions: Map<string, Position>
  seenKeys: Map<string, { fillPrice: number; midPrice: number; commission: number }>
}

function emptyState(startingCash: number): BrokerState {
  return {
    cash: startingCash,
    positions: new Map(),
    seenKeys: new Map()
  }
}

function hydrate(state: BrokerState, startingCash: number, fills: FillHydration[]): void {
  state.cash = startingCash
  state.positions.clear()
  state.seenKeys.clear()
  for (const f of fills) {
    applyCashAndPosition({
      state,
      req: {
        symbol: f.symbol,
        side: f.side,
        shares: f.shares,
        idempotencyKey: f.idempotencyKey
      },
      fillPrice: f.fillPrice,
      notional: f.fillPrice * f.shares,
      commission: f.commission
    })
    state.seenKeys.set(f.idempotencyKey, {
      fillPrice: f.fillPrice,
      midPrice: f.fillPrice,
      commission: f.commission
    })
  }
}

function place(
  opts: PaperBrokerOptions,
  friction: FrictionConfig,
  state: BrokerState,
  req: PlaceOrderRequest
): { fillPrice: number; midPrice: number; commission: number } {
  const prior = state.seenKeys.get(req.idempotencyKey)
  if (prior) {
    return prior
  }
  const quote = opts.marketData.getQuote(req.symbol, opts.clock.now())
  const mid = (quote.bid + quote.ask) / 2
  const fillPrice = applyFriction({ side: req.side, mid, friction })
  const commission = friction.commissionPerShare * req.shares
  applyCashAndPosition({
    state,
    req,
    fillPrice,
    notional: fillPrice * req.shares,
    commission
  })
  const result = { fillPrice, midPrice: mid, commission }
  state.seenKeys.set(req.idempotencyKey, result)
  return result
}

function applyCashAndPosition(opts: {
  state: BrokerState
  req: PlaceOrderRequest
  fillPrice: number
  notional: number
  commission: number
}): void {
  if (opts.req.side === 'buy') {
    applyBuy(opts)
    return
  }
  applySell(opts)
}

function applyBuy(opts: {
  state: BrokerState
  req: PlaceOrderRequest
  fillPrice: number
  notional: number
  commission: number
}): void {
  opts.state.cash -= opts.notional + opts.commission
  const prev = opts.state.positions.get(opts.req.symbol)
  const shares = (prev?.shares ?? 0) + opts.req.shares
  const cost = (prev ? prev.avgCost * prev.shares : 0) + opts.fillPrice * opts.req.shares
  opts.state.positions.set(opts.req.symbol, {
    symbol: opts.req.symbol,
    shares,
    avgCost: cost / shares
  })
}

function applySell(opts: {
  state: BrokerState
  req: PlaceOrderRequest
  notional: number
  commission: number
}): void {
  opts.state.cash += opts.notional - opts.commission
  const prev = opts.state.positions.get(opts.req.symbol)
  const left = (prev?.shares ?? 0) - opts.req.shares
  if (left <= 0) {
    opts.state.positions.delete(opts.req.symbol)
  } else if (prev) {
    opts.state.positions.set(opts.req.symbol, { ...prev, shares: left })
  }
}

function flatten(
  opts: PaperBrokerOptions,
  friction: FrictionConfig,
  state: BrokerState
): Array<{
  symbol: string
  shares: number
  fillPrice: number
  midPrice: number
  commission: number
}> {
  const results = []
  const openSymbols = Array.from(state.positions.keys())
  for (const symbol of openSymbols) {
    const pos = state.positions.get(symbol)
    if (!pos) {
      continue
    }
    const fill = place(opts, friction, state, {
      symbol: pos.symbol,
      side: 'sell',
      shares: pos.shares,
      idempotencyKey: `flatten:${pos.symbol}:${opts.clock.now().toISOString()}`
    })
    results.push({ symbol: pos.symbol, shares: pos.shares, ...fill })
  }
  return results
}
