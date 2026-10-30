// WebAudio 합성음 — 오디오 파일 0개, 로딩 0ms.
// 음소거는 즉시 반영된다 (재시작 불필요).

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(v: boolean): void {
  muted = !!v;
  if (muted && ctx) { try { void ctx.suspend(); } catch { /* 무시 */ } }
  else if (ctx) { try { void ctx.resume(); } catch { /* 무시 */ } }
}

// 브라우저 자동재생 정책: 첫 사용자 입력에서만 컨텍스트를 만들 수 있다
export function unlock(): void {
  if (ctx || muted) return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch { ctx = null; }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.06, slideTo: number | null = null): void {
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

/** 효과음이 쓰는 오디오 컨텍스트 (배경음악이 같은 것을 쓴다). 첫 사용자 입력 전에는 null */
export const audioCtx = () => ctx;

// 정답 효과음은 콤보가 쌓일수록 펜타토닉 음계를 타고 올라간다 — 연속으로 맞히는 것 자체가 멜로디가 된다
const LADDER = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export const sfx = {
  correct(combo = 1) {
    const semi = LADDER[Math.min(Math.max(combo, 1) - 1, LADDER.length - 1)];
    const f = 523 * Math.pow(2, semi / 12);
    tone(f, 0.13, 'sine', 0.07, f * 1.5);
    if (combo >= 5) setTimeout(() => tone(f * 2, 0.1, 'triangle', 0.04), 60);
  },
  /** 콤보 5·10 달성 — 짧은 팡파르 */
  combo() { [784, 988, 1175].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'triangle', 0.07), i * 70)); },
  /** 황금 판 정답 — 동전 소리 */
  coin() { tone(1319, 0.08, 'square', 0.04); setTimeout(() => tone(1760, 0.18, 'square', 0.04), 70); },
  /** 번개 판 시작 — 긴박한 두 번 */
  rush() { tone(880, 0.07, 'square', 0.05); setTimeout(() => tone(1175, 0.1, 'square', 0.05), 90); },
  /** 시계 아이템 */
  clock() { tone(440, 0.2, 'sine', 0.06, 880); },
  /** 제한 시간이 얼마 안 남았을 때 */
  tick() { tone(1000, 0.04, 'square', 0.03); },
  wrong() { tone(180, 0.18, 'square', 0.05, 120); },
  over() { tone(320, 0.5, 'triangle', 0.07, 90); },
  best() { tone(880, 0.1, 'sine', 0.07); setTimeout(() => tone(1320, 0.18, 'sine', 0.06), 110); },
  /** 보스 등장 경보 */
  alarm() { for (let i = 0; i < 3; i++) setTimeout(() => { tone(520, 0.16, 'square', 0.05, 360); }, i * 260); },
  /** 보스 격파 폭발 */
  boom() { tone(120, 0.6, 'sawtooth', 0.08, 36); setTimeout(() => tone(70, 0.5, 'triangle', 0.08, 30), 80); },
  /** 보스 격파 팡파르 */
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.07), i * 130)); },
};

export function vibrate(ms: number): void {
  if (muted) return;
  // 실제 사용자 조작이 한 번도 없었으면 호출하지 않는다.
  // 브라우저가 개입(intervention) 경고를 콘솔에 직접 찍는데 try/catch로는 막을 수 없다.
  if (navigator.userActivation && navigator.userActivation.hasBeenActive === false) return;
  try { navigator.vibrate?.(ms); } catch { /* 무시 */ }
}
