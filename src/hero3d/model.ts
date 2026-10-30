// 3D 감별사 — three.js 기본 도형(구·캡슐·원뿔·토러스…)만으로 만든 '카툰 셰이딩' 캐릭터. 모델 파일이 없다.
//
// 기법 (조사한 일반적 방식을 이 프로젝트에 맞게 직접 구성):
//  · 카툰 음영: MeshToonMaterial + 3단계 그라디언트 맵 (명암이 계단식으로 끊겨 만화 느낌)
//  · 윤곽선: 같은 형상을 살짝 키워 앞면을 안 그리는(BackSide) 검은 껍질로 한 번 더 그린다 (inverted hull)
//  · 큰 머리 · 작은 얼굴 · 복장 실루엣 — 2D 버전(components/Hero.tsx)과 같은 디자인 원칙
// 직업(job) 6종 × 진화(tier) 0~5 는 2D와 같은 규칙: 복장은 직업이 정하고, 진화는 공통 레이어로 얹는다.
import {
  AdditiveBlending, BackSide, BoxGeometry, BufferGeometry, CapsuleGeometry, Color, ConeGeometry, CylinderGeometry,
  DataTexture, DoubleSide, ExtrudeGeometry, Group, LatheGeometry, Mesh, MeshBasicMaterial, MeshToonMaterial,
  NearestFilter, OctahedronGeometry, RedFormat, SRGBColorSpace, Shape, SphereGeometry, TorusGeometry, Vector2,
  type Material,
} from 'three';
import type { Hero as HeroData, Job } from '../engine/save';
import { HAIR_COLORS, OUTFIT_HUES, SKINS, normalizeHero } from '../engine/heroData';

const LINE = '#3a2c2c';
const GOLD = '#f2c14e';
const SILVER = '#cfd6e4';
const BRONZE = '#c27a2c';
const PI = Math.PI;

/* ───────── 캐시: 같은 도형·재질은 한 번만 만든다 (여러 캐릭터가 공유) ───────── */
const geoCache = new Map<string, BufferGeometry>();
function geo<T extends BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g as T;
}

