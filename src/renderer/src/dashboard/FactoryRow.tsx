import type { FactoryRowView } from '../../../shared/engine/dashboardApi'
import type { PromoteRecommendation } from '../../../shared/engine/promote'
import type { UiStageName } from '../../../shared/engine/stageVisual'
import { StageChips } from './StageChips'

export function FactoryRow(props: {
  factory: FactoryRowView
  recommendation: PromoteRecommendation | null
  onRename: () => void
  onOpenStage: (stage: UiStageName) => void
  onPromote: (action: 'promote' | 'kill' | 'clone') => void
}): JSX.Element {
  const f = props.factory
  return (
    <article className="factory-row" data-role={f.role}>
      <div className="factory-meta">
        <button type="button" className="factory-name" onClick={props.onRename}>
          {f.name}
        </button>
        <span className={`role-badge role-${f.role.toLowerCase()}`}>{f.role}</span>
        <span className="evidence-weight">wt {f.evidenceWeight.toFixed(2)}</span>
        <span className="factory-cash">{formatUsd(f.allocatedCash)} pile</span>
        <span className="factory-pnl">{formatUsd(f.netDailyProfit)} net</span>
        {f.queuedNextOpen ? <span className="queue-flag">queued next open</span> : null}
        {f.protectedControl ? <span className="protect-flag">protected</span> : null}
      </div>
      <StageChips
        nodes={f.stageNodes}
        onSelect={(stage, opens) => {
          if (opens) {
            props.onOpenStage(stage)
          }
        }}
      />
      {!f.protectedControl ? (
        <div className="promote-controls">
          {props.recommendation ? (
            <span className="promote-hint">
              pending: {props.recommendation.action} — {props.recommendation.reason}
            </span>
          ) : null}
          <button type="button" className="btn-ghost" onClick={() => props.onPromote('promote')}>
            Promote
          </button>
          <button type="button" className="btn-ghost danger" onClick={() => props.onPromote('kill')}>
            Kill
          </button>
          <button type="button" className="btn-ghost" onClick={() => props.onPromote('clone')}>
            Clone
          </button>
        </div>
      ) : null}
    </article>
  )
}

function formatUsd(n: number): string {
  return `$${n.toFixed(0)}`
}
