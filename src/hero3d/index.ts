// 3D 캐릭터 렌더 관리자 — WebGL 컨텍스트를 하나만 만들어 모든 캐릭터가 나눠 쓴다.
//
// 브라우저는 동시에 살려 둘 수 있는 WebGL 컨텍스트 수가 제한적이라(기기에 따라 8~16개), 캐릭터마다
// <Canvas>(=컨텍스트)를 만들면 HUD·타이틀·대사 화면 등이 겹칠 때 오래된 컨텍스트가 죽는다.
// 그래서 보이지 않는 WebGL 캔버스 하나로 각 캐릭터를 차례로 그린 뒤, 결과를 각 화면의 2D 캔버스에 복사한다.
// 이 파일은 React.lazy 로 불러온다 — three.js(약 130KB gzip)는 3D 캐릭터가 처음 필요할 때만 내려받는다.
import { Color, HemisphereLight, DirectionalLight, PerspectiveCamera, Scene, WebGLRenderer, MathUtils } from 'three';
import type { Hero as HeroData } from '../engine/save';
import type { Mood } from '../engine/game';
import { buildHero, type Rig } from './model';

const GL_W = 400, GL_H = 500; // 공유 렌더 버퍼 (비율 4:5)
const BLINK_EVERY = 4.2;

let renderer: WebGLRenderer | null = null;
let camera: PerspectiveCamera | null = null;
const views = new Set<View>();
let raf = 0;

function ensureRenderer() {
  if (renderer) return;
  const canvas = document.createElement('canvas');
  renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.setSize(GL_W, GL_H, false);
  renderer.setClearColor(new Color(0x000000), 0);
  // 카메라: 발끝(y=0)~머리 장식 사이가 화면 가운데 약 2/3를 차지하도록. 날개·오라가 들어갈 여백을 둔다.
  camera = new PerspectiveCamera(27, GL_W / GL_H, 0.1, 50);
  camera.position.set(0, 1.9, 8.4);
  camera.lookAt(0, 1.3, 0);
}

export interface HeroView {
  update(hero: HeroData, tier: number, mood: Mood, evolve: boolean): void;
  dispose(): void;
}

