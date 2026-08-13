/** Aggregate session-day Daily Profit from friction-adjusted net outcomes. */
export function aggregateDailyProfit(
  outcomes: Array<{ netPnl: number; grossPnl?: number }>
): number {
  return outcomes.reduce((sum, o) => sum + o.netPnl, 0)
}
