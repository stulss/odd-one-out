// 게임 로고 엠블럼 — 게임의 핵심 모양 그대로: 똑같은 칸들 사이에서 딱 하나만 살짝 다르다(기울어진 민트색 칸).
// 그 칸 위에 돋보기를 얹어 '감별'을 표현했다. 이미지 파일 없이 코드로 그린다.
import { useId } from 'react';

export function Logo({ className = '' }: { className?: string }) {
  const u = useId().replace(/\W/g, '');
  return (
    <svg className={'logo ' + className} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={u + 'b'} x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stopColor="#6f93ff" /><stop offset="1" stopColor="#3558d6" /></linearGradient>
        <linearGradient id={u + 'm'} x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stopColor="#9bf6dd" /><stop offset="1" stopColor="#2fc9a4" /></linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="61" height="61" rx="15" fill="#10151d" stroke="#232a34" strokeWidth="2" />
      {[0, 1, 2].flatMap(r => [0, 1, 2].map(c => {
        const x = 9 + c * 17.5, y = 9 + r * 17.5;
        if (r === 1 && c === 2) return null; // 이 자리에는 다른 칸이 들어간다
        return <rect key={`${r}${c}`} x={x} y={y} width="13" height="13" rx="3.4" fill={`url(#${u}b)`} stroke="#1b2233" strokeWidth="1" />;
      }))}
      <g className="logo-odd" transform="rotate(12 51.5 33)">
        <rect x="45" y="26.5" width="13" height="13" rx="3.4" fill={`url(#${u}m)`} stroke="#14594a" strokeWidth="1" />
      </g>
      {/* 돋보기 */}
      <g className="logo-lens">
        <circle cx="46" cy="30" r="11.5" fill="rgba(190,225,255,.14)" stroke="#f2c14e" strokeWidth="2.6" />
        <path d="M54.4 38.6l7 7" stroke="#8a5a2b" strokeWidth="4.2" strokeLinecap="round" />
        <path d="M38.6 25.5a8.6 8.6 0 0 1 5.4-3.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".7" />
      </g>
    </svg>
  );
}
