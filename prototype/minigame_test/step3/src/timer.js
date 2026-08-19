// STEP 2에서 추가.
// 주의: rAF 루프는 앱 전체에서 하나만 돈다.
// 스테이지마다 새 루프를 만들면 오래 켜뒀을 때 루프가 쌓여 프레임이 무너진다.
// (지금은 문제가 안 보이지만, 나중에 "10분 실행" 검사에서 반드시 걸린다)

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

  return {
    start(sec){
      limit = sec;
      deadline = performance.now() + sec * 1000;
      running = true; paused = false;
      if (rafId === null) loop();
    },
    stop(){ running = false; paused = false; },
    pause(){
      if (!running || paused) return;
      paused = true;
      remain = deadline - performance.now();
    },
    resume(){
      if (!running || !paused) return;
      paused = false;
      deadline = performance.now() + remain;
    },
    // 오답은 즉사가 아니라 시간 차감으로 처리한다.
    // 즉사로 만들면 한 번 틀리자마자 창을 닫는다.
    penalty(sec){
      if (!running) return;
      if (paused) remain -= sec * 1000; else deadline -= sec * 1000;
    },
    left(){
      if (!running) return 0;
      return Math.max(0, (paused ? remain : deadline - performance.now()) / 1000);
    },
    elapsed(){ return Math.max(0, limit - this.left()); },
    get running(){ return running; },
    get paused(){ return paused; },
  };
}
