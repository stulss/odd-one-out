// STEP 5에서 추가 — 효과음.
//
// 음원 파일을 쓰지 않고 WebAudio로 합성한다.
// 이유: 파일 0KB, 다운로드 0ms, 저작권 문제 없음, 첫 재생 지연 없음.
// 30초 게임에서 소리 때문에 로딩이 늘어나는 것은 손해다.

let ctx = null;
let muted = false;

export function setMuted(v){
  muted = !!v;
  if (!ctx) return;
  try { muted ? ctx.suspend() : ctx.resume(); } catch { /* 무시 */ }
}
export const isMuted = () => muted;

// 브라우저 자동재생 정책 때문에 컨텍스트는 **사용자 입력 안에서만** 만들 수 있다.
export function unlock(){
  if (ctx || muted) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch { ctx = null; }
}

function tone(freq, dur, type = 'sine', gain = 0.06, slideTo = null){
  if (muted || !ctx || ctx.state !== 'running') return;
  try {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch { /* 소리는 실패해도 게임을 막지 않는다 */ }
}

export const sfx = {
  correct(){ tone(660, 0.12, 'sine', 0.07, 990); },
  wrong(){   tone(180, 0.18, 'square', 0.05, 120); },
  over(){    tone(320, 0.50, 'triangle', 0.07, 90); },
  best(){    tone(880, 0.10, 'sine', 0.07); setTimeout(() => tone(1320, 0.18, 'sine', 0.06), 110); },
};
