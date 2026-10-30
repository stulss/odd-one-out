// 캐릭터 만들기 — 이름 · 몸 모양 · 색 · 액세서리. 진화 미리보기는 저장하지 않는 화면 전용 상태다.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useEngine, useSnapshot } from '../hooks/useEngine';
import { HERO_ACCS, HERO_HUES, HERO_SHAPES, NAME_MAX, TIER_LABELS } from '../engine/heroData';
import type { Hero as HeroData } from '../engine/save';
import { Hero } from './Hero';

export function HeroScreen() {
  const engine = useEngine();
  const { store } = useSnapshot();
  const [draft, setDraft] = useState<HeroData>(store.hero);
  const [tier, setTier] = useState(0);
  const [evolveKey, setEvolveKey] = useState(0); // 진화 미리보기를 누를 때만 연출
  const nameRef = useRef<HTMLInputElement>(null);
  const isFirst = !store.hero.name; // 처음 만드는 중이면 취소할 곳이 없다

  useEffect(() => { nameRef.current?.focus({ preventScroll: true }); }, []);

  const set = <K extends keyof HeroData>(k: K, v: HeroData[K]) => setDraft(d => ({ ...d, [k]: v }));

  return (
    <section className="overlay" id="screenHero">
      <h1>감별사 등록</h1>
      <div className="sub">이름과 모습을 정해 주세요</div>
      <div className="pad"><div className="tilt">
        <div id="heroPreview">
          <Hero key={evolveKey} hero={draft} tier={tier} mood="happy" evolve={evolveKey > 0} />
        </div>
      </div></div>
      <input
        id="heroName" ref={nameRef} type="text" maxLength={NAME_MAX} placeholder={`이름 (최대 ${NAME_MAX}자)`}
        autoComplete="off" aria-label="이름" value={draft.name}
        onChange={e => set('name', e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') engine.confirmHero(draft); }}
      />
      <div className="pick" id="pickShape" role="group" aria-label="몸 모양">
        {HERO_SHAPES.map(([v, label]) => (
          <button key={v} type="button" className="chip" aria-pressed={draft.shape === v}
            aria-label={`몸 모양 ${label}`} onClick={() => set('shape', v)}>{label}</button>
        ))}
      </div>
      <div className="pick" id="pickHue" role="group" aria-label="색">
        {HERO_HUES.map(h => (
          <button key={h} type="button" className="chip swatch" aria-pressed={draft.hue === h}
            aria-label={`색 ${h}`} style={{ '--hh': h } as CSSProperties} onClick={() => set('hue', h)} />
        ))}
      </div>
      <div className="pick" id="pickAcc" role="group" aria-label="액세서리">
        {HERO_ACCS.map(([v, label]) => (
          <button key={v} type="button" className="chip" aria-pressed={draft.acc === v}
            aria-label={`액세서리 ${label}`} onClick={() => set('acc', v)}>{label}</button>
        ))}
      </div>
      <div className="hint">진화 미리보기 — 등급이 오르면 이렇게 변합니다</div>
      <div className="pick" id="pickTier" role="group" aria-label="진화 미리보기">
        {TIER_LABELS.map((label, i) => (
          <button key={label} type="button" className="chip" aria-pressed={tier === i}
            aria-label={`진화 미리보기 ${label}`} onClick={() => { setTier(i); setEvolveKey(k => k + 1); }}>{label}</button>
        ))}
      </div>
      <button className="btn" id="btnHeroOk" type="button" onClick={() => engine.confirmHero(draft)}>등록 완료</button>
      {!isFirst && <button className="btn ghost" id="btnHeroCancel" type="button" onClick={() => engine.goTitle()}>취소</button>}
    </section>
  );
}
