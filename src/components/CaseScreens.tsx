// 사건부 화면 3종: 사건 지도 · 사건 결과 · 도감/상점
import { useEffect, useRef, type CSSProperties } from 'react';
import { useEngine, useSnapshot } from '../hooks/useEngine';
import {
  CASES, CASES_PER_ZONE, CODEX_MILESTONES, CODEX_REWARDS, HINT_PACK, HINT_PRICE, MAX_STARS,
  clearedCount, currentCase, isCaseUnlocked, readCodex, starsOf, totalStars, TOTAL_CASES, zoneHue, zoneName,
} from '../engine/campaign';
import { OBJECTS } from '../engine/objects';
import { Hero } from './Hero';
import { ObjectIcon } from './ObjectIcon';
import { Book, Bulb, Clock, Coin, Star, Target } from './Icons';
import { bossOf } from '../engine/bosses';

const Stars = ({ n, big = false }: { n: number; big?: boolean }) => (
  <span className={'stars' + (big ? ' big' : '')} aria-label={`별 ${n}개`}>
    {Array.from({ length: MAX_STARS }, (_, i) => <i key={i} className={i < n ? 'on' : ''}>★</i>)}
  </span>
);

const Wallet = () => {
  const { store } = useSnapshot();
  return <div className="wallet" aria-label="보유 재화"><span><Coin /> {store.coins}</span><span><Bulb /> {store.hints}</span><span><Clock /> {store.clocks}</span></div>;
};

