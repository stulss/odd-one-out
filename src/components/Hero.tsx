// 캐릭터 — 이미지 파일 없이 CSS 도형으로 그린다 (게임 오브젝트와 같은 원칙).
// 표정은 data-mood, 진화 단계는 data-tier 속성 하나로 바뀐다. 모양은 theme.css가 그린다.
import type { CSSProperties } from 'react';
import type { Hero as HeroData } from '../engine/save';
import type { Mood } from '../engine/game';

interface Props {
  hero: HeroData;
  tier?: number; // 0~5
  mood?: Mood;
  evolve?: boolean; // 진화 연출 (등장 시 한 번)
}

export function Hero({ hero, tier = 0, mood = 'idle', evolve = false }: Props) {
  return (
    <div
      className={'hero' + (evolve ? ' evolve' : '')}
      data-mood={mood}
      data-tier={tier}
      style={{ '--hh': hero.hue } as CSSProperties}
    >
      {/* 몸 뒤에 깔리는 것들 (z-index:-1) — DOM 순서가 겹침 순서 */}
      {tier >= 5 && <><b className="wing l" /><b className="wing r" /></>}
      {tier >= 3 && <b className="cape" />}
      {tier >= 4 && <b className="aura" />}
      <b className="arm l" /><b className="arm r" />
      <b className="foot l" /><b className="foot r" />
      <div className={'hero-body hs-' + hero.shape}>
        <i className="brow l" /><i className="brow r" />
        <i className="eye l" /><i className="eye r" />
        <i className="cheek l" /><i className="cheek r" />
        <i className="mouth" />
      </div>
      {tier >= 2 && <b className="scarf" />}
      {tier >= 1 && <b className="badge" />}
      {hero.acc !== 'none' && <b className={'acc ' + hero.acc} />}
      {tier >= 5 && <b className="halo" />}
    </div>
  );
}

/** 안내 로봇 '렌즈' */
export function Npc() {
  return (
    <div className="hero npc" data-mood="idle">
      <div className="hero-body hs-circle"><i className="ring" /><i className="pupil" /></div>
      <b className="acc antenna" />
    </div>
  );
}
