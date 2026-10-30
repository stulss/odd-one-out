import { useEffect, useRef, useState } from 'react';
import { useEngine, useSnapshot } from './hooks/useEngine';
import { attachTilt, createFx } from './engine/fx';
import type { Screen } from './engine/game';
import { Hud } from './components/Hud';
import { BgScene } from './components/BgScene';
import { Board } from './components/Board';
import { TitleScreen } from './components/TitleScreen';
import { HeroScreen } from './components/HeroScreen';
import { StoryScreen } from './components/StoryScreen';
import { PauseScreen, ResultScreen } from './components/ResultScreen';
import { SettingsSheet } from './components/SettingsSheet';
import { CaseResultScreen, CodexScreen, MapScreen } from './components/CaseScreens';

const STATUS: Record<Screen, string> = {
  TITLE: '대기 중', PLAY: '진행 중', PAUSED: '일시정지', RESULT: '종료', HERO: '캐릭터 만들기', STORY: '이야기',
  MAP: '사건 지도', CASE_RESULT: '사건 결과', CODEX: '도감·상점',
};

export function App() {
  const engine = useEngine();
  const snap = useSnapshot();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const appRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const stageAreaRef = useRef<HTMLElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLDivElement>(null);

  // 엔진 시작 · 포커스 이탈 감시 · 개발용 핸들
  useEffect(() => {
    const detach = engine.attach();
    engine.boot();
    (window as unknown as { __game: unknown }).__game = engine;
    return detach;
  }, [engine]);

  // 설정이 바뀌면 문서 속성(움직임 줄이기·고대비)에 반영 — CSS와 연출 코드가 이 속성을 읽는다
  const { reducedMotion, highContrast, hero3d } = snap.store.settings;
  useEffect(() => {
    document.documentElement.dataset.reduced = reducedMotion ? 'on' : 'off';
    document.documentElement.dataset.contrast = highContrast ? 'on' : 'off';
    document.documentElement.dataset.hero3d = hero3d ? 'on' : 'off';
  }, [reducedMotion, highContrast, hero3d]);

  // 구역 테마색 (CSS 변수 --zh가 부드럽게 전환된다)
  useEffect(() => {
    document.documentElement.style.setProperty('--zh', String(snap.themeHue));
  }, [snap.themeHue]);

  // 연출: 엔진이 알려 주는 사건(정답·오답·새 판…)을 DOM 효과로 바꾼다. 리렌더 없이 직접 그린다.
  useEffect(() => {
    const app = appRef.current, layer = layerRef.current, flash = flashRef.current;
    const area = stageAreaRef.current, board = boardRef.current;
    if (!app || !layer || !flash || !area || !board) return;
    const fx = createFx({ app, layer, flash, shakeTarget: area, board, confetti: confettiRef.current ?? undefined });
    const mark = (i: number, cls: string) => {
      const el = board.children[i];
      if (!el) return;
      el.classList.add(cls);
      window.setTimeout(() => el.classList.remove(cls), 260);
    };
    return engine.onFx(e => {
      switch (e.type) {
        case 'correct':
          mark(e.index, 'is-correct');
          fx.burst(board.children[e.index], e.power, e.hue);
          if (e.milestone) { fx.shake(0.35); fx.pulse('rgb(255 180 84)', 0.45); }
          {
            const cell = board.children[e.index];
            fx.popText(cell, `+${e.gain}`, e.coins ? '#ffd75e' : '#fff');
            if (e.coins) window.setTimeout(() => fx.popText(cell, `🪙+${e.coins}`, '#ffd75e', true), 120);
            else if (e.fast) window.setTimeout(() => fx.popText(cell, 'FAST!', '#5EE6C5', true), 120);
            if (e.combo === 3 || e.combo === 5 || e.combo === 8 || e.combo === 10 || (e.combo > 10 && e.combo % 5 === 0)) {
              fx.banner(`COMBO x${e.combo}!`, e.combo >= 10 ? '#ff8a4c' : '#ffd75e');
            }
          }
          break;
        case 'confetti':
          fx.confetti(e.big);
          break;
        case 'modifier':
          fx.banner(e.mod === 'rush' ? '⚡ 번개 판!' : '🌟 황금 판!', e.mod === 'rush' ? '#ff6b6b' : '#ffd75e');
          fx.pulse(e.mod === 'rush' ? 'rgb(255 80 80)' : 'rgb(255 215 94)', 0.5);
          break;
        case 'wrong':
          mark(e.index, 'is-wrong');
          fx.shake(0.55);
          fx.pulse('rgb(255 107 107)', 0.55);
          break;
        case 'over':
          fx.shake(0.7);
          fx.pulse('rgb(255 107 107)', 0.5);
          break;
        case 'stage':
          fx.boardIn();
          break;
        case 'zone':
          fx.pulse(`hsl(${e.hue} 80% 55%)`, 0.6);
          break;
        case 'bossDown': { // 보스 격파: 흰 섬광 + 큰 흔들림 + 보스 아이콘에서 파티클 폭발
          fx.shake(0.9);
          fx.pulse('rgb(255 255 255)', 0.85);
          const icon = document.getElementById('bossFig') ?? app.querySelector('.bossFig');
          if (icon) { fx.burst(icon, 3, 0); fx.burst(icon, 3, 40); fx.burst(icon, 3, 340); }
          break;
        }
      }
    });
  }, [engine]);

  // 배경 3D 장면: 포인터 위치에 따라 살짝 돌아간다 (게임 중에는 보이지 않는다)
  useEffect(() => {
    if (!appRef.current || !worldRef.current) return;
    return attachTilt(appRef.current, worldRef.current, 7);
  }, []);

  // 토스트
  const toastId = snap.toast?.id;
  const [toastOn, setToastOn] = useState(false);
  useEffect(() => {
    if (toastId == null) return;
    setToastOn(true);
    const t = window.setTimeout(() => setToastOn(false), 1600);
    return () => clearTimeout(t);
  }, [toastId]);

  const { screen } = snap;
  // 게임 밖 화면에서는 판·HUD를 치우고 3D 배경 장면을 보여 준다 (판 위에는 장식이 올라오지 않는다 — 공정성)
  const bg = screen === 'PLAY' || screen === 'PAUSED' || screen === 'STORY' ? 'off' : 'on';
  return (
    <div id="app" ref={appRef} data-screen={screen} data-bg={bg}>
      <BgScene worldRef={worldRef} hue={snap.themeHue} />
      <div id="fxLayer" ref={layerRef} aria-hidden="true" />
      <div id="flash" ref={flashRef} aria-hidden="true" />
      <div id="confettiLayer" ref={confettiRef} aria-hidden="true" />

      <Hud onOpenSettings={() => setSettingsOpen(true)} />
      <Board stageAreaRef={stageAreaRef} boardRef={boardRef} />

      <footer id="info">
        <div><b>규칙</b> 여러 개 중 딱 하나만 다릅니다. 제한 시간 안에 그것을 찾으세요. 오답은 시간 1초 차감.</div>
        <div><b>조작</b> 클릭·터치 · 방향키로 이동 후 Enter · P 또는 Esc로 일시정지</div>
        <div id="statusLine">
          {`상태: ${STATUS[screen]} · 단계 ${snap.n} · 난이도 T=${snap.store.settings.tuneT.toFixed(1)}`}
        </div>
      </footer>

      {screen === 'TITLE' && <TitleScreen onOpenSettings={() => setSettingsOpen(true)} />}
      {screen === 'HERO' && <HeroScreen />}
      {screen === 'STORY' && snap.dialog && (
        <StoryScreen key={snap.dialog.id} req={snap.dialog} onDone={() => engine.finishDialog()} />
      )}
      {screen === 'PAUSED' && <PauseScreen />}
      {screen === 'RESULT' && <ResultScreen />}
      {screen === 'MAP' && <MapScreen />}
      {screen === 'CASE_RESULT' && <CaseResultScreen />}
      {screen === 'CODEX' && <CodexScreen />}

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}

      <div id="toast" role="status" aria-live="polite" className={toastOn ? 'show' : ''}>{snap.toast?.msg}</div>
      <div id="srLive" className="sr-only" aria-live="polite">{snap.announce.msg}</div>
    </div>
  );
}
