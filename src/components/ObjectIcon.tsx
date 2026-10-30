// 칸 하나의 물건. 색은 부모 칸의 --hue 로 정해서, 색조·밝기·채도 같은 차이를 칸(button)에 걸면 그림 전체가 한꺼번에 바뀐다.
//
// 입체감: 면마다 위→아래 그라디언트(밝은 쪽이 왼쪽 위)를 칠하고, 밝은 면에는 광택 하이라이트를 한 겹 더 얹고,
// 발밑에 부드러운 접지 그림자를 깐다. 모두 SVG 안의 장식이라 칸 전체에 거는 차이(크기·회전·흐림…)와 함께 움직이고,
// 정답 칸만 장식이 사라지는 일이 없다. (그라디언트 id는 인스턴스마다 달라야 해서 useId를 쓴다)
import { memo, useId, type CSSProperties } from 'react';
import { OBJECTS } from '../engine/objects';

// [위, 아래] 색 — hsl(색조 채도 명도). 색조는 --hue 변수를 따른다.
const STOPS = {
  base: ['hsl(var(--hue,224) 72% 70%)', 'hsl(var(--hue,224) 64% 46%)'],
  dark: ['hsl(var(--hue,224) 58% 46%)', 'hsl(var(--hue,224) 56% 28%)'],
  light: ['hsl(var(--hue,224) 88% 92%)', 'hsl(var(--hue,224) 72% 72%)'],
} as const;

export const ObjectIcon = memo(function ObjectIcon({ kind }: { kind: number }) {
  const art = OBJECTS[kind % OBJECTS.length];
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const grad = (tone: 'base' | 'dark' | 'light') => `${uid}${tone}`;
  return (
    <svg className="obj" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        {(Object.keys(STOPS) as (keyof typeof STOPS)[]).map(t => (
          <linearGradient key={t} id={grad(t)} x1="0.15" y1="0" x2="0.55" y2="1">
            <stop offset="0" style={{ stopColor: STOPS[t][0] } as CSSProperties} />
            <stop offset="1" style={{ stopColor: STOPS[t][1] } as CSSProperties} />
          </linearGradient>
        ))}
        <radialGradient id={uid + 'gloss'} cx="0.3" cy="0.22" r="0.7">
          <stop offset="0" stopColor="#fff" stopOpacity=".5" />
          <stop offset=".55" stopColor="#fff" stopOpacity=".08" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse className="obj-shadow" cx="50" cy="96" rx="30" ry="3.6" />
      {art.layers.map((l, i) => {
        const fillRule = l.eo ? 'evenodd' : undefined;
        if (l.tone === 'ink') return <path key={i} className="t-ink" d={l.d} fillRule={fillRule} />;
        return (
          <g key={i}>
            <path d={l.d} fill={`url(#${grad(l.tone)})`} fillRule={fillRule} />
            {l.tone === 'base' && <path className="obj-gloss" d={l.d} fill={`url(#${uid}gloss)`} fillRule={fillRule} />}
          </g>
        );
      })}
    </svg>
  );
});
