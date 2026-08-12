# Broker port seam (paper → live)

Phase 1 executes through `BrokerPort` (`placeOrder` / `getPositions` / `flattenAll` / `getCash`) implemented by the friction-aware paper broker.

A live broker adapter (epic 010) should implement the same interface so the stage machine and orchestrator do not change. Paper fills never use raw last print as the fill price — spread + slippage bps + commission always apply.

Types: `src/shared/engine/ports.ts`  
Paper impl: `src/main/engine/broker/paperBroker.ts`
