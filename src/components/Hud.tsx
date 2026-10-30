// 상단 HUD — 시간 게이지 · 구역 · 단계 · 점수 · 콤보 · 캐릭터.
// 게이지는 매 프레임 바뀌므로 React 상태가 아니라 ref로 직접 갱신한다 (리렌더 0).
import { useEffect, useRef, useState } from 'react';
import { useEngine, useSnapshot } from '../hooks/useEngine';
import { zoneOf, tierOf } from '../engine/story';
import { heroTier } from '../engine/campaign';
import { MODS } from '../engine/modifiers';
import { Hero } from './Hero';
import { BossFigure } from './BossFigure';
import { Bulb, Clock } from './Icons';

export function Hud({ onOpenSettings }: { onOpenSettings: () => void }) {
  const engine = useEngine();
  const snap = useSnapshot();
  const gaugeRef = useRef<HTMLDivElement>(null);

  useEffect(() => engine.onTick((left, limit) => {
    const g = gaugeRef.current;
    if (!g) return;
    g.style.transform = `scaleX(${Math.min(1, Math.max(0, left / limit))})`; // 시계로 늘어난 시간은 게이지가 가득 찬 채로 보여 준다
    g.classList.toggle('warn', left / limit < 0.3);
    const app = g.closest('#app') as HTMLElement | null;
    if (app) app.dataset.warn = left / limit < 0.25 && left > 0 ? '1' : ''; // 위험 비네트
  }), [engine]);

  // 새 판이 시작되면 게이지를 가득 채운다 (일시정지 후 재시작·연습 모드 포함)
  useEffect(() => {
    if (snap.n === 1 && snap.screen === 'PLAY' && gaugeRef.current) {
      gaugeRef.current.style.transform = 'scaleX(1)';
      gaugeRef.current.classList.remove('warn');
    }
  }, [snap.n, snap.screen, snap.stageId]);

  // 게임 중이 아니면 위험 표시를 끈다
  useEffect(() => {
    if (snap.screen !== 'PLAY') { const app = gaugeRef.current?.closest('#app') as HTMLElement | null; if (app) app.dataset.warn = ''; }
  }, [snap.screen]);

  const z = zoneOf(snap.n);
  const cr = snap.caseRun;
  // 사건부: 진행도로 정해진 모습 / 그 밖: 이번 판 단계에 따라 진화 (둘 중 높은 쪽)
  const tier = cr ? heroTier(snap.store) : Math.max(tierOf(snap.n - 1), heroTier(snap.store));

  // 등급이 오르면 한 번만 진화 연출을 건다
  const [evolvedTier, setEvolvedTier] = useState(tier);
  const lastTier = useRef(tier);
  useEffect(() => {
    if (tier > lastTier.current) setEvolvedTier(tier);
    lastTier.current = tier;
  }, [tier]);

  return (
    <header id="hud">
      <div id="gaugeTrack"><div id="gauge" ref={gaugeRef} /></div>
      <div id="hudRow">
        <div id="heroMini" aria-hidden="true">
          <Hero key={tier} hero={snap.store.hero} tier={tier} mood={snap.mood} evolve={evolvedTier === tier && tier > 0} />
        </div>
        <div className="hudCol">
          <span className="k" id="zoneName">{cr ? `CASE ${cr.id} · ${cr.title}` : `ZONE ${z.idx + 1} · ${z.name}`}</span>
          <span className="hudStat">
            <span className="k">{cr ? 'ROUND' : 'STAGE'}</span><b id="stageNo">{cr ? `${cr.round}/${cr.rounds}` : snap.n}</b>
            {!cr && <><span className="k">SCORE</span><b id="points">{snap.points.toLocaleString('ko-KR')}</b></>}  {/* 사건부에서는 점수 대신 별·코인이 목표다 */}
          </span>
        </div>
        {snap.combo >= 3 && (
          <span id="comboChip" key={snap.combo} className={'bump' + (snap.combo >= 10 ? ' hot' : '')}>
            🔥 x{snap.combo}
          </span>
        )}
        <span className="sp">
          <button className="icon" id="btnPause" type="button" title="일시정지 (P)" aria-label="일시정지"
            onClick={() => engine.togglePause()}>❙❙</button>
          <button className="icon" id="btnSettings" type="button" title="설정" aria-label="설정"
            onClick={onOpenSettings}>⚙</button>
        </span>
      </div>
      {/* 아이템 줄: 이번 라운드의 변주 안내(왼쪽)와 힌트·시계 버튼(오른쪽). 줄은 항상 있어서 변주가 생겨도 화면이 밀리지 않는다 */}
      {(cr || (snap.mode === 'normal' && snap.screen === 'PLAY')) && (
        <div className="itemRow" id="itemRow">
          {snap.modifier
            ? (
              <div className={'modChip ' + snap.modifier} id="modChip" key={snap.stageId}>
                {MODS[snap.modifier].icon} {MODS[snap.modifier].label} — {MODS[snap.modifier].desc}
              </div>
            )
            : <span className="itemSpacer" />}
          <button className="icon hintBtn" id="btnClock" type="button" title="시계 +5초 (C)" aria-label={`시계 ${snap.store.clocks}개`}
            onClick={() => engine.useClock()}><Clock /><small>{snap.store.clocks}</small></button>
          {cr && (
            <button className="icon hintBtn" id="btnHint" type="button" title="힌트 (H)" aria-label={`힌트 ${snap.store.hints}개`}
              disabled={snap.hintIndex !== null} onClick={() => engine.useHint()}><Bulb /><small>{snap.store.hints}</small></button>
          )}
        </div>
      )}
      {snap.boss && (
        <div className="bossBar" id="bossBar">
          <div className={'bossIcon' + (snap.boss.hitId > 0 ? ' hit' : '')} key={snap.boss.hitId}>
            <BossFigure boss={snap.boss.def} defeated={snap.boss.hp === 0} small />
            {snap.boss.hitId > 0 && <span className="dmg">-1</span>}
          </div>
          <div className="bossMain">
            <div className="bossName">
              {snap.boss.taunt
                ? <em className="taunt" key={snap.boss.taunt.id}>“{snap.boss.taunt.text}”</em>
                : <>👹 {snap.boss.def.name}</>}
            </div>
            <div className="hpBar" role="img" aria-label={`보스 체력 ${snap.boss.hp}/${snap.boss.maxHp}`}>
              {Array.from({ length: snap.boss.maxHp }, (_, i) => <i key={i} className={'hpSeg' + (i < snap.boss!.hp ? ' on' : '')} />)}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
