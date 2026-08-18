// WebAudio 합성음 — 오디오 파일 0개, 로딩 0ms.
// 음소거는 즉시 반영된다 (재시작 불필요).

let ctx = null;
let muted = false;

export function setMuted(v){
  muted = !!v;
  if (muted && ctx) { try { ctx.suspend(); } catch {} }
  else if (ctx) { try { ctx.resume(); } catch {} }
}
export const isMuted = () => muted;

// 브라우저 자동재생 정책: 첫 사용자 입력에서만 컨텍스트를 만들 수 있다
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
  over(){    tone(320, 0.5, 'triangle', 0.07, 90); },
  best(){    tone(880, 0.1, 'sine', 0.07); setTimeout(() => tone(1320, 0.18, 'sine', 0.06), 110); },
};

export function vibrate(ms){
  if (muted) return;
  // 실제 사용자 조작이 한 번도 없었으면 호출하지 않는다.
  // 브라우저가 개입(intervention) 경고를 콘솔에 직접 찍는데 try/catch로는 막을 수 없다.
  if (navigator.userActivation && navigator.userActivation.hasBeenActive === false) return;
  try { navigator.vibrate?.(ms); } catch {}
}
