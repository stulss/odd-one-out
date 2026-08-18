// 타이머 — 일시정지 / 포커스 이탈 / 10분 연속 실행에 안전해야 한다.
// rAF 루프는 앱 전체에서 이 파일 하나만 돌린다 (다중 루프 = 누수의 유일한 원인).

export function createTimer({ onTick, onZero }){
  let deadline = 0, limit = 1, remain = 0;
  let running = false, paused = false, rafId = null;

  function loop(){
    rafId = requestAnimationFrame(loop);
    if (!running || paused) return;
    const left = (deadline - performance.now()) / 1000;
    onTick(Math.max(0, left), limit);
    if (left <= 0){ running = false; onZero(); }
  }

  function start(sec){
    limit = sec; remain = sec * 1000;
    deadline = performance.now() + remain;
    running = true; paused = false;
    if (rafId === null) loop();
  }

  function pause(){
    if (!running || paused) return;
    paused = true;
    remain = deadline - performance.now();
  }

  function resume(){
    if (!running || !paused) return;
    paused = false;
    deadline = performance.now() + remain;
  }

  function stop(){ running = false; paused = false; }

  // 오답 페널티 — 즉사 대신 시간을 깎는다 (재플레이율)
  function penalty(sec){
    if (!running) return;
    if (paused) remain -= sec * 1000;
    else deadline -= sec * 1000;
  }

  function left(){
    if (!running) return 0;
    return Math.max(0, (paused ? remain : deadline - performance.now()) / 1000);
  }

  function elapsed(){ return Math.max(0, limit - left()); }

  return { start, pause, resume, stop, penalty, left, elapsed,
           get running(){ return running; },
           get paused(){ return paused; },
           destroy(){ if (rafId !== null) cancelAnimationFrame(rafId); rafId = null; } };
}
