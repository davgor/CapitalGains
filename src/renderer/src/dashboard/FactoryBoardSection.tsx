import type { DashboardSnapshot, StageModalPayload } from '../../../shared/engine/dashboardApi'
import { FactoryRow } from './FactoryRow'

export function FactoryBoardSection(props: {
  snapshot: DashboardSnapshot
  onAddFactory: () => void
  onRename: (id: string, name: string) => void
  onOpenStage: (factoryId: string, factoryName: string, stage: StageModalPayload['stage']) => void
  onPromote: (factoryId: string, action: 'promote' | 'kill' | 'clone') => void
}): JSX.Element {
  return (
    <section className="factory-board" aria-label="Factories">
      <div className="factory-board-head">
        <h2>Factory grid</h2>
        <button type="button" className="btn-ghost" onClick={() => void props.onAddFactory()}>
          + Add explorer
        </button>
      </div>
      {props.snapshot.factories.length === 0 ? (
        <p className="empty-hint">No factories yet. Add Control/explorers to begin a paper day.</p>
      ) : (
        props.snapshot.factories.map((factory) => (
          <FactoryRow
            key={factory.id}
            factory={factory}
            recommendation={
              props.snapshot.promoteRecommendations.find((r) => r.factoryId === factory.id) ?? null
            }
            onRename={() => void props.onRename(factory.id, factory.name)}
            onOpenStage={(stage) => void props.onOpenStage(factory.id, factory.name, stage)}
            onPromote={(action) => void props.onPromote(factory.id, action)}
          />
        ))
      )}
    </section>
  )
}
