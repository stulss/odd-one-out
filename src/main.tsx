import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { createEngine } from './engine/game';
import { EngineProvider } from './hooks/useEngine';
import './styles/base.css';
import './styles/theme.css';

const engine = createEngine();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EngineProvider engine={engine}>
      <App />
    </EngineProvider>
  </StrictMode>,
);

// PWA — 오프라인 실행. 새 버전이 배포되면 자동으로 교체된다. 등록에 실패해도 게임에는 영향이 없다.
if (import.meta.env.PROD) registerSW({ immediate: true });
