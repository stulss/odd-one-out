// 아이콘 — 이모지는 기기마다 모양이 달라서, 게임 안에서 반복해 쓰는 것(코인·힌트·시계·별·도감·임무)은 SVG로 통일한다.
// 면마다 그라디언트와 윤곽선을 넣어 칸의 물건 · 캐릭터와 같은 결의 그림으로 맞췄다. (그라디언트 id는 인스턴스마다 달라야 해서 useId)
import { useId, type ReactNode } from 'react';

const OUT = '#3a2c2c';

function Svg({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <svg className={'ic ' + className} viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;
}

const grad = (id: string, a: string, b: string) => (
  <linearGradient id={id} x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>
);

export function Coin({ className }: { className?: string }) {
  const g = useId().replace(/\W/g, '');
  return (
    <Svg className={className}>
      <defs>{grad(g, '#ffe58a', '#e0a21c')}</defs>
      <circle cx="12" cy="12" r="9.4" fill={`url(#${g})`} stroke={OUT} strokeWidth="1.6" />
      <circle cx="12" cy="12" r="6.2" fill="none" stroke="#b9770e" strokeWidth="1.3" opacity=".8" />
      <path d="M12 7.6l1.3 2.7 3 .4-2.2 2.1.55 2.95L12 14.2l-2.65 1.55.55-2.95-2.2-2.1 3-.45z" fill="#fff6c9" stroke="#b9770e" strokeWidth=".6" />
    </Svg>
  );
}

export function Bulb({ className }: { className?: string }) {
  const g = useId().replace(/\W/g, '');
  return (
    <Svg className={className}>
      <defs>{grad(g, '#fff2a8', '#f2b81f')}</defs>
      <path d="M12 2.8a6.6 6.6 0 0 0-3.7 12.1c.5.4.8 1 .8 1.6v.6h5.8v-.6c0-.6.3-1.2.8-1.6A6.6 6.6 0 0 0 12 2.8z" fill={`url(#${g})`} stroke={OUT} strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="9.2" y="17.6" width="5.6" height="2.4" rx="1" fill="#b8c2d3" stroke={OUT} strokeWidth="1.3" />
      <path d="M10 21.4h4" stroke={OUT} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9.6 7.4a3.6 3.6 0 0 1 2.2-1.6" fill="none" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity=".85" />
    </Svg>
  );
}

export function Clock({ className }: { className?: string }) {
  const g = useId().replace(/\W/g, '');
  return (
    <Svg className={className}>
      <defs>{grad(g, '#f4f7ff', '#b9c6e0')}</defs>
      <rect x="10" y="1.8" width="4" height="2.4" rx="1" fill="#8793ad" stroke={OUT} strokeWidth="1.2" />
      <circle cx="12" cy="13.4" r="8.2" fill={`url(#${g})`} stroke={OUT} strokeWidth="1.6" />
      <path d="M12 13.4V8.6M12 13.4l3.2 2" fill="none" stroke="#e0465a" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="13.4" r="1.1" fill={OUT} />
    </Svg>
  );
}

export function Star({ className }: { className?: string }) {
  const g = useId().replace(/\W/g, '');
  return (
    <Svg className={className}>
      <defs>{grad(g, '#ffe58a', '#f0a81c')}</defs>
      <path d="M12 2.6l2.9 6 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9z" fill={`url(#${g})`} stroke={OUT} strokeWidth="1.5" strokeLinejoin="round" />
    </Svg>
  );
}

export function Book({ className }: { className?: string }) {
  const g = useId().replace(/\W/g, '');
  return (
    <Svg className={className}>
      <defs>{grad(g, '#7df0d4', '#27a98d')}</defs>
      <path d="M2.8 5.2c3-1.2 6-1 9.2 1v13.6c-3.2-2-6.2-2.2-9.2-1z M21.2 5.2c-3-1.2-6-1-9.2 1v13.6c3.2-2 6.2-2.2 9.2-1z" fill={`url(#${g})`} stroke={OUT} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M5.2 8.6c1.8-.4 3.6-.2 5.2.7M18.8 8.6c-1.8-.4-3.6-.2-5.2.7" fill="none" stroke="#e8fff9" strokeWidth="1.1" strokeLinecap="round" opacity=".85" />
    </Svg>
  );
}

export function Target({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9.2" fill="#fff" stroke={OUT} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="6.4" fill="#e0465a" stroke={OUT} strokeWidth="1.2" />
      <circle cx="12" cy="12" r="3.6" fill="#fff" stroke={OUT} strokeWidth="1.1" />
      <circle cx="12" cy="12" r="1.5" fill="#e0465a" />
    </Svg>
  );
}
