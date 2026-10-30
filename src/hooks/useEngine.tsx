// 엔진을 React에 연결한다.
//  · useSnapshot — 화면에 필요한 불변 스냅샷 (useSyncExternalStore)
//  · useEngine   — 명령(newGame, select …)을 부르는 엔진 자체
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import type { Engine, Snapshot } from '../engine/game';

const EngineContext = createContext<Engine | null>(null);

export function EngineProvider({ engine, children }: { engine: Engine; children: ReactNode }) {
  return <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>;
}

export function useEngine(): Engine {
  const e = useContext(EngineContext);
  if (!e) throw new Error('EngineProvider 안에서만 쓸 수 있습니다');
  return e;
}

export function useSnapshot(): Snapshot {
  const e = useEngine();
  return useSyncExternalStore(e.subscribe, e.getSnapshot);
}
