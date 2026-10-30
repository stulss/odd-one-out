// 대사 / 컷신 — 확인 버튼 없이 자동으로 흘러간다.
// 한 줄이 타자기로 나타나고 → 잠깐 머물고 → 다음 줄 → 마지막 줄 뒤에 화면이 스르르 사라지며 다음 장면이 시작된다.
// 서두르고 싶으면 화면을 누르거나 Enter/Space (누를 때마다 한 단계씩 빨리 넘어간다).
// 부모가 key={req.id}로 마운트하므로, 새 대사가 오면 이 컴포넌트의 상태는 통째로 새로 시작된다.
//
// req.cine 가 있으면 '컷신' 연출을 입힌다: 위아래 검은 띠(레터박스), 구역 색 배경, 무대 위 큰 배우 둘
// (말하는 쪽이 앞으로 나와 밝아진다), 보스 등장 시 WARNING 띠. 없으면 평범한 대사 상자다.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { DialogRequest } from '../engine/game';
import { NPC_NAME } from '../engine/story';
import { Hero, Npc } from './Hero';
import { BossFigure } from './BossFigure';

const TYPE_MS = 16; // 글자당 시간
const FADE_MS = 260;
const BANNER_MS = 1300; // WARNING 띠가 지나가는 동안은 첫 줄을 시작하지 않는다

export function StoryScreen({ req, onDone }: { req: DialogRequest; onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState('');
  const [out, setOut] = useState(false);
  const ctl = useRef({ typing: false, complete: () => {}, advance: () => {} });
  const finished = useRef(false);
  const doneRef = useRef(onDone); // 부모가 새 함수를 넘겨도 타이핑이 다시 시작되지 않게 ref로 잡는다
  doneRef.current = onDone;

  const cine = req.cine;
  const line = req.lines[idx];
  const instant = () => document.documentElement.dataset.reduced === 'on';

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    setOut(true);
    window.setTimeout(() => doneRef.current(), instant() ? 0 : FADE_MS);
  }, []);

  // 줄이 바뀔 때마다: (띠가 지나가길 기다림) → 타자기 → 잠깐 머묾 → 다음 줄
  useEffect(() => {
    const full = line.text;
    const delay = idx === 0 && cine?.banner && !instant() ? BANNER_MS : 0;
    let pos = 0;
    let typeTimer = 0;
    let holdTimer = 0;
    let delayTimer = 0;

    const advance = () => {
      clearInterval(typeTimer); clearTimeout(holdTimer); clearTimeout(delayTimer);
      ctl.current.typing = false;
      if (idx + 1 < req.lines.length) setIdx(idx + 1);
      else finish();
    };
    const afterTyped = () => { holdTimer = window.setTimeout(advance, req.hold); };
    const complete = () => {
      clearInterval(typeTimer); clearTimeout(delayTimer);
      ctl.current.typing = false;
      setText(full);
      afterTyped();
    };
    const startTyping = () => {
      ctl.current.typing = true;
      typeTimer = window.setInterval(() => {
        setText(full.slice(0, ++pos));
        if (pos >= full.length) { clearInterval(typeTimer); ctl.current.typing = false; afterTyped(); }
      }, TYPE_MS);
    };
    ctl.current = { typing: false, complete, advance };

    if (instant()) { setText(full); afterTyped(); }
    else {
      setText('');
      if (delay) { ctl.current.typing = true; delayTimer = window.setTimeout(startTyping, delay); }
      else startTyping();
    }
    return () => { clearInterval(typeTimer); clearTimeout(holdTimer); clearTimeout(delayTimer); };
  }, [idx, line.text, req.hold, req.lines.length, finish, cine?.banner]);

  // 누를 때마다 한 단계 빨리: 타이핑 중이면 즉시 완성, 이미 완성이면 다음 줄로
  const skip = useCallback(() => {
    if (finished.current) return;
    if (ctl.current.typing) ctl.current.complete();
    else ctl.current.advance();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); skip(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [skip]);

  const boss = cine?.boss;
  const who = line.who === 'npc' ? NPC_NAME : line.who === 'boss' ? (boss?.name ?? '???') : line.who === 'sys' ? '알림' : req.hero.name;
  const heroOnScreen = line.hero ?? req.hero;
  const heroTier = line.tier ?? cine?.tier ?? 0;
  // 컷신에서 지금 말하는 쪽 (왼쪽 = 주인공, 오른쪽 = 보스 또는 안내 로봇)
  const speaker: 'left' | 'right' = line.who === 'hero' || line.who === 'sys' ? 'left' : 'right';

  return (
    <section
      className={'overlay' + (out ? ' out' : '') + (cine ? ' cine' : '') + (boss ? ' bossScene' : '')}
      id="screenStory" onPointerDown={skip}
      style={cine ? ({ '--zh': cine.hue } as CSSProperties) : undefined}
    >
      {cine && (
        <>
          <div className="cineBar top" aria-hidden="true" />
          <div className="cineBar bottom" aria-hidden="true" />
          <div className="cineGlow" aria-hidden="true" />
          {cine.banner && <div className="warnBanner" aria-hidden="true">{cine.banner}</div>}
        </>
      )}
      {req.card && (
        <div id="zoneCard" className={'flip' + (boss ? ' boss' : '')}>
          <div className="zc">
            <div className="zc-k" id="zoneK">{req.card.k}</div>
            <div className="zc-n" id="zoneN">{req.card.n}</div>
          </div>
        </div>
      )}
      {cine && (
        <div className="cineStage" aria-hidden="true">
          <div className={'actor left' + (speaker === 'left' ? ' active' : '')}>
            <Hero hero={heroOnScreen} tier={heroTier} mood={cine.defeated ? 'happy' : speaker === 'left' ? 'happy' : 'idle'} evolve={line.who === 'sys'} />
          </div>
          <div className={'actor right' + (speaker === 'right' ? ' active' : '')}>
            {boss ? <BossFigure boss={boss} defeated={cine.defeated} /> : <Npc />}
          </div>
        </div>
      )}
      <div className="dlg">
        <div id="dlgAvatar" data-who={line.who}>
          {line.who === 'npc'
            ? <Npc />
            : line.who === 'boss' && boss
              ? <BossFigure boss={boss} defeated={cine?.defeated} small />
              : <Hero key={idx} hero={heroOnScreen} tier={line.tier ?? 0} evolve={line.who === 'sys'} />}
        </div>
        <div className={'bubble pop' + (line.who === 'sys' ? ' sys' : '') + (line.who === 'boss' ? ' boss' : '')} key={idx}>
          <div id="dlgWho">{who}</div>
          <p id="dlgText" aria-live="polite">{text}</p>
        </div>
      </div>
      <div className="hint" id="skipHint">화면을 누르면 넘어갑니다</div>
    </section>
  );
}
