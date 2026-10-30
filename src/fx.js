// 연출 — 파티클 · 화면 흔들림 · 번쩍임 · 3D 등장.
// 전부 DOM + Web Animations API. 라이브러리 없음, 프레임 루프 없음(애니메이션은 브라우저가 돌린다).
//
// 설계 규칙
//  1) 게임판에는 기울이기/그림자 같은 상시 효과를 걸지 않는다. 차이 축 중 크기·위치·기울기가 있어서
//     원근이 들어가면 '원근 때문에 커 보이는 칸'이 생겨 공정성이 깨진다. 판 전체의 일회성 등장 연출만 쓴다.
//  2) 흔들림은 세기를 제곱해 쓴다 — 작은 사건은 거의 안 흔들리고, 큰 사건만 확실히 흔들린다.
//  3) '움직임 줄이기' 설정(또는 OS 설정)이 켜져 있으면 모든 효과를 건너뛴다.

// 연출용 난수. 퍼즐 시드(rng.js)와 완전히 분리되어 있어 같은 시드 = 같은 문제 보장에 영향이 없다.
const rnd = (() => {
  let s = (Date.now() & 0x7fffffff) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; };
})();

const MAX_PARTICLES = 60;

export function createFx({ app, layer, flash, shakeTarget, board }){
  const enabled = () =>
    document.documentElement.dataset.reduced !== 'on' &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches;

  let alive = 0;

  /** 칸 중심에서 파티클을 터뜨린다. power 1~3 (콤보에 따라 커진다) */
  function burst(cell, power = 1, hue = 160){
    if (!enabled() || !cell) return;
    const a = app.getBoundingClientRect(), r = cell.getBoundingClientRect();
    const cx = r.left - a.left + r.width / 2, cy = r.top - a.top + r.height / 2;
    const n = Math.min(26, 8 + power * 5);
    for (let i = 0; i < n && alive < MAX_PARTICLES; i++){
      const p = document.createElement('span');
      p.className = 'fx-p';
      const size = 5 + rnd() * 7;
      p.style.cssText = `left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;` +
        `background:hsl(${(hue + rnd() * 50 - 10) % 360} 85% ${62 + rnd() * 16}%)`;
      const ang = rnd() * Math.PI * 2, dist = 36 + rnd() * (34 + power * 18);
      layer.appendChild(p); alive++;
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
    layer.appendChild(ring);
    ring.animate([{ transform: 'translate(-50%,-50%) scale(.8)', opacity: .9 },
                  { transform: 'translate(-50%,-50%) scale(1.9)', opacity: 0 }],
                 { duration: 380, easing: 'ease-out' }).onfinish = () => ring.remove();
  }

  /** trauma 0~1. 실제 진폭은 trauma² 에 비례한다. */
  function shake(trauma = .5){
    if (!enabled()) return;
    const amp = 14 * trauma * trauma;
    const kf = [];
    for (let i = 0; i < 6; i++){
      const k = 1 - i / 6;
      kf.push({ transform: `translate(${(rnd() * 2 - 1) * amp * k}px, ${(rnd() * 2 - 1) * amp * k}px)` });
    }
    kf.push({ transform: 'translate(0,0)' });
    shakeTarget.animate(kf, { duration: 300, easing: 'ease-out' });
  }

  /** 가장자리 번쩍임 (색은 호출하는 쪽이 정한다) */
  function pulse(color, strength = .5){
    if (!enabled()) return;
    flash.style.background = `radial-gradient(circle at 50% 50%, transparent 45%, ${color} 140%)`;
    flash.animate([{ opacity: 0 }, { opacity: strength }, { opacity: 0 }], { duration: 360, easing: 'ease-out' });
  }

  /** 새 판이 뒤로 눕혀졌다가 일어서며 들어오는 3D 등장 */
  function boardIn(){
    if (!enabled()) return;
    board.animate([
      { transform: 'rotateX(42deg) translateZ(-90px) scale(.9)', opacity: 0 },
      { transform: 'rotateX(0) translateZ(0) scale(1)', opacity: 1 },
    ], { duration: 240, easing: 'cubic-bezier(.2,.9,.3,1.05)' });
  }

  /** 타이틀·결과 화면용: 포인터 위치에 따라 target을 살짝 돌린다. 게임판에는 쓰지 않는다. */
  function attachTilt(root, target, maxDeg = 14){
    let raf = 0;
    root.addEventListener('pointermove', e => {
      if (!enabled() || e.pointerType === 'touch') return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = root.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        target.style.setProperty('--ry', (x * maxDeg * 2).toFixed(1) + 'deg');
        target.style.setProperty('--rx', (-y * maxDeg).toFixed(1) + 'deg');
      });
    });
    root.addEventListener('pointerleave', () => {
      target.style.setProperty('--ry', '0deg'); target.style.setProperty('--rx', '0deg');
    });
  }

  return { burst, shake, pulse, boardIn, attachTilt };
}