let gradient: DataTexture | null = null;
function toonGradient(): DataTexture {
  if (!gradient) {
    gradient = new DataTexture(new Uint8Array([84, 160, 255]), 3, 1, RedFormat);
    gradient.minFilter = gradient.magFilter = NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

const matCache = new Map<string, Material>();
const css = (c: string | Color) => (typeof c === 'string' ? new Color(c) : c);
function toon(c: string | Color, side: 0 | 1 | 2 = 0): MeshToonMaterial {
  const col = css(c);
  const key = `t${col.getHexString()}${side}`;
  let m = matCache.get(key) as MeshToonMaterial | undefined;
  if (!m) { m = new MeshToonMaterial({ color: col, gradientMap: toonGradient(), side }); matCache.set(key, m); }
  return m;
}
const outlineMat = new MeshBasicMaterial({ color: LINE, side: BackSide });
const glow = (c: string | Color, opacity = 1) => {
  const col = css(c);
  const key = `g${col.getHexString()}${opacity}`;
  let m = matCache.get(key) as MeshBasicMaterial | undefined;
  if (!m) { m = new MeshBasicMaterial({ color: col, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }); matCache.set(key, m); }
  return m;
};
/** HSL(도, %, %) → sRGB 색 (2D 버전과 같은 값을 쓴다) */
const hsl = (h: number, s: number, l: number) => new Color().setHSL(((h % 360) + 360) % 360 / 360, s / 100, l / 100, SRGBColorSpace);

interface PartOpts { p?: [number, number, number]; r?: [number, number, number]; s?: [number, number, number]; o?: number; side?: 0 | 1 | 2 }

/** 메시 + 윤곽선 껍질. o = 윤곽선 두께(배율), 0이면 윤곽선 없음 */
function part(g: BufferGeometry, color: string | Color, a: PartOpts = {}): Mesh {
  const m = new Mesh(g, toon(color, a.side ?? 0));
  if (a.p) m.position.set(...a.p);
  if (a.r) m.rotation.set(...a.r);
  if (a.s) m.scale.set(...a.s);
  const o = a.o ?? 1.07;
  if (o > 0) {
    const ol = new Mesh(g, outlineMat);
    ol.scale.setScalar(o);
    m.add(ol);
  }
  return m;
}
const flat = (g: BufferGeometry, color: string | Color, a: PartOpts = {}) => part(g, color, { ...a, o: 0 });

const sphere = (r: number, ws = 24, hs = 16) => geo(`sp${r}-${ws}-${hs}`, () => new SphereGeometry(r, ws, hs));
const cap = (r: number, l: number) => geo(`cap${r}-${l}`, () => new CapsuleGeometry(r, l, 6, 12));
const cyl = (rt: number, rb: number, h: number, seg = 24, open = false, ts = 0, tl = PI * 2) =>
  geo(`cy${rt}-${rb}-${h}-${seg}-${open}-${ts}-${tl}`, () => new CylinderGeometry(rt, rb, h, seg, 1, open, ts, tl));
const cone = (r: number, h: number, seg = 24) => geo(`co${r}-${h}-${seg}`, () => new ConeGeometry(r, h, seg));
const torus = (R: number, t: number, arc = PI * 2, seg = 28) => geo(`to${R}-${t}-${arc}-${seg}`, () => new TorusGeometry(R, t, 8, seg, arc));
const box = (w: number, h: number, d: number) => geo(`bx${w}-${h}-${d}`, () => new BoxGeometry(w, h, d));
// 선 회전체(종 모양). 점은 위→아래 순서로 적고, 법선이 바깥을 향하도록 여기서 뒤집는다.
const bell = (pts: [number, number][]) => geo('lathe' + JSON.stringify(pts), () => new LatheGeometry([...pts].reverse().map(([x, y]) => new Vector2(x, y)), 28));

/* ───────── 리그: 애니메이션이 만지는 부분들 ───────── */
export interface Rig {
  root: Group; // 전체 (좌우 회전·튀어오름)
  body: Group;
  head: Group;
  armL: Group; armR: Group;
  eyesOpen: Group; eyesHappy: Group; eyesDizzy: Group; brows: Group;
  mouthSmile: Mesh; mouthOpen: Mesh; mouthWavy: Mesh;
  cape?: Group; wingL?: Group; wingR?: Group; aura?: Mesh; halo?: Mesh; sparks?: Group;
  topY: number; // 머리 장식의 맨 위 (후광 위치)
}

const feather = (len: number, w: number) => {
  const s = new Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(len * 0.25, w, len * 0.7, w * 1.15, len, w * 0.25);
  s.bezierCurveTo(len * 0.8, -w * 0.2, len * 0.5, -w * 0.7, len * 0.25, -w * 0.45);
  s.bezierCurveTo(len * 0.12, -w * 0.3, len * 0.04, -w * 0.1, 0, 0);
  return geo(`wing${len}-${w}`, () => new ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false }));
};

