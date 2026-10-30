// 연출 — 파티클 · 화면 흔들림 · 번쩍임 · 3D 등장.
// 전부 DOM + Web Animations API. 라이브러리 없음, 프레임 루프 없음(애니메이션은 브라우저가 돌린다).
//
// 설계 규칙
//  1) 게임판에는 기울이기/그림자 같은 상시 효과를 걸지 않는다. 차이 축 중 크기·위치·기울기가 있어서
//     원근이 들어가면 '원근 때문에 커 보이는 칸'이 생겨 공정성이 깨진다. 판 전체의 일회성 등장 연출만 쓴다.
//  2) 흔들림은 세기를 제곱해 쓴다 — 작은 사건은 거의 안 흔들리고, 큰 사건만 확실히 흔들린다.
//  3) '움직임 줄이기' 설정(또는 OS 설정)이 켜져 있으면 모든 효과를 건너뛴다.

// 연출용 난수. 퍼즐 시드(rng.ts)와 완전히 분리되어 있어 같은 시드 = 같은 문제 보장에 영향이 없다.
const rnd = (() => {
  let s = (Date.now() & 0x7fffffff) || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
})();

const MAX_PARTICLES = 60;

/** 연출이 그려질 DOM 요소들 — React가 마운트한 뒤 ref로 넘겨 준다 */
export interface FxTargets {
  app: HTMLElement;
  layer: HTMLElement;
  flash: HTMLElement;
  shakeTarget: HTMLElement;
  board: HTMLElement;
  confetti?: HTMLElement; // 오버레이 위에 떠 있는 색종이 층
}

