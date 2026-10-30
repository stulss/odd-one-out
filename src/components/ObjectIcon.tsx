// 칸 하나의 물건. 색은 부모 칸의 --hue 와 theme 클래스(.t-base …)로 칠해서,
// 색조·밝기·채도 같은 차이를 칸(button)에 걸면 그림 전체가 한꺼번에 바뀐다.
import { memo } from 'react';
import { OBJECTS } from '../engine/objects';

export const ObjectIcon = memo(function ObjectIcon({ kind }: { kind: number }) {
  const art = OBJECTS[kind % OBJECTS.length];
  return (
    <svg className="obj" viewBox="0 0 100 100" aria-hidden="true">
      {art.layers.map((l, i) => (
        <path key={i} className={'t-' + l.tone} d={l.d} fillRule={l.eo ? 'evenodd' : undefined} />
      ))}
    </svg>
  );
});
