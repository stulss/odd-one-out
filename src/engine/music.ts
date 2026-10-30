// 배경음악 — 오디오 파일 없이 WebAudio로 실시간 합성한다 (효과음과 같은 원칙).
//
// 구역마다 조(스케일)·빠르기·코드 진행이 다른 곡이 있고, 보스전은 더 빠르고 어두운 곡이다.
// '긴장도'(0~1)가 올라가면(제한 시간이 줄어들면) 템포가 빨라지고 소리가 밝아지며 리듬이 촘촘해진다.
// 구성: 킥(저음 북) · 베이스 · 아르페지오 · 하이햇. 16분음표 단위로 0.4초 앞서 예약하는 표준 스케줄러를 쓴다.
import { audioCtx } from './audio';

export type ThemeId = number | 'boss' | 'menu';

interface Theme {
  root: number; // MIDI 근음
  scale: number[]; // 반음 간격
  bpm: number;
  prog: number[]; // 코드 진행 (스케일 도수)
  wave: OscillatorType;
}
const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10], DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MIXO = [0, 2, 4, 5, 7, 9, 10], PHRYG = [0, 1, 3, 5, 7, 8, 10], LYDIAN = [0, 2, 4, 6, 7, 9, 11];

const ZONES: Theme[] = [
  { root: 48, scale: MAJOR, bpm: 104, prog: [0, 4, 5, 3], wave: 'triangle' }, // 수습 훈련실 — 밝고 단순
  { root: 50, scale: DORIAN, bpm: 124, prog: [0, 3, 0, 4], wave: 'square' }, // 복제 공장 — 기계적
  { root: 52, scale: PHRYG, bpm: 112, prog: [0, 1, 0, 6], wave: 'sawtooth' }, // 거울 미로 — 불안
  { root: 53, scale: LYDIAN, bpm: 92, prog: [0, 4, 1, 3], wave: 'sine' }, // 안개 도서관 — 몽환
  { root: 55, scale: MIXO, bpm: 128, prog: [0, 6, 3, 4], wave: 'square' }, // 네온 시장 — 신나는
  { root: 47, scale: MINOR, bpm: 118, prog: [0, 5, 2, 4], wave: 'sawtooth' }, // 심연 격납고 — 웅장
];
const BOSS: Theme = { root: 45, scale: MINOR, bpm: 144, prog: [0, 5, 0, 6], wave: 'sawtooth' };
const MENU: Theme = { root: 48, scale: MAJOR, bpm: 84, prog: [0, 5, 3, 4], wave: 'sine' };

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const noteOf = (t: Theme, degree: number) => {
  const oct = Math.floor(degree / 7);
  return t.root + t.scale[((degree % 7) + 7) % 7] + 12 * oct;
};

let master: GainNode | null = null;
let filter: BiquadFilterNode | null = null;
let noise: AudioBuffer | null = null;
let theme: Theme = MENU;
let themeKey: ThemeId | null = null;
let timer: number | null = null;
let nextTime = 0;
let step = 0;
let intensity = 0;
let enabled = true;
let ducked = false;

function ensureGraph(): boolean {
  const ctx = audioCtx();
  if (!ctx) return false;
  if (!master) {
    master = ctx.createGain();
    master.gain.value = 0;
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    filter.connect(master).connect(ctx.destination);
    // 하이햇용 흰 잡음 (0.2초짜리 버퍼 하나를 계속 재사용)
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; // 연출용 난수 (퍼즐 시드와 무관)
  }
  return true;
}

function applyLevels() {
  const ctx = audioCtx();
  if (!ctx || !master || !filter) return;
  const target = !enabled ? 0 : ducked ? 0.1 : 0.5;
  master.gain.setTargetAtTime(target, ctx.currentTime, 0.12);
  filter.frequency.setTargetAtTime(1500 + intensity * 4500, ctx.currentTime, 0.2);
}

function osc(t: number, freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) {
  const ctx = audioCtx();
  if (!ctx || !filter) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(filter);
  o.start(t);
  o.stop(t + dur + 0.03);
}

function hat(t: number, gain: number) {
  const ctx = audioCtx();
  if (!ctx || !filter || !noise) return;
  const src = ctx.createBufferSource(), g = ctx.createGain(), hp = ctx.createBiquadFilter();
  src.buffer = noise;
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  src.connect(hp).connect(g).connect(filter);
  src.start(t);
  src.stop(t + 0.06);
}

function scheduleStep(t: number, s: number, bar: number) {
  const deg = theme.prog[bar % theme.prog.length];
  const chord = [deg, deg + 2, deg + 4];
  const hot = intensity > 0.55;
  if (s % 4 === 0) osc(t, 120, 0.13, 'sine', 0.34, 42); // 킥
  if (s === 0 || s === 8 || (hot && s === 12) || s === 6) osc(t, midi(noteOf(theme, deg) - 12), 0.22, 'triangle', 0.2); // 베이스
  if (s % 2 === 1 || hot) hat(t, s % 4 === 2 ? 0.05 : 0.03); // 하이햇
  if (s % 2 === 0 || hot) { // 아르페지오 (코드 구성음을 오르내린다)
    const pat = [0, 1, 2, 1, 2, 1, 0, 2];
    const idx = pat[(s / (hot ? 1 : 2)) % pat.length | 0];
    osc(t, midi(noteOf(theme, chord[idx] + 7)), 0.16, theme.wave, theme.wave === 'sine' ? 0.1 : 0.05);
  }
}

function tick() {
  const ctx = audioCtx();
  if (!ctx || !enabled) return;
  const stepDur = 60 / (theme.bpm * (1 + 0.18 * intensity)) / 4;
  if (nextTime < ctx.currentTime - 0.1) nextTime = ctx.currentTime + 0.05; // 오래 멈췄다 돌아오면 따라잡지 않고 새로 시작
  while (nextTime < ctx.currentTime + 0.4) {
    scheduleStep(nextTime, step % 16, Math.floor(step / 16));
    nextTime += stepDur;
    step++;
  }
}

function startLoop() {
  if (timer !== null) return;
  const ctx = audioCtx();
  if (!ctx) return;
  nextTime = ctx.currentTime + 0.08;
  timer = window.setInterval(tick, 100);
}
function stopLoop() {
  if (timer !== null) { clearInterval(timer); timer = null; }
}

export const Music = {
  /** 이 화면에 맞는 곡을 튼다 (같은 곡이 이미 돌고 있으면 아무것도 하지 않는다) */
  play(id: ThemeId) {
    if (!ensureGraph()) return; // 첫 사용자 입력 전에는 오디오 컨텍스트가 없다
    if (themeKey !== id) {
      themeKey = id;
      theme = id === 'boss' ? BOSS : id === 'menu' ? MENU : ZONES[((id % ZONES.length) + ZONES.length) % ZONES.length];
      step = 0;
    }
    if (enabled) startLoop();
    applyLevels();
  },
  stop() { themeKey = null; stopLoop(); },
  /** 0~1. 제한 시간이 줄수록 올려 긴장감을 준다 */
  setIntensity(x: number) {
    const v = Math.max(0, Math.min(1, x));
    if (Math.abs(v - intensity) < 0.04) return;
    intensity = v;
    applyLevels();
  },
  duck(on: boolean) { if (ducked === on) return; ducked = on; applyLevels(); },
  setEnabled(on: boolean) {
    enabled = on;
    if (!on) stopLoop(); else if (themeKey !== null) startLoop();
    applyLevels();
  },
};
