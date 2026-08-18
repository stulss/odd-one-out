// 입력 — 포인터와 키보드를 하나의 경로로 모은다.
// 규칙: 조작 1회 = 결과 1회. 연타·멀티터치로 상태가 꼬이면 안 된다.

const LOCK_MS = 120;

export function createInput(boardEl, handlers){
  let locked = false;

  function select(i){
    if (locked) return;
    if (!handlers.canSelect()) return;
    locked = true;
    setTimeout(() => { locked = false; }, LOCK_MS);
    handlers.onSelect(i);
  }

  boardEl.addEventListener('pointerdown', e => {
    const cell = e.target.closest('.cell');
    if (!cell || cell.hidden) return;
    handlers.onFirstGesture?.();
    select(Number(cell.dataset.i));
  }, { passive: true });

  // 키보드만으로도 완주할 수 있어야 한다
  document.addEventListener('keydown', e => {
    if (e.repeat) return;
    const k = e.key;

    if (k === 'p' || k === 'P' || k === 'Escape'){ e.preventDefault(); handlers.onPause(); return; }

    if (k === 'Enter' || k === ' '){
      if (document.activeElement?.classList?.contains('cell')){
        e.preventDefault();
        handlers.onFirstGesture?.();
        select(handlers.getFocus());
      }
      return;
    }

    if (k.startsWith('Arrow')){
      if (!handlers.canSelect()) return;
      e.preventDefault();
      handlers.onFirstGesture?.();
      handlers.onMoveFocus(k);
    }
  });

  // 브라우저 기본 동작이 게임을 방해하지 않게 한다
  boardEl.addEventListener('contextmenu', e => e.preventDefault());
  boardEl.addEventListener('dragstart', e => e.preventDefault());

  return { get locked(){ return locked; } };
}