/* ───────── 사건 지도 ───────── */
export function MapScreen() {
  const engine = useEngine();
  const { store, missions } = useSnapshot();
  const curRef = useRef<HTMLButtonElement>(null);
  const cur = currentCase(store);

  // 지금 도전할 사건이 보이도록 스크롤
  useEffect(() => { curRef.current?.scrollIntoView({ block: 'center' }); }, []);

  const zones = Array.from({ length: TOTAL_CASES / CASES_PER_ZONE }, (_, z) => z);
  return (
    <section className="overlay" id="screenMap">
      <div className="mapTop">
        <button className="linkbtn" id="btnMapBack" type="button" onClick={() => engine.goTitle()}>‹ 처음으로</button>
        <Wallet />
      </div>
      <h1>감별 사건부</h1>
      <div className="sub" id="mapSummary">해결 {clearedCount(store)}/{TOTAL_CASES} · <Star /> {totalStars(store)}/{TOTAL_CASES * MAX_STARS}</div>
      <div className="missions" id="missions">
        <div className="missionsHead"><Target /> 오늘의 임무</div>
        {missions.map(m => (
          <div className={'mission' + (m.done ? ' done' : '')} key={m.idx} data-mission={m.idx}>
            <div className="mText"><span>{m.label}</span>
              <div className="mBar"><i style={{ width: `${(m.cur / m.goal) * 100}%` }} /></div>
            </div>
            <span className="mProg">{m.cur}/{m.goal}</span>
            {m.claimed
              ? <span className="mDone">✓</span>
              : <button className="mClaim" type="button" disabled={!m.done} onClick={() => engine.claimMission(m.idx)}><Coin /> {m.reward}</button>}
          </div>
        ))}
      </div>
      <div className="mapScroll">
        {zones.map(z => (
          <div className="zoneBlock" key={z} style={{ '--zh': zoneHue(z), '--i': z } as CSSProperties}>
            <div className="zoneMark" style={{ '--hue': zoneHue(z) } as CSSProperties} aria-hidden="true"><ObjectIcon kind={bossOf((z + 1) * CASES_PER_ZONE)?.kind ?? 0} /></div>
            <div className="zoneHead">ZONE {z + 1} · {zoneName(z)}</div>
            <div className="caseRow">
              {CASES.filter(c => c.zone === z).map(c => {
                const i = c.id - 1;
                const open = isCaseUnlocked(store, i);
                const stars = starsOf(store, i);
                return (
                  <button
                    key={c.id} type="button" ref={i === cur ? curRef : undefined}
                    className={'caseNode' + (c.finale ? ' finale' : '') + (!open ? ' locked' : '') + (i === cur ? ' current' : '') + (stars ? ' done' : '')}
                    disabled={!open} data-case={c.id} aria-label={`사건 ${c.id} ${c.title}${open ? '' : ' (잠김)'}`}
                    onClick={() => engine.startCase(i)}
                  >
                    <b>{open ? (c.finale ? '👑' : c.id) : '🔒'}</b>
                    <span className="ct">{c.title}</span>
                    <Stars n={stars} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <button className="btn ghost" id="btnOpenCodex" type="button" onClick={() => engine.openCodex()}><Book /> 도감 · 상점</button>
    </section>
  );
}

/* ───────── 사건 결과 ───────── */
export function CaseResultScreen() {
  const engine = useEngine();
  const { caseResult: r, store } = useSnapshot();
  if (!r) return null;
  return (
    <section className="overlay" id="screenCaseResult">
      <div className="pad"><div className="tilt">
        <i className="platform" aria-hidden="true" />
        <div id="resultHero"><Hero hero={store.hero} tier={r.tier} mood={r.success ? 'happy' : 'dizzy'} evolve={r.promoted} /></div>
      </div></div>
      <div className={'stamp ' + (r.success ? 'ok' : 'fail')} aria-hidden="true">{r.success ? 'CLEAR' : 'FAILED'}</div>
      <div className="sub" id="crTitle">{r.success ? '사건 해결!' : '수사 실패 — 시간 초과'}</div>
      <h2 className="crName">{r.title}</h2>
      {r.success
        ? <Stars n={r.stars} big />
        : <div className="sub">라운드 {r.roundsDone}/{r.rounds}에서 멈췄어요</div>}
      <div className="crStats" id="crStats">
        {r.success && <span>오답 {r.wrongs}회</span>}
        {r.success && r.avgReaction != null && <span>평균 {r.avgReaction.toFixed(2)}초</span>}
        {r.success && r.stars < MAX_STARS && <span className="hintText">{r.stars === 1 ? '오답 1회 이하면 ★2' : '오답 없이 빠르게 풀면 ★3'}</span>}
      </div>
      {r.success && <div className="crCoins" id="crCoins"><Coin /> +{r.coins}{r.firstClear ? ' (첫 해결 보너스 포함)' : ''}{r.bonus ? ` · 번개·황금 판 +${r.bonus}` : ''}</div>}
      {r.unlockText && <div className="crUnlock" id="crUnlock">🎁 {r.unlockText}</div>}
      {r.promoted && <div className="crUnlock">▲ 감별사 등급이 올랐어요!</div>}
      <div id="resultNpc">렌즈: “{r.npc}”</div>
      <div id="resultAch" role="status">{r.ach}</div>
      {r.hasNext && <button className="btn" id="btnNextCase" type="button" onClick={() => engine.nextCase()}>다음 사건 ▶</button>}
      <button className={'btn' + (r.hasNext ? ' ghost' : '')} id="btnRetryCase" type="button" onClick={() => engine.retryCase()}>
        {r.success ? '다시 도전 (별 올리기)' : '다시 도전'}
      </button>
      <button className="btn ghost" id="btnToMap" type="button" onClick={() => engine.openMap()}>사건 지도</button>
    </section>
  );
}

/* ───────── 도감 · 상점 ───────── */
export function CodexScreen() {
  const engine = useEngine();
  const { store } = useSnapshot();
  const counts = readCodex(store);
  return (
    <section className="overlay" id="screenCodex">
      <div className="mapTop">
        <button className="linkbtn" id="btnCodexBack" type="button" onClick={() => engine.closeCodex()}>‹ 돌아가기</button>
        <Wallet />
      </div>
      <h1>도감 · 상점</h1>
      <div className="sub">찾아낸 복제품이 도감에 기록돼요. 10 · 50 · 200번 찾으면 보상!</div>
      <div className="codexGrid" id="codexGrid">
        {OBJECTS.map((o, i) => {
          const n = counts[i];
          const next = CODEX_MILESTONES.findIndex(m => n < m);
          return (
            <div key={o.name} className={'codexCard' + (n ? '' : ' unseen')} style={{ '--i': i } as CSSProperties}>
              <div className="codexIcon" style={{ '--hue': 160 + i * 30 } as CSSProperties}><ObjectIcon kind={i} /></div>
              <b>{n ? o.name : '???'}</b>
              <span className="cnt">{n}회 발견</span>
              <span className="next">{next < 0 ? '모든 보상 달성 ✓' : <>다음 보상 {CODEX_MILESTONES[next]}회 · <Coin />{CODEX_REWARDS[next]}</>}</span>
            </div>
          );
        })}
      </div>
      <div className="shop">
        <div className="shopRow">
          <span><Bulb /> 힌트 {HINT_PACK}개<small> 사건에서 정답 칸을 비춰 줘요</small></span>
          <button className="btn" id="btnBuyHints" type="button" onClick={() => engine.buyHints()}><Coin /> {HINT_PRICE}</button>
        </div>
        <div className="shopRow">
          <span><Clock /> 시계 2개<small> 지금 라운드의 시간을 5초 늘려요 (C 키)</small></span>
          <button className="btn" id="btnBuyClocks" type="button" onClick={() => engine.buyClocks()}><Coin /> 25</button>
        </div>
        <div className="hint">소품·옷색은 ‘캐릭터 바꾸기’에서, 새 복장은 구역 마지막 사건을 해결하면 얻어요.</div>
      </div>
    </section>
  );
}
