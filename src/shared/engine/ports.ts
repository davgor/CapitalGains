import type { AgentPromptRequest, AgentPromptResult } from '../agent/types'
import type { Quote } from './types'

/** Injectable wall-clock for deterministic tests (America/New_York sessions). */
export interface Clock {
  now(): Date
}

/**
 * Thin one-shot agent seam for Kickoff / Research / Lessons.
 * Production uses Cursor SDK when CURSOR_API_KEY is present; tests inject a mock.
 */
export interface AgentPort {
  runPrompt(req: AgentPromptRequest): Promise<AgentPromptResult>
}

/** Market data seam — real provider adapter lands in epic 010. */
export interface MarketDataPort {
  getQuote(symbol: string, asOf: Date): Quote
  getSnapshot(symbols: string[], asOf: Date): Quote[]
}

export interface PlaceOrderRequest {
  symbol: string
  side: 'buy' | 'sell'
  shares: number
  idempotencyKey: string
}

export interface Position {
  symbol: string
  shares: number
  avgCost: number
}

/**
 * Broker execution seam.
 * Paper fills live here in Phase 1; a live adapter can replace this port in epic 010
 * without changing the stage machine (same placeOrder / getPositions / flattenAll / getCash).
 */
export interface BrokerPort {
  placeOrder(req: PlaceOrderRequest): { fillPrice: number; midPrice: number; commission: number }
  getPositions(): Position[]
  flattenAll(): Array<{ symbol: string; shares: number; fillPrice: number; midPrice: number; commission: number }>
  getCash(): number
}

export function isQuoteStale(quote: Quote, maxAgeMs: number): boolean {
  return quote.ageMs > maxAgeMs
}
