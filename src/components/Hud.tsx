// 상단 HUD — 시간 게이지 · 구역 · 단계 · 점수 · 콤보 · 캐릭터.
// 게이지는 매 프레임 바뀌므로 React 상태가 아니라 ref로 직접 갱신한다 (리렌더 0).
import { useEffect, useRef, useState } from 'react';
import { useEngine, useSnapshot } from '../hooks/useEngine';
import { zoneOf, tierOf } from '../engine/story';
import { heroTier } from '../engine/campaign';
import { Hero } from './Hero';
import { BossFigure } from './BossFigure';

export function Hud({ onOpenSettings }: { onOpenSettings: () => void }) {
  const engine = useEngine();
  const snap = useSnapshot();
  const gaugeRef = useRef<HTMLDivElement>(null);

  useEffect(() => engine.onTick((left, limit) => {
    const g = gaugeRef.current;
    if (!g) return;
    g.style.transform = `scaleX(${Math.max(0, left / limit)})`;
    g.classList.toggle('warn', left / limit < 0.3);
  }), [engine]);

  // 새 판이 시작되면 게이지를 가득 채운다 (일시정지 후 재시작·연습 모드 포함)
  useEffect(() => {
    if (snap.n === 1 && snap.screen === 'PLAY' && gaugeRef.current) {
      gaugeRef.current.style.transform = 'scaleX(1)';
      gaugeRef.current.classList.remove('warn');
    }
  }, [snap.n, snap.screen, snap.stageId]);

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
            <span className="k">SCORE</span><b id="points">{snap.points.toLocaleString('ko-KR')}</b>
          </span>
        </div>
        {snap.combo >= 3 && (
          <span id="comboChip" key={snap.combo} className={'bump' + (snap.combo >= 10 ? ' hot' : '')}>
            🔥 x{snap.combo}
          </span>
        )}
        <span className="sp">
          {cr && (
            <button className="icon hintBtn" id="btnHint" type="button" title="힌트 (H)" aria-label={`힌트 ${snap.store.hints}개`}
              disabled={snap.hintIndex !== null} onClick={() => engine.useHint()}>💡<small>{snap.store.hints}</small></button>
          )}
          <button className="icon" id="btnPause" type="button" title="일시정지 (P)" aria-label="일시정지"
            onClick={() => engine.togglePause()}>❙❙</button>
          <button className="icon" id="btnSettings" type="button" title="설정" aria-label="설정"
            onClick={onOpenSettings}>⚙</button>
        </span>
      </div>
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
