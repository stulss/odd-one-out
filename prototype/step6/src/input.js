// STEP 4에서 추가 — 포인터와 키보드를 하나의 경로로 모은다.
//
// STEP 3까지는 main.js 안에 pointerdown 핸들러가 섞여 있었다.
// 키보드를 추가하면서 분리한 이유: 입력 경로가 둘로 늘어나면
// "마우스로는 막히는데 키보드로는 뚫리는" 상태가 생기기 쉽다.
// 잠금(locked)과 상태 검사를 한 곳에서만 하도록 모았다.

const LOCK_MS = 120;

export function createInput(boardEl, h){
  let locked = false;
  let focusIndex = 0;

  function select(i){
    if (locked) return;
    if (!h.canSelect()) return;      // PLAY가 아니면 포인터든 키보드든 똑같이 막힌다
    locked = true;
    setTimeout(() => { locked = false; }, LOCK_MS);
    h.onSelect(i);
  }

  boardEl.addEventListener('pointerdown', e => {
    const cell = e.target.closest('.cell');
    if (!cell || cell.hidden) return;
    select(Number(cell.dataset.i));
  }, { passive: true });

  // 포커스가 옮겨가면 현재 위치를 따라간다 (Tab 이동 대응)
  boardEl.addEventListener('focusin', e => {
    const i = Number(e.target?.dataset?.i);
    if (Number.isInteger(i)) focusIndex = i;
  });

  function moveFocus(key, stage){
    if (!stage) return;
    const { cols, total } = stage;
    let i = focusIndex;
    if (key === 'ArrowRight')      i = (i + 1) % total;
    else if (key === 'ArrowLeft')  i = (i - 1 + total) % total;
    else if (key === 'ArrowDown')  i = (i + cols) % total;
    else if (key === 'ArrowUp')    i = (i - cols + total) % total;
    focusIndex = i;
    h.cellAt(i)?.focus();
  }

  document.addEventListener('keydown', e => {
    if (e.repeat) return;
    const k = e.key;

    if (k === 'p' || k === 'P' || k === 'Escape'){ e.preventDefault(); h.onPause(); return; }

    if (k === 'Enter' || k === ' '){
      // 셀에 포커스가 있을 때만 선택으로 해석한다.
      // 그렇지 않으면 버튼에서 Enter를 눌렀을 때 두 번 동작한다.
      if (document.activeElement?.classList?.contains('cell')){
        e.preventDefault();
        select(focusIndex);
      }
      return;
    }

    if (k.startsWith('Arrow')){
      if (!h.canSelect()) return;
      e.preventDefault();
      moveFocus(k, h.getStage());
    }
  });

  return {
    resetFocus(){ focusIndex = 0; },
    get focusIndex(){ return focusIndex; },
    get locked(){ return locked; },
  };
}
