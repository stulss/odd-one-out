// STEP 3에서 추가 — 화면 상태 머신과 상시 표시줄.
//
// STEP 2까지는 화면이 하나뿐이었다(게임판 + 게임오버 패널).
// 화면이 늘어나면 "지금 어느 상태인가"를 여기저기서 boolean으로 관리하게 되고,
// 그러면 일시정지 중에 입력이 먹거나 종료 후에 타이머가 도는 버그가 반드시 생긴다.
// 그래서 상태를 한 곳에서만 바꾼다.

export const SCREENS = ['TITLE', 'PLAY', 'PAUSE', 'RESULT'];

const LABEL = { TITLE:'대기 중', PLAY:'진행 중', PAUSE:'일시정지', RESULT:'종료' };

export function createUI(appEl, statusEl){
  let screen = 'TITLE';
  const listeners = [];

  function set(next){
    if (!SCREENS.includes(next)) return;
    screen = next;
    appEl.dataset.screen = next;          // CSS가 이 값으로 오버레이를 보여준다
    listeners.forEach(fn => fn(next));
  }

  // 규칙·조작·상태 3줄 중 "상태" 줄. 화면에 항상 떠 있어야 한다.
  function status({ stage, tuneT }){
    statusEl.textContent = `상태: ${LABEL[screen]} · 단계 ${stage} · 난이도 T=${tuneT.toFixed(1)}`;
  }

  return {
    set, status,
    get screen(){ return screen; },
    is: s => screen === s,
    onChange: fn => listeners.push(fn),
  };
}
