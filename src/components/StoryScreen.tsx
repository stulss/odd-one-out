// 대사 — 확인 버튼 없이 자동으로 흘러간다.
// 한 줄이 타자기로 나타나고 → 잠깐 머물고 → 다음 줄 → 마지막 줄 뒤에 화면이 스르르 사라지며 게임이 시작된다.
// 서두르고 싶으면 화면을 누르거나 Enter/Space (누를 때마다 한 단계씩 빨리 넘어간다).
// 부모가 key={req.id}로 마운트하므로, 새 대사가 오면 이 컴포넌트의 상태는 통째로 새로 시작된다.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DialogRequest } from '../engine/game';
import { NPC_NAME } from '../engine/story';
import { Hero, Npc } from './Hero';

const TYPE_MS = 16; // 글자당 시간
const FADE_MS = 260;

export function StoryScreen({ req, onDone }: { req: DialogRequest; onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState('');
  const [out, setOut] = useState(false);
  const ctl = useRef({ typing: false, complete: () => {}, advance: () => {} });
  const finished = useRef(false);
  const doneRef = useRef(onDone); // 부모가 새 함수를 넘겨도 타이핑이 다시 시작되지 않게 ref로 잡는다
  doneRef.current = onDone;

  const line = req.lines[idx];
  const instant = () => document.documentElement.dataset.reduced === 'on';

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    setOut(true);
    window.setTimeout(() => doneRef.current(), instant() ? 0 : FADE_MS);
  }, []);

  // 줄이 바뀔 때마다: 타자기 → 잠깐 머묾 → 다음 줄
  useEffect(() => {
    const full = line.text;
    let pos = 0;
    let typeTimer = 0;
    let holdTimer = 0;

    const advance = () => {
      clearInterval(typeTimer); clearTimeout(holdTimer);
      ctl.current.typing = false;
      if (idx + 1 < req.lines.length) setIdx(idx + 1);
      else finish();
    };
    const afterTyped = () => { holdTimer = window.setTimeout(advance, req.hold); };
    const complete = () => {
      clearInterval(typeTimer);
      ctl.current.typing = false;
      setText(full);
      afterTyped();
    };
    ctl.current = { typing: false, complete, advance };

    if (instant()) { setText(full); afterTyped(); }
    else {
      setText('');
      ctl.current.typing = true;
      typeTimer = window.setInterval(() => {
        setText(full.slice(0, ++pos));
        if (pos >= full.length) { clearInterval(typeTimer); ctl.current.typing = false; afterTyped(); }
      }, TYPE_MS);
    }
    return () => { clearInterval(typeTimer); clearTimeout(holdTimer); };
  }, [idx, line.text, req.hold, req.lines.length, finish]);

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

  const who = line.who === 'npc' ? NPC_NAME : line.who === 'sys' ? '승급' : req.hero.name;

  return (
    <section className={'overlay' + (out ? ' out' : '')} id="screenStory" onPointerDown={skip}>
      {req.card && (
        <div id="zoneCard" className="flip">
          <div className="zc">
            <div className="zc-k" id="zoneK">{req.card.k}</div>
            <div className="zc-n" id="zoneN">{req.card.n}</div>
          </div>
        </div>
      )}
      <div className="dlg">
        <div id="dlgAvatar" data-who={line.who}>
          {line.who === 'npc'
            ? <Npc />
            : <Hero key={idx} hero={req.hero} tier={line.tier ?? 0} evolve={line.who === 'sys'} />}
        </div>
        <div className={'bubble pop' + (line.who === 'sys' ? ' sys' : '')} key={idx}>
          <div id="dlgWho">{who}</div>
          <p id="dlgText" aria-live="polite">{text}</p>
        </div>
      </div>
      <div className="hint" id="skipHint">화면을 누르면 넘어갑니다</div>
    </section>
  );
}