export const motionEnabled = () =>
  document.documentElement.dataset.reduced !== 'on' &&
  !matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createFx(t: FxTargets) {
  let alive = 0;

  /** 칸 중심에서 파티클을 터뜨린다. power 1~3 (콤보에 따라 커진다) */
  function burst(cell: Element | undefined, power = 1, hue = 160) {
    if (!motionEnabled() || !cell) return;
    const a = t.app.getBoundingClientRect();
    const r = cell.getBoundingClientRect();
    const cx = r.left - a.left + r.width / 2;
    const cy = r.top - a.top + r.height / 2;
    const n = Math.min(26, 8 + power * 5);
    for (let i = 0; i < n && alive < MAX_PARTICLES; i++) {
      const p = document.createElement('span');
      p.className = 'fx-p';
      const size = 5 + rnd() * 7;
      p.style.cssText = `left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;` +
        `background:hsl(${(hue + rnd() * 50 - 10) % 360} 85% ${62 + rnd() * 16}%)`;
      const ang = rnd() * Math.PI * 2;
      const dist = 36 + rnd() * (34 + power * 18);
      t.layer.appendChild(p);
      alive++;
      p.animate([
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist + 14}px)) scale(0)`, opacity: 0 },
      ], { duration: 420 + rnd() * 260, easing: 'cubic-bezier(.15,.7,.3,1)' })
        .onfinish = () => { p.remove(); alive--; };
    }
    // 정답 칸 주위로 퍼지는 링
    const ring = document.createElement('span');
    ring.className = 'fx-ring';
    ring.style.cssText = `left:${cx}px;top:${cy}px;width:${r.width}px;height:${r.width}px`;
    t.layer.appendChild(ring);
    ring.animate([
      { transform: 'translate(-50%,-50%) scale(.8)', opacity: 0.9 },
      { transform: 'translate(-50%,-50%) scale(1.9)', opacity: 0 },
    ], { duration: 380, easing: 'ease-out' }).onfinish = () => ring.remove();
  }

  /** trauma 0~1. 실제 진폭은 trauma² 에 비례한다. */
  function shake(trauma = 0.5) {
    if (!motionEnabled()) return;
    const amp = 14 * trauma * trauma;
    const kf: Keyframe[] = [];
    for (let i = 0; i < 6; i++) {
      const k = 1 - i / 6;
      kf.push({ transform: `translate(${(rnd() * 2 - 1) * amp * k}px, ${(rnd() * 2 - 1) * amp * k}px)` });
    }
    kf.push({ transform: 'translate(0,0)' });
    t.shakeTarget.animate(kf, { duration: 300, easing: 'ease-out' });
  }

  /** 가장자리 번쩍임 (색은 호출하는 쪽이 정한다) */
  function pulse(color: string, strength = 0.5) {
    if (!motionEnabled()) return;
    t.flash.style.background = `radial-gradient(circle at 50% 50%, transparent 45%, ${color} 140%)`;
    t.flash.animate([{ opacity: 0 }, { opacity: strength }, { opacity: 0 }], { duration: 360, easing: 'ease-out' });
  }

  /** 새 판이 뒤로 눕혀졌다가 일어서며 들어오는 3D 등장 */
  function boardIn() {
    if (!motionEnabled()) return;
    t.board.animate([
      { transform: 'rotateX(42deg) translateZ(-90px) scale(.9)', opacity: 0 },
      { transform: 'rotateX(0) translateZ(0) scale(1)', opacity: 1 },
    ], { duration: 240, easing: 'cubic-bezier(.2,.9,.3,1.05)' });
  }

  /** 칸 위로 떠오르는 글씨 (+점수, FAST! 같은 즉각적인 보상 표시) */
  function popText(anchor: Element | undefined, text: string, color = '#fff', big = false) {
    if (!motionEnabled() || !anchor || alive >= MAX_PARTICLES) return;
    const a = t.app.getBoundingClientRect();
    const r = anchor.getBoundingClientRect();
    const el = document.createElement('span');
    el.className = 'fx-text' + (big ? ' big' : '');
    el.textContent = text;
    el.style.cssText = `left:${r.left - a.left + r.width / 2}px;top:${r.top - a.top + r.height * 0.3}px;color:${color}`;
    t.layer.appendChild(el);
    alive++;
    el.animate([
      { transform: 'translate(-50%,0) scale(.5)', opacity: 0 },
      { transform: 'translate(-50%,-14px) scale(1.25)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%,-52px) scale(1)', opacity: 0 },
    ], { duration: big ? 900 : 700, easing: 'ease-out' }).onfinish = () => { el.remove(); alive--; };
  }

  /** 화면 가운데에 크게 터지는 글씨 (COMBO, 번개 판 시작 등) */
  function banner(text: string, color = '#ffd75e') {
    if (!motionEnabled()) return;
    const el = document.createElement('div');
    el.className = 'fx-banner';
    el.textContent = text;
    el.style.color = color;
    t.layer.appendChild(el);
    el.animate([
      { transform: 'translate(-50%,-50%) scale(2.2)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.2 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%,-62%) scale(.9)', opacity: 0 },
    ], { duration: 1100, easing: 'cubic-bezier(.2,.9,.3,1)' }).onfinish = () => el.remove();
  }

  /** 색종이: 위에서 흩날리며 떨어진다 (사건 해결 · 보스 격파). big이면 더 많이. */
  function confetti(big = false) {
    const layer = t.confetti;
    if (!motionEnabled() || !layer) return;
    const n = big ? 70 : 42;
    const colors = ['#5EE6C5', '#ffd75e', '#ff6b8a', '#7aa2ff', '#ffa94d', '#c77dff'];
    const w = layer.clientWidth || 360, h = layer.clientHeight || 700;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.className = 'confetti';
      const sz = 6 + rnd() * 7;
      p.style.cssText = `left:${rnd() * w}px;top:-14px;width:${sz}px;height:${sz * (0.5 + rnd() * 0.9)}px;background:${colors[Math.floor(rnd() * colors.length)]}`;
      layer.appendChild(p);
      const drift = (rnd() - 0.5) * 160;
      p.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${drift}px,${h * (0.55 + rnd() * 0.5)}px) rotate(${(rnd() - 0.5) * 900}deg)`, opacity: 0.9, offset: 0.85 },
        { transform: `translate(${drift * 1.1}px,${h + 30}px) rotate(${(rnd() - 0.5) * 1000}deg)`, opacity: 0 },
      ], { duration: 1700 + rnd() * 1300, delay: rnd() * 350, easing: 'cubic-bezier(.3,.6,.5,1)', fill: 'forwards' }).onfinish = () => p.remove();
    }
  }

  return { burst, shake, pulse, boardIn, popText, banner, confetti };
}

export type Fx = ReturnType<typeof createFx>;

/** 타이틀·결과 화면용: 포인터 위치에 따라 target을 살짝 돌린다. 게임판에는 쓰지 않는다. 해제 함수를 돌려준다. */
export function attachTilt(root: HTMLElement, target: HTMLElement, maxDeg = 14): () => void {
  let raf = 0;
  const move = (e: PointerEvent) => {
    if (!motionEnabled() || e.pointerType === 'touch') return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const r = root.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      target.style.setProperty('--ry', (x * maxDeg * 2).toFixed(1) + 'deg');
      target.style.setProperty('--rx', (-y * maxDeg).toFixed(1) + 'deg');
    });
  };
  const leave = () => {
    target.style.setProperty('--ry', '0deg');
    target.style.setProperty('--rx', '0deg');
  };
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerleave', leave);
  return () => {
    cancelAnimationFrame(raf);
    root.removeEventListener('pointermove', move);
    root.removeEventListener('pointerleave', leave);
  };
}