class View implements HeroView {
  private scene = new Scene();
  private rig: Rig | null = null;
  private ctx: CanvasRenderingContext2D | null;
  private t0 = performance.now();
  private evolveAt = -10; // 진화 연출을 시작한 시각 (초)
  private mood: Mood = 'idle';
  private key = '';
  dirty = true;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
    this.scene.add(new HemisphereLight(0xffffff, 0x8a93b0, 1.5));
    const sun = new DirectionalLight(0xffffff, 2.6);
    sun.position.set(2.5, 4.5, 5);
    this.scene.add(sun);
    const rim = new DirectionalLight(0xbfd6ff, 0.9);
    rim.position.set(-3, 2, -3);
    this.scene.add(rim);
  }

  update(hero: HeroData, tier: number, mood: Mood, evolve: boolean) {
    const key = JSON.stringify([hero.job, hero.hairColor, hero.skin, hero.outfit, hero.acc, tier]);
    if (key !== this.key) { // 모양이 바뀔 때만 다시 만든다 (표정만 바뀌면 그대로)
      if (this.rig) this.scene.remove(this.rig.root);
      this.rig = buildHero(hero, tier);
      this.scene.add(this.rig.root);
      this.key = key;
    }
    this.mood = mood;
    if (evolve) this.evolveAt = this.now();
    this.dirty = true;
  }

  private now() { return (performance.now() - this.t0) / 1000; }

  private calm() { return document.documentElement.dataset.reduced === 'on' || matchMedia('(prefers-reduced-motion: reduce)').matches; }

  /** 이 캐릭터를 공유 렌더러로 그려 자기 2D 캔버스에 복사한다 */
  draw() {
    if (!this.rig || !renderer || !camera || !this.ctx) return;
    const calm = this.calm();
    if (calm && !this.dirty) return; // 움직임 줄이기: 바뀔 때만 다시 그린다
    this.animate(this.now(), calm);
    renderer.render(this.scene, camera);
    const { width: cw, height: ch } = this.fit();
    this.ctx.clearRect(0, 0, cw, ch);
    this.ctx.drawImage(renderer.domElement, 0, 0, GL_W, GL_H, 0, 0, cw, ch);
    this.dirty = false;
  }

  /** CSS 크기에 맞춰 캔버스 해상도를 맞춘다 (dpr 최대 2) */
  private fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    return { width: w, height: h };
  }

  private animate(t: number, calm: boolean) {
    const r = this.rig!;
    const mood = this.mood;
    const happy = mood === 'happy', dizzy = mood === 'dizzy';

    // 표정
    r.eyesOpen.visible = !happy && !dizzy;
    r.eyesHappy.visible = happy;
    r.eyesDizzy.visible = dizzy;
    r.brows.visible = !dizzy;
    r.mouthSmile.visible = !happy && !dizzy;
    r.mouthOpen.visible = happy;
    r.mouthWavy.visible = dizzy;
    // 깜빡임
    const blink = (t % BLINK_EVERY) > BLINK_EVERY - 0.18 && !calm ? 0.1 : 1;
    r.eyesOpen.scale.y = blink;

    // 팔: 기쁨=만세, 어지러움=벌림, 기본=내림 (오른쪽은 +z 회전이 바깥쪽)
    const target = happy ? 2.55 : dizzy ? 1.25 : 0.2;
    const sway = calm ? 0 : Math.sin(t * 2.4) * 0.05;
    r.armR.rotation.z = MathUtils.lerp(r.armR.rotation.z, target + sway, 0.25);
    r.armL.rotation.z = MathUtils.lerp(r.armL.rotation.z, -(target + sway), 0.25);
    if (happy && !calm) { r.armR.rotation.z += Math.sin(t * 9) * 0.12; r.armL.rotation.z -= Math.sin(t * 9) * 0.12; }

    // 전체: 살짝 돌아보기 + 숨쉬기 + (기쁨) 폴짝 — 3/4 각도로 서 있어 입체감이 난다
    let yaw = 0.28 + (calm ? 0 : Math.sin(t * 0.7) * 0.42);
    let lift = calm ? 0 : Math.sin(t * 2.2) * 0.03;
    if (happy && !calm) lift += Math.abs(Math.sin(t * 6)) * 0.12;
    r.head.rotation.z = dizzy && !calm ? Math.sin(t * 9) * 0.13 : 0;
    if (dizzy && !calm) yaw += Math.sin(t * 7) * 0.25;
    r.body.scale.y = 1 + (calm ? 0 : Math.sin(t * 2.2 + 1) * 0.012);

    // 진화 연출: 두 바퀴 돌며 커졌다 제자리로
    const u = (t - this.evolveAt) / 1.1;
    let pop = 1;
    if (u >= 0 && u <= 1) {
      const e = 1 - Math.pow(1 - u, 3);
      yaw += e * PI2 * 2;
      pop = u < 0.6 ? 0.3 + (u / 0.6) * 0.92 : 1.22 - ((u - 0.6) / 0.4) * 0.22;
      this.dirty = true;
    }
    r.root.rotation.y = yaw;
    r.root.position.y = lift;
    r.root.scale.setScalar(pop);

    // 진화 장식
    if (r.cape && !calm) r.cape.rotation.y = Math.sin(t * 1.8) * 0.06;
    if (r.wingL && r.wingR && !calm) { const f = Math.sin(t * 3) * 0.18; r.wingR.rotation.y = -0.5 - f; r.wingL.rotation.y = 0.5 + f; } // 좌우 대칭으로 퍼덕임
    if (r.aura) r.aura.scale.setScalar(1 + (calm ? 0 : Math.sin(t * 2.6) * 0.06));
    if (r.halo && !calm) r.halo.position.y = r.topY + 0.18 - 1.58 + Math.sin(t * 2.4) * 0.03;
    if (r.sparks) {
      r.sparks.children.forEach((s, i) => {
        const a = (calm ? 0 : t * 1.2) + (s.userData.phase as number);
        s.position.set(Math.cos(a) * 1.05, Math.sin(a * 1.7 + i) * 0.7, Math.sin(a) * 0.8);
        s.rotation.y = a * 2;
        s.scale.setScalar(calm ? 1 : 0.7 + 0.5 * Math.abs(Math.sin(t * 3 + i)));
      });
    }
  }

  dispose() {
    views.delete(this);
    if (this.rig) this.scene.remove(this.rig.root);
    this.rig = null;
  }
}
const PI2 = Math.PI * 2;

function loop() {
  raf = 0;
  if (!views.size) return;
  if (!document.hidden) views.forEach(v => v.draw());
  raf = requestAnimationFrame(loop);
}

/** 이 캔버스에 3D 캐릭터를 그리는 뷰를 만든다. 쓰고 나면 dispose() 한다. */
export function createHeroView(canvas: HTMLCanvasElement): HeroView {
  ensureRenderer();
  const v = new View(canvas);
  views.add(v);
  if (!raf) raf = requestAnimationFrame(loop);
  return v;
}
