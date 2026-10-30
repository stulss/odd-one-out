// 게임 밖 화면의 3D 배경 — 복제품 물건들이 깊이가 다른 층에 떠서 천천히 돈다.
// 순수 장식이다: 게임 중(PLAY·PAUSED·STORY)에는 그려지지 않는다. 판 위에 장식이 있으면 눈이 분산되고
// 어떤 칸이 '다르게 보이는지' 판단을 흐리기 때문이다. 포인터를 따라 전체가 살짝 기울어(fx.attachTilt) 입체감을 낸다.
import type { CSSProperties, RefObject } from 'react';
import { ObjectIcon } from './ObjectIcon';

interface Item { k: number; x: string; y: string; z: number; s: number; h: number; t: number; d: number }

// z가 작을수록 멀리 있다 (더 작고 흐리고 느리게 움직인다)
const ITEMS: Item[] = [
  { k: 0, x: '6%',  y: '10%', z: -260, s: 86, h: 0,   t: 7,  d: 0 },
  { k: 3, x: '78%', y: '8%',  z: -180, s: 78, h: 40,  t: 8,  d: -2 },
  { k: 5, x: '86%', y: '38%', z: -60,  s: 70, h: 80,  t: 6,  d: -1 },
  { k: 1, x: '4%',  y: '42%', z: -120, s: 74, h: 120, t: 9,  d: -3 },
  { k: 7, x: '12%', y: '70%', z: 40,   s: 88, h: 160, t: 7,  d: -4 },
  { k: 2, x: '80%', y: '66%', z: 20,   s: 92, h: 200, t: 8,  d: -2 },
  { k: 4, x: '44%', y: '84%', z: -220, s: 80, h: 240, t: 10, d: -5 },
  { k: 6, x: '58%', y: '4%',  z: -320, s: 68, h: 280, t: 9,  d: -1 },
  { k: 3, x: '30%', y: '90%', z: 80,   s: 60, h: 320, t: 6,  d: -3 },
  { k: 0, x: '92%', y: '88%', z: -140, s: 66, h: 20,  t: 8,  d: -4 },
];

export function BgScene({ worldRef, hue }: { worldRef: RefObject<HTMLDivElement | null>; hue: number }) {
  return (
    <div id="bgScene" aria-hidden="true" style={{ '--bgh': hue } as CSSProperties}>
      <div className="bgWorld" ref={worldRef}>
        {ITEMS.map((it, i) => {
          const depth = (it.z + 320) / 400; // 0(먼) ~ 1(가까운)
          return (
            <div
              key={i} className="bgObj"
              style={{
                '--x': it.x, '--y': it.y, '--z': `${it.z}px`, '--s': `${it.s}px`, '--t': `${it.t * 2}s`, '--d': `${it.d}s`,
                '--o': (0.16 + depth * 0.22).toFixed(2), '--b': `${((1 - depth) * 2.4).toFixed(1)}px`,
                '--hue': `calc(var(--bgh) + ${it.h})`,
              } as CSSProperties}
            >
              <ObjectIcon kind={it.k} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
