// DOM 그리드 렌더 — 노드는 최초 1회만 만들고 계속 재사용한다 (생성/삭제 0).
// 렌더러를 갈아끼울 일이 생기면 이 파일만 교체하면 된다.
import { DIFF_AXES } from './stage.js';

const MAX_CELLS = 24;   // 4x6 상한 (stage.js GRIDS와 일치)
const GAP = 8;

export function createRenderer(boardEl, stageAreaEl, onSelect){
  const cells = Array.from({ length: MAX_CELLS }, (_, i) => {
    const el = document.createElement('button');
    el.className = 'cell';
    el.type = 'button';
    el.dataset.i = String(i);
    el.setAttribute('aria-label', `칸 ${i + 1}`);
    boardEl.appendChild(el);
    return el;
  });

  let current = null;
  let focusIndex = 0;

  // 셀 크기는 화면에 맞춰 픽셀만 달라진다. 칸 수는 절대 달라지지 않는다(시드 재현성).
  function layout(){
    if (!current) return;
    const maxW = Math.min(window.innerWidth * 0.92, 560);
    const maxH = Math.max(160, stageAreaEl.clientHeight - 8);
    const cell = Math.floor(Math.min(
      (maxW - GAP * (current.cols - 1)) / current.cols,
      (maxH - GAP * (current.rows - 1)) / current.rows,
    ));
    boardEl.style.width  = (cell * current.cols + GAP * (current.cols - 1)) + 'px';
    boardEl.style.height = (cell * current.rows + GAP * (current.rows - 1)) + 'px';
  }

  function draw(stage){
    current = stage;
    focusIndex = 0;
    boardEl.style.setProperty('--cols', stage.cols);
    boardEl.style.setProperty('--rows', stage.rows);
    const spec = DIFF_AXES[stage.axis];
    const base = `--hue:${stage.hue}`;
    for (let i = 0; i < MAX_CELLS; i++){
      const el = cells[i];
      if (i >= stage.total){ el.hidden = true; continue; }
      el.hidden = false;
      el.className = 'cell shape-' + stage.shape;
      el.style.cssText = base + ';' + (i === stage.answer ? spec.css(stage.delta) : '');
    }
    layout();
  }

  function markWrong(i){
    const el = cells[i];
    if (!el) return;
    el.classList.add('is-wrong');
    setTimeout(() => el.classList.remove('is-wrong'), 260);
  }

  function markCorrect(i){
    const el = cells[i];
    if (!el) return;
    el.classList.add('is-correct');
    setTimeout(() => el.classList.remove('is-correct'), 260);
  }

  // 실패 시 정답이 어디였는지 보여준다 — 없으면 플레이어는 속았다고 느낀다
  function revealAnswer(){
    if (!current) return;
    cells[current.answer]?.classList.add('is-answer');
  }
  function clearReveal(){ cells.forEach(el => el.classList.remove('is-answer')); }

  // 키보드 이동 (마우스 없이도 완주 가능해야 한다)
  function moveFocus(key){
    if (!current) return;
    const { cols, total } = current;
    let i = focusIndex;
    if (key === 'ArrowRight') i = (i + 1) % total;
    else if (key === 'ArrowLeft') i = (i - 1 + total) % total;
    else if (key === 'ArrowDown') i = (i + cols) % total;
    else if (key === 'ArrowUp') i = (i - cols + total) % total;
    focusIndex = i;
    cells[i].focus();
  }
  const getFocus = () => focusIndex;

  boardEl.addEventListener('focusin', e => {
    const i = Number(e.target?.dataset?.i);
    if (Number.isInteger(i)) focusIndex = i;
  });

  window.addEventListener('resize', layout);

  return { draw, layout, markWrong, markCorrect, revealAnswer, clearReveal,
           moveFocus, getFocus, cells };
}