export function buildHero(raw: HeroData, tier: number): Rig {
  const hero = normalizeHero(raw);
  const job: Job = hero.job;
  const skin = new Color(SKINS[hero.skin]);
  const hair = new Color(HAIR_COLORS[hero.hairColor]);
  const h = OUTFIT_HUES[hero.outfit];
  const main = hsl(h, 34, 40), dark = hsl(h, 30, 22), accent = hsl(h + 160, 62, 56);
  const cream = new Color('#efe7d6');
  const metal = tier >= 4 ? GOLD : tier >= 3 ? SILVER : BRONZE;
  const R = 0.62;

  const root = new Group();
  const body = new Group();
  root.add(body);

  /* ── 다리 · 신발 ── */
  if (job === 'nomad') {
    for (const sx of [-1, 1]) {
      body.add(part(sphere(0.21), cream, { p: [sx * 0.15, 0.36, 0], s: [1, 1.15, 1] }));
      body.add(flat(torus(0.17, 0.035), accent, { p: [sx * 0.15, 0.2, 0], r: [PI / 2, 0, 0] }));
    }
  } else {
    const pants = job === 'ninja' ? dark : new Color(job === 'rogue' ? '#3b3440' : '#2f3442');
    for (const sx of [-1, 1]) body.add(part(cap(0.1, 0.3), pants, { p: [sx * 0.15, 0.36, 0] }));
  }
  for (const sx of [-1, 1]) body.add(part(sphere(0.15), '#4a382f', { p: [sx * 0.15, 0.1, 0.05], s: [1, 0.62, 1.35] }));

  /* ── 몸통 (직업별 상의) ── */
  const torsoColor = job === 'ninja' ? dark : main;
  body.add(part(cap(0.28, 0.34), torsoColor, { p: [0, 0.92, 0] }));
  const longRobe = job === 'mage' || job === 'cleric';
  if (job === 'detective') { // 트렌치코트: 무릎 아래까지
    body.add(part(bell([[0.3, 1.25], [0.36, 0.9], [0.44, 0.5], [0.47, 0.28]]), main, { side: DoubleSide, o: 1.03 }));
    body.add(flat(box(0.18, 0.7, 0.04), cream, { p: [0, 0.95, 0.33] })); // 셔츠 V
    for (const sx of [-1, 1]) body.add(part(cone(0.13, 0.3, 4), dark, { p: [sx * 0.2, 1.2, 0.26], r: [0.2, 0, -sx * 0.5], o: 1.1 }));
    body.add(part(torus(0.4, 0.04), dark, { p: [0, 0.72, 0], r: [PI / 2, 0, 0], o: 1.2 })); // 허리띠
    body.add(part(box(0.12, 0.1, 0.05), GOLD, { p: [0, 0.72, 0.42], o: 1.2 }));
  } else if (longRobe) { // 긴 로브
    const robe = job === 'cleric' ? cream : main;
    body.add(part(bell([[0.3, 1.25], [0.4, 0.9], [0.56, 0.4], [0.66, 0.04]]), robe, { side: DoubleSide, o: 1.03 }));
    body.add(flat(torus(0.655, 0.035), job === 'cleric' ? main : accent, { p: [0, 0.07, 0], r: [PI / 2, 0, 0] })); // 밑단 장식
    if (job === 'cleric') body.add(part(box(0.2, 1.0, 0.05), accent, { p: [0, 0.72, 0.5], r: [0.1, 0, 0], o: 1.15 })); // 영대
    else body.add(part(torus(0.37, 0.045), accent, { p: [0, 0.78, 0], r: [PI / 2, 0, 0], o: 1.2 }));
  } else if (job === 'ninja') { // 어깨끈 + 허리띠
    body.add(part(box(0.1, 0.8, 0.04), accent, { p: [0, 0.95, 0.31], r: [0, 0, 0.7], o: 1.2 }));
    body.add(part(torus(0.31, 0.06), accent, { p: [0, 0.7, 0], r: [PI / 2, 0, 0], o: 1.15 }));
  } else if (job === 'nomad') { // 조끼 + 띠
    for (const sx of [-1, 1]) body.add(part(box(0.2, 0.62, 0.52), main, { p: [sx * 0.2, 0.95, 0], o: 1.05 }));
    body.add(part(torus(0.31, 0.065), accent, { p: [0, 0.72, 0], r: [PI / 2, 0, 0], o: 1.15 }));
    body.add(part(box(0.1, 0.4, 0.04), accent, { p: [0.22, 0.5, 0.3], r: [0, 0, -0.15], o: 1.15 }));
  } else { // rogue: 짧은 재킷 + 스카프
    body.add(part(torus(0.31, 0.06), dark, { p: [0, 0.7, 0], r: [PI / 2, 0, 0], o: 1.15 }));
    body.add(part(torus(0.27, 0.07), accent, { p: [0, 1.24, 0], r: [PI / 2, 0, 0], o: 1.15 }));
    body.add(part(box(0.1, 0.34, 0.04), accent, { p: [0.12, 1.0, 0.3], r: [0.1, 0, 0.1], o: 1.2 }));
  }
  if (job === 'detective') { // 목도리
    body.add(part(torus(0.27, 0.075), accent, { p: [0, 1.25, 0], r: [PI / 2, 0, 0], o: 1.15 }));
    body.add(part(box(0.13, 0.36, 0.05), accent, { p: [0.14, 1.02, 0.31], r: [0.1, 0, 0.15], o: 1.18 }));
  }

  /* ── 진화 레이어 (직업과 무관하게 공통) ── */
  if (tier >= 1) { // 브로치
    body.add(part(cyl(0.07, 0.07, 0.04, 20), metal, { p: [0, 0.98, 0.34], r: [PI / 2, 0, 0], o: 1.25 }));
  }
  if (tier >= 2) { // 어깨 망토
    body.add(part(cyl(0.3, 0.52, 0.3, 24, true), dark, { p: [0, 1.14, 0], side: DoubleSide, o: 1.04 }));
    body.add(flat(torus(0.52, 0.025), tier >= 4 ? GOLD : accent, { p: [0, 1.0, 0], r: [PI / 2, 0, 0] }));
  }
  if (tier >= 3) { // 견장
    for (const sx of [-1, 1]) body.add(part(sphere(0.14), metal, { p: [sx * 0.36, 1.16, 0], s: [1.1, 0.7, 1.1], o: 1.12 }));
  }

  /* ── 팔 ── */
  const sleeve = job === 'ninja' ? dark : job === 'nomad' || job === 'cleric' ? cream : main;
  const wide = job === 'mage' || job === 'cleric';
  const mkArm = (sx: number) => {
    const g = new Group();
    g.position.set(sx * 0.35, 1.1, 0);
    g.add(part(cap(wide ? 0.11 : 0.085, 0.26), sleeve, { p: [0, -0.22, 0] }));
    g.add(part(sphere(0.095), skin, { p: [0, -0.5, 0] }));
    return g;
  };
  const armL = mkArm(-1), armR = mkArm(1);
  body.add(armL, armR);
  // 소품은 오른손에 든다 (팔을 따라 움직인다)
  if (hero.acc === 'lens') {
    const g = new Group(); g.position.set(0, -0.5, 0.05); g.rotation.set(0.2, 0, -0.3);
    g.add(flat(cyl(0.025, 0.025, 0.4, 8), '#8a5a2b', { p: [0, 0.16, 0] }));
    g.add(part(torus(0.17, 0.035), GOLD, { p: [0, 0.5, 0], o: 1.15 }));
    const glass = new Mesh(geo('lens-glass', () => new CylinderGeometry(0.165, 0.165, 0.01, 24)), glow('#bfe3ff', 0.4));
    glass.rotation.x = PI / 2; glass.position.set(0, 0.5, 0); g.add(glass);
    armR.add(g);
  } else if (hero.acc === 'staff') {
    const g = new Group(); g.position.set(0, -0.5, 0.05);
    g.add(flat(cyl(0.03, 0.03, 1.5, 8), '#7a5532', { p: [0, 0.25, 0] }));
    g.add(part(sphere(0.12), accent, { p: [0, 1.05, 0], o: 1.12 }));
    armR.add(g);
  } else if (hero.acc === 'flower') {
    const g = new Group(); g.position.set(0, -0.5, 0.05); g.rotation.z = -0.25;
    g.add(flat(cyl(0.018, 0.018, 0.34, 6), '#4d7a3c', { p: [0, 0.17, 0] }));
    g.add(part(sphere(0.09), '#d8344c', { p: [0, 0.4, 0], o: 1.12 }));
    armR.add(g);
  }

  /* ── 머리 ── */
  const head = new Group();
  head.position.set(0, 1.58, 0);
  body.add(head);
  head.add(part(sphere(R), skin, { s: [1, 0.95, 0.97], o: 1.045 }));
  for (const sx of [-1, 1]) head.add(part(sphere(0.1), skin, { p: [sx * 0.6, -0.02, 0], s: [0.55, 1, 0.8], o: 1.1 }));
  // 볼터치
  for (const sx of [-1, 1]) head.add(flat(sphere(0.085), '#ff8aa0', { p: [sx * 0.37, -0.1, 0.47], s: [1.3, 0.7, 0.35] }));

  const eyeColor = job === 'rogue' ? '#fffdf5' : '#2a2020';
  const eyesOpen = new Group(), eyesHappy = new Group(), eyesDizzy = new Group(), brows = new Group();
  for (const sx of [-1, 1]) {
    const x = sx * 0.23;
    const e = flat(sphere(0.082), eyeColor, { p: [x, 0.04, 0.565], s: [0.9, 1.3, 0.55] });
    e.add(flat(sphere(0.03), eyeColor === '#2a2020' ? '#ffffff' : '#2a2020', { p: [-0.025, 0.04, 0.12] }));
    eyesOpen.add(e);
    eyesHappy.add(flat(torus(0.08, 0.02, PI, 12), eyeColor === '#2a2020' ? LINE : eyeColor, { p: [x, 0.02, 0.57] }));
    const xs = new Group(); xs.position.set(x, 0.04, 0.575);
    xs.add(flat(box(0.17, 0.028, 0.02), LINE, { r: [0, 0, 0.78] }), flat(box(0.17, 0.028, 0.02), LINE, { r: [0, 0, -0.78] }));
    eyesDizzy.add(xs);
    brows.add(flat(box(0.17, 0.03, 0.03), hair, { p: [x, 0.22, 0.55], r: [0, sx * 0.25, -sx * 0.18] }));
  }
  eyesHappy.visible = false; eyesDizzy.visible = false;
  head.add(eyesOpen, eyesHappy, eyesDizzy, brows);

  const mouthSmile = flat(torus(0.09, 0.02, PI, 14), LINE, { p: [0, -0.1, 0.585], r: [0, 0, PI] });
  const mouthOpen = flat(sphere(0.09), '#7a2638', { p: [0, -0.15, 0.56], s: [1.15, 0.85, 0.35] });
  const mouthWavy = flat(torus(0.035, 0.016, PI * 2, 10), LINE, { p: [0, -0.15, 0.585] });
  mouthOpen.visible = false; mouthWavy.visible = false;
  head.add(mouthSmile, mouthOpen, mouthWavy);

  /* ── 직업별 머리 장식 ── */
  let topY = 2.2;
  const fringe = () => part(geo('fringe', () => new SphereGeometry(R * 1.03, 24, 14, 0, PI * 2, 0, PI * 0.42)), hair, { s: [1, 0.96, 1], o: 1.02 });
  switch (job) {
    case 'detective': {
      const hat = hsl(h, 22, 20);
      head.add(fringe());
      head.add(part(cyl(0.42, 0.46, 0.46), hat, { p: [0, 0.78, 0] }));
      head.add(part(cyl(0.9, 0.9, 0.06, 32), hat, { p: [0, 0.52, 0], r: [0.05, 0, 0.06], o: 1.04 }));
      head.add(part(torus(0.47, 0.06), accent, { p: [0, 0.6, 0], r: [PI / 2, 0, 0], o: 1.15 }));
      topY = 2.55;
      break;
    }
    case 'mage': {
      head.add(fringe());
      for (const sx of [-1, 1]) head.add(part(cap(0.1, 0.55), hair, { p: [sx * 0.55, -0.35, -0.05], r: [0, 0, sx * 0.12] }));
      head.add(part(cyl(0.88, 0.88, 0.06, 32), dark, { p: [0, 0.5, 0], r: [0.08, 0, 0], o: 1.04 }));
      head.add(part(cone(0.5, 0.85, 24), dark, { p: [0, 1.0, 0], r: [0, 0, -0.08] }));
      head.add(part(cone(0.26, 0.55, 20), dark, { p: [0.14, 1.6, 0], r: [0, 0, -0.6] }));
      head.add(part(torus(0.5, 0.06), accent, { p: [0, 0.57, 0], r: [PI / 2, 0, 0], o: 1.15 }));
      head.add(flat(new OctahedronGeometry(0.1), GOLD, { p: [0, 0.98, 0.45] }));
      topY = 2.95;
      break;
    }
    case 'ninja': {
      // 얼굴 부분만 뚫린 후드 + 이마 머리띠 + 복면
      head.add(part(geo('hoodTop', () => new SphereGeometry(0.69, 24, 12, 0, PI * 2, 0, 0.78)), dark, { o: 1.03 }));
      head.add(part(geo('hoodSide', () => new SphereGeometry(0.69, 24, 16, PI / 2 + 0.9, PI * 2 - 1.8, 0, PI)), dark, { o: 1.03 }));
      head.add(part(torus(0.58, 0.06), accent, { p: [0, 0.3, 0], r: [PI / 2, 0, 0], o: 1.15 }));
      head.add(part(box(0.32, 0.17, 0.05), SILVER, { p: [0, 0.3, 0.585], o: 1.12 }));
      head.add(part(geo('mask', () => new SphereGeometry(0.645, 24, 10, PI / 2 - 1.0, 2.0, 1.75, 0.95)), dark, { o: 1.02 }));
      topY = 2.28;
      break;
    }
    case 'cleric': {
      head.add(fringe());
      head.add(part(geo('veil', () => new SphereGeometry(0.72, 24, 16, PI / 2 + 0.95, PI * 2 - 1.9, 0, PI * 0.72)), '#f6f2e8', { o: 1.03 }));
      for (const sx of [-1, 1]) head.add(part(cap(0.1, 0.8), '#f6f2e8', { p: [sx * 0.62, -0.62, -0.05], s: [1, 1, 0.55], o: 1.06 }));
      head.add(flat(torus(0.57, 0.035), GOLD, { p: [0, 0.3, 0], r: [PI / 2 - 0.15, 0, 0] }));
      head.add(part(sphere(0.06), accent, { p: [0, 0.4, 0.55], o: 1.2 }));
      for (const sx of [-1, 1]) head.add(part(cone(0.1, 0.5, 4), '#fbfaf6', { p: [sx * 0.78, 0.38, 0], r: [0, 0, -sx * 1.2], s: [1, 1, 0.4], o: 1.1 }));
      topY = 2.28;
      break;
    }
    case 'nomad': {
      head.add(part(cap(0.1, 0.4), hair, { p: [-0.55, -0.3, 0], r: [0, 0, 0.1] }));
      head.add(part(geo('veilFace', () => new SphereGeometry(0.645, 24, 10, PI / 2 - 1.0, 2.0, 1.7, 1.0)), '#e9dcc4', { o: 1.02 }));
      head.add(part(sphere(0.74), cream, { p: [0, 0.55, 0], s: [1, 0.64, 1] }));
      head.add(flat(torus(0.62, 0.05), accent, { p: [0, 0.34, 0], r: [PI / 2 - 0.08, 0, 0] }));
      head.add(part(sphere(0.07), GOLD, { p: [0, 0.38, 0.66], o: 1.2 }));
      head.add(part(cone(0.1, 0.55, 8), accent, { p: [0.22, 1.05, 0.15], r: [0.2, 0, -0.5], s: [1, 1, 0.45], o: 1.1 }));
      topY = 2.75;
      break;
    }
    default: { // rogue
      head.add(part(cap(0.12, 0.6), hair, { p: [0.55, -0.1, -0.35], r: [0.3, 0, -0.45] })); // 포니테일
      head.add(part(geo('bandana', () => new SphereGeometry(0.665, 24, 12, 0, PI * 2, 0, 1.08)), accent, { o: 1.02 }));
      head.add(flat(torus(0.595, 0.025), '#ffd24a', { p: [0, 0.4, 0], r: [PI / 2, 0, 0] }));
      head.add(part(sphere(0.09), accent, { p: [0.55, 0.3, -0.25], o: 1.15 }));
      head.add(part(box(0.3, 0.05, 0.03), accent, { p: [0.72, 0.28, -0.3], r: [0, 0, 0.6], o: 1.1 }));
      head.add(part(geo('eyemask', () => new CylinderGeometry(0.635, 0.635, 0.2, 24, 1, true, -0.95, 1.9)), '#1b1a22', { p: [0, 0.04, 0], side: DoubleSide, o: 1.02 }));
      for (const sx of [-1, 1]) head.add(flat(sphere(0.07), '#fffdf5', { p: [sx * 0.23, 0.04, 0.6], s: [1, 1.2, 0.4] }));
      topY = 2.2;
    }
  }

  const rig: Rig = { root, body, head, armL, armR, eyesOpen, eyesHappy, eyesDizzy, brows, mouthSmile, mouthOpen, mouthWavy, topY };

  /* ── 뒤쪽·바깥 진화 장식 ── */
  if (tier >= 3) {
    const cape = new Group();
    cape.position.set(0, 0.7, -0.02);
    cape.add(part(cyl(0.62, 0.92, 1.2, 28, true, PI - 1.05, 2.1), hsl(h + 160, 45, 30), { side: DoubleSide, o: 1.02 }));
    body.add(cape);
    rig.cape = cape;
  }
  if (tier >= 5) {
    const mkWing = (sx: number) => {
      const g = new Group(); // 어깨 뒤의 경첩 — 회전은 이 그룹에, 좌우 반전은 안쪽 메시에
      g.position.set(sx * 0.12, 1.2, -0.3);
      const m = new Group();
      m.scale.x = sx;
      const w = new Mesh(feather(1.3, 0.55), toon('#fbfaf6', DoubleSide));
      w.rotation.z = -0.12;
      const ol = new Mesh(feather(1.3, 0.55), outlineMat);
      ol.scale.setScalar(1.05);
      w.add(ol);
      m.add(w);
      g.add(m);
      g.rotation.y = -sx * 0.5;
      return g;
    };
    rig.wingR = mkWing(1); rig.wingL = mkWing(-1);
    body.add(rig.wingL, rig.wingR);
    const halo = new Mesh(geo('halo', () => new TorusGeometry(0.34, 0.045, 10, 32)), glow(GOLD));
    halo.rotation.x = PI / 2 - 0.15;
    halo.position.set(0, topY + 0.18 - 1.58 + 0.0, 0);
    head.add(halo);
    rig.halo = halo;
  }
  if (tier >= 4) {
    const aura = new Mesh(geo('aura', () => new SphereGeometry(1.22, 28, 18)),
      new MeshBasicMaterial({ color: tier >= 5 ? GOLD : accent, transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false, side: BackSide }));
    aura.position.set(0, 1.15, 0);
    body.add(aura);
    rig.aura = aura;
    const sparks = new Group();
    for (let i = 0; i < 4; i++) {
      const s = new Mesh(geo('spark', () => new OctahedronGeometry(0.07)), glow('#ffe9a0'));
      s.userData.phase = i * (PI / 2);
      sparks.add(s);
    }
    sparks.position.set(0, 1.4, 0);
    body.add(sparks);
    rig.sparks = sparks;
  }
  return rig;
}
