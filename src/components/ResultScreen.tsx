import { useEffect, useRef } from 'react';
import { useEngine, useSnapshot } from '../hooks/useEngine';
import { drawCard } from '../engine/card';
import { attachTilt } from '../engine/fx';
import { Hero } from './Hero';

export function PauseScreen() {
  const engine = useEngine();
  return (
    <section className="overlay" id="screenPause">
      <h1>일시정지</h1>
      <div className="sub">타이머가 멈췄습니다.</div>
      <button className="btn" id="btnResume" type="button" onClick={() => engine.togglePause()}>계속하기</button>
      <button className="btn ghost" id="btnToTitle" type="button" onClick={() => engine.goTitle()}>처음으로</button>
    </section>
  );
}

export function ResultScreen() {
  const engine = useEngine();
  const { result, store, fallback } = useSnapshot();
  const rootRef = useRef<HTMLElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!rootRef.current || !tiltRef.current) return;
    return attachTilt(rootRef.current, tiltRef.current, 10);
  }, []);

  // 결과 카드 미리보기 (공유용 이미지는 엔진이 따로 만들어 둔다)
  useEffect(() => {
    if (result && canvasRef.current) {
      try { drawCard(canvasRef.current, result.card); } catch { /* 미리보기 실패는 무시 */ }
    }
  }, [result]);

  if (!result) return null;

  return (
    <section className="overlay" id="screenResult" ref={rootRef}>
      <div className="pad"><div className="tilt" id="resultTilt" ref={tiltRef}>
        <div id="resultHero">
          <Hero hero={store.hero} tier={result.tier} mood={result.isBest ? 'happy' : 'dizzy'} evolve={result.promoted} />
        </div>
      </div></div>
      <div className="sub" id="resultTitle">{result.title}</div>
      <div className="big" id="resultStages">{result.stages}</div>
      <div className="sub">단계</div>
      <div id="resultBest" className={result.isBest ? 'is-best' : ''}>{result.best}</div>
      <div className="sub" id="resultSub">{result.sub}</div>
      <div id="resultRank">{result.rank}</div>
      <div id="resultNpc">{result.npc}</div>
      <div id="resultAch" role="status">{result.ach}</div>
      <canvas id="cardCanvas" ref={canvasRef} aria-label="결과 카드 미리보기" />
      <button className="btn" id="btnRestart" type="button" onClick={() => engine.restart()}>다시 하기</button>
      <button className="btn ghost" id="btnShare" type="button" onClick={() => void engine.doShare()}>결과 공유</button>
      {fallback.visible && (
        <div id="fallback">
          <button className="btn ghost" id="fbCopyText" type="button" onClick={() => void engine.copyShareText()}>텍스트 복사</button>
          <button className="btn ghost" id="fbCopyUrl" type="button" onClick={() => void engine.copyShareUrl()}>링크 복사</button>
          <button className="btn ghost" id="fbSaveImg" type="button" onClick={() => engine.saveCard()}>이미지 저장</button>
        </div>
      )}
      <button className="btn ghost" id="btnResultTitle" type="button" onClick={() => engine.goTitle()}>처음으로</button>
    </section>
  );
}
