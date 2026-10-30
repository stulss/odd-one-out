import { useEffect, useRef } from 'react';
import { useEngine, useSnapshot } from '../hooks/useEngine';
import { MODES } from '../engine/game';
import type { Mode } from '../engine/save';
import { DIFF_AXES, AXIS_IDS } from '../engine/stage';
import { challengeLabel } from '../engine/daily';
import { RANKS } from '../engine/story';
import { heroTier } from '../engine/campaign';
import { attachTilt } from '../engine/fx';
import { Hero } from './Hero';
import { Logo } from './Logo';
import { Book, Coin } from './Icons';

export function TitleScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const engine = useEngine();
  const { store, challenge } = useSnapshot();
  const rootRef = useRef<HTMLElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current || !tiltRef.current) return;
    return attachTilt(rootRef.current, tiltRef.current);
  }, []);

  const b = store.best;
  const bestLine = b.stages
    ? `최고 ${b.stages}단계 · ${b.points.toLocaleString('ko-KR')}점` +
      (store.streak.count > 1 ? ` · ${store.streak.count}일 연속` : '')
    : '아직 기록이 없습니다';
  const modeDesc = MODES[store.mode].desc +
    (store.mode === 'blitz' && store.bestBlitz ? ` (최고 ${store.bestBlitz}단계)` : '');

  return (
    <section className="overlay" id="screenTitle" ref={rootRef}>
      <div className="pad" id="titlePad">
        <div className="tilt" id="titleTilt" ref={tiltRef}>
          <i className="platform" aria-hidden="true" />
          <div id="titleHero"><Hero hero={store.hero} tier={heroTier(store)} mood="happy" /></div>
        </div>
      </div>
      <div id="heroLine">{store.hero.name || '감별사'}<small>{RANKS[heroTier(store)].name}</small></div>
      <div className="brand"><Logo /><h1>딱 하나 이상함</h1></div>
      <div className="sub" id="challengeLabel">{challengeLabel(challenge)}</div>
      {challenge.rival && <div id="rivalBanner">친구의 기록 {challenge.rival}단계 — 넘어보세요</div>}

      {challenge.type === 'free' && (
        <div id="modeBox" style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
          <div className="modes" role="group" aria-label="게임 모드">
            {(Object.keys(MODES) as Mode[]).map(m => (
              <button key={m} type="button" data-mode={m} aria-pressed={store.mode === m}
                onClick={() => engine.setMode(m)}>{MODES[m].label}</button>
            ))}
          </div>
          <div id="modeDesc">{modeDesc}</div>
          {store.mode === 'practice' && (
            <div id="axisBox">
              <label htmlFor="practiceAxis" className="sub">연습할 차이&nbsp;</label>
              <select id="practiceAxis" value={store.practiceAxis}
                onChange={e => engine.setPracticeAxis(e.target.value)}>
                <option value="">무작위</option>
                {AXIS_IDS.map(id => <option key={id} value={id}>{DIFF_AXES[id].label}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      <div className="titleBtns">
        <button className="btn" id="btnStart" type="button" onClick={() => engine.startPlay()}>{store.mode === 'case' && challenge.type === 'free' ? '▶ 사건부 열기' : '▶ 시작하기'}</button>
        <div className="row2">
          <button className="btn ghost" id="btnDaily" type="button" onClick={() => engine.playDaily()}>오늘의 문제</button>
          <button className="btn ghost" id="btnTitleSettings" type="button" onClick={onOpenSettings}>설정 · 업적</button>
        </div>
      </div>
      <div className="row2 links">
        <button className="linkbtn" id="btnHeroEdit" type="button" onClick={() => engine.openCreator()}>캐릭터 바꾸기</button>
        <button className="linkbtn" id="btnTitleCodex" type="button" onClick={() => engine.openCodex()}><Book /> 도감 · 상점 (<Coin /> {store.coins})</button>
      </div>
      <div className="sub" id="bestLine">{bestLine}</div>
      <div className="hint">여러 개 중 딱 하나만 다릅니다 · 오답은 시간 −1초</div>
    </section>
  );
}
