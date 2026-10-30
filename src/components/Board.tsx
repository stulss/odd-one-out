// 게임판 — 도형 격자. 칸 수는 스테이지 번호로만 정해지고, 화면에 따라 달라지는 건 픽셀 크기뿐이다(시드 재현성).
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type RefObject } from 'react';
import { useEngine, useSnapshot } from '../hooks/useEngine';
import { oddStyle } from '../engine/stage';
import { ObjectIcon } from './ObjectIcon';

const GAP = 8;

interface Props {
  stageAreaRef: RefObject<HTMLElement | null>;
  boardRef: RefObject<HTMLDivElement | null>;
}

export function Board({ stageAreaRef, boardRef }: Props) {
  const engine = useEngine();
  const snap = useSnapshot();
  const { stage, screen } = snap;
  const focusIndex = useRef(0);

  // 셀 크기는 화면에 맞춰 픽셀만 달라진다.
  const layout = () => {
    const board = boardRef.current, area = stageAreaRef.current;
    if (!board || !area || !stage) return;
    const maxW = Math.min(window.innerWidth * 0.92, 560);
    const maxH = Math.max(160, area.clientHeight - 8);
    const cell = Math.floor(Math.min(
      (maxW - GAP * (stage.cols - 1)) / stage.cols,
      (maxH - GAP * (stage.rows - 1)) / stage.rows,
    ));
    board.style.width = `${cell * stage.cols + GAP * (stage.cols - 1)}px`;
    board.style.height = `${cell * stage.rows + GAP * (stage.rows - 1)}px`;
  };

  useLayoutEffect(() => {
    focusIndex.current = 0;
    layout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useEffect(() => {
    window.addEventListener('resize', layout);
    return () => window.removeEventListener('resize', layout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // 키보드만으로도 완주할 수 있어야 한다: 방향키 이동 · Enter/Space 선택 · P/Esc 일시정지
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if ((e.target as Element | null)?.closest?.('input, textarea, select')) return; // 이름 입력 중 'p'가 먹히면 안 된다
      const k = e.key;
      if (k === 'p' || k === 'P' || k === 'Escape') { e.preventDefault(); engine.togglePause(); return; }
      if (k === 'h' || k === 'H') { engine.useHint(); return; }

      const s = engine.getSnapshot();
      const board = boardRef.current;
      if (s.screen !== 'PLAY' || !s.stage || !board) return;
      if (k === 'Enter' || k === ' ') {
        if ((document.activeElement as HTMLElement | null)?.classList?.contains('cell')) {
          e.preventDefault();
          engine.unlock();
          engine.select(focusIndex.current);
        }
      } else if (k.startsWith('Arrow')) {
        e.preventDefault();
        engine.unlock();
        const { cols, total } = s.stage;
        let i = focusIndex.current;
        if (k === 'ArrowRight') i = (i + 1) % total;
        else if (k === 'ArrowLeft') i = (i - 1 + total) % total;
        else if (k === 'ArrowDown') i = (i + cols) % total;
        else if (k === 'ArrowUp') i = (i - cols + total) % total;
        focusIndex.current = i;
        (board.children[i] as HTMLElement | undefined)?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [engine, boardRef]);

  const colorSafe = snap.store.settings.colorSafe;
  const reveal = screen === 'RESULT'; // 실패 시 정답이 어디였는지 보여준다 — 없으면 플레이어는 속았다고 느낀다

  return (
    <main id="stageArea" ref={stageAreaRef}>
      <div
        id="board"
        ref={boardRef}
        role="group"
        aria-label="도형 격자"
        style={stage ? ({ '--cols': stage.cols, '--rows': stage.rows } as CSSProperties) : undefined}
        onContextMenu={e => e.preventDefault()}
        onDragStart={e => e.preventDefault()}
        onFocus={e => {
          const i = Number((e.target as HTMLElement).dataset.i);
          if (Number.isInteger(i)) focusIndex.current = i;
        }}
      >
        {stage && Array.from({ length: stage.total }, (_, i) => {
          const odd = i === stage.answer;
          const style = { '--hue': stage.hue, ...(odd ? oddStyle(stage, colorSafe) : {}) } as CSSProperties;
          return (
            <button
              key={i}
              type="button"
              className={`cell${reveal && odd ? ' is-answer' : ''}${snap.hintIndex === i ? ' is-hint' : ''}`}
              data-i={i}
              aria-label={`칸 ${i + 1}`}
              style={style}
              onPointerDown={() => { engine.unlock(); engine.select(i); }}
            >
              <ObjectIcon kind={stage.kind} />
            </button>
          );
        })}
      </div>
    </main>
  );
}
