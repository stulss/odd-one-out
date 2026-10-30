// 보스 — 복제품 물건 하나에 험상궂은 표정을 얹어서 만든다. 물건 그림(objects.ts)을 그대로 재사용하므로
// 보스를 새로 그리는 데이터는 표정 위치(face)뿐이다.
import type { CSSProperties } from 'react';
import type { BossDef } from '../engine/bosses';
import { ObjectIcon } from './ObjectIcon';

interface Props { boss: BossDef; defeated?: boolean; small?: boolean }

export function BossFigure({ boss, defeated = false, small = false }: Props) {
  const f = boss.face;
  return (
    <div className={'bossFig' + (defeated ? ' down' : '') + (small ? ' small' : '')} style={{ '--hue': boss.hue } as CSSProperties} id={small ? undefined : 'bossFig'}>
      <ObjectIcon kind={boss.kind} />
      <svg className="bossFace" viewBox="0 0 100 100" aria-hidden="true">
        <g transform={`translate(${f.x} ${f.y}) scale(${f.s})`} stroke="#2a2230" strokeLinecap="round" strokeLinejoin="round">
          {[-13, 13].map(dx => (
            <g key={dx} transform={`translate(${dx} 0)`}>
              {defeated ? (
                <path d="M-6 -5 L6 5 M6 -5 L-6 5" strokeWidth="3.2" fill="none" />
              ) : (
                <>
                  <ellipse rx="8" ry="6.5" fill="#fff" strokeWidth="2" />
                  <circle cx={dx < 0 ? 2.2 : -2.2} cy="1" r="3.2" fill="#c0182e" stroke="none" />
                  <path d={dx < 0 ? 'M-11 -11 L7 -4' : 'M11 -11 L-7 -4'} strokeWidth="3.6" fill="none" />
                </>
              )}
            </g>
          ))}
          {defeated
            ? <path d="M-9 16 Q0 10 9 16" strokeWidth="3" fill="none" />
            : <path d="M-13 14 Q0 8 13 14 Q0 26 -13 14 Z M-7 14 v5 M0 13 v7 M7 14 v5" fill="#2a2230" strokeWidth="2" />}
        </g>
      </svg>
    </div>
  );
}
