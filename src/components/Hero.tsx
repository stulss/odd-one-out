// 캐릭터 '감별사' — 인라인 SVG 일러스트. 이미지 파일 없이 코드로 그린다 (게임 오브젝트와 같은 원칙).
//
// 설계: 큰 머리 + 아주 작은 얼굴, 대신 모자·두건·후드·망토 같은 '복장의 실루엣'으로 개성을 낸다.
//  · 복장(job) 6종 — 탐정 · 마법사 · 닌자 · 사제 · 유랑민 · 도적. 각자 머리 장식과 상의 모양이 완전히 다르다.
//  · 색은 머리색 · 피부 · 옷색(포인트 색은 옷색의 보색에서 자동 계산)으로 고른다.
//  · 등급(tier 0~5)이 오르면 복장 종류와 상관없이 같은 방식으로 한 겹씩 얹힌다.
//      0 기본 복장 → 1 브로치 → 2 어깨 망토 → 3 뒷망토+견장 → 4 금장+오라 → 5 날개+후광
// 표정·진화 연출은 data-mood / .evolve 와 theme.css 가 맡는다. viewBox 120×150, 발끝이 y≈146.
import { useId, type ReactNode } from 'react';
import type { Hero as HeroData, Job } from '../engine/save';
import type { Mood } from '../engine/game';
import { HAIR_COLORS, OUTFIT_HUES, SKINS, normalizeHero } from '../engine/heroData';

const LINE = '#3a2c2c'; // 따뜻한 갈색 윤곽선 — 순검정보다 손그림 느낌이 난다
const GOLD = '#f2c14e';
const SILVER = '#cfd6e4';
const BRONZE = '#c27a2c';
// 직업별 머리 장식의 맨 위 y좌표 (후광을 그 위에 띄우기 위해)
const TOP: Record<Job, number> = { detective: 6, mage: -2, ninja: 12, cleric: 8, nomad: -4, rogue: 14 };

interface Pal {
  main: string; dark: string; light: string; accent: string; skin: string; hair: string; cream: string; hat: string;
}
const ln = { stroke: LINE, strokeWidth: 1.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

interface Props {
  hero: HeroData;
  tier?: number; // 0~5
  mood?: Mood;
  evolve?: boolean; // 진화 연출 (등장 시 한 번)
}

export function Hero({ hero: raw, tier = 0, mood = 'idle', evolve = false }: Props) {
  const gid = useId();
  const hero = normalizeHero(raw);
  const h = OUTFIT_HUES[hero.outfit];
  const pal: Pal = {
    main: `hsl(${h} 34% 40%)`,
    dark: `hsl(${h} 30% 22%)`,
    light: `hsl(${h} 38% 64%)`,
    accent: `hsl(${(h + 160) % 360} 62% 56%)`,
    skin: SKINS[hero.skin],
    hair: HAIR_COLORS[hero.hairColor],
    cream: '#efe7d6',
    hat: `hsl(${h} 22% 20%)`,
  };
  const job = hero.job;
  const metal = tier >= 4 ? GOLD : tier >= 3 ? SILVER : BRONZE;
  const auraC = tier >= 5 ? GOLD : pal.accent;
  const wide = job === 'mage' || job === 'cleric'; // 넓은 소매

  // 팔 · 손: 기쁨 = 만세, 어지러움 = 벌린 팔, 기본 = 내림
  const arms = mood === 'happy'
    ? { l: 'M45 88 Q33 84 31 68', r: 'M75 88 Q87 84 89 68', lh: [31, 65], rh: [89, 65] }
    : mood === 'dizzy'
      ? { l: 'M45 88 Q33 96 31 106', r: 'M75 88 Q87 96 89 106', lh: [31, 109], rh: [89, 109] }
      : { l: 'M45 88 Q37 98 40 108', r: 'M75 88 Q83 98 80 108', lh: [40, 111], rh: [80, 111] };
  const sleeve = job === 'ninja' ? pal.dark : job === 'nomad' ? pal.cream : job === 'cleric' ? pal.cream : pal.main;

  return (
    <svg className={'chara' + (evolve ? ' evolve' : '')} viewBox="0 0 120 150" data-mood={mood} data-tier={tier} data-job={job} aria-hidden="true">
      <defs>
        <radialGradient id={gid + 'a'}>
          <stop offset="58%" stopColor={auraC} stopOpacity="0" />
          <stop offset="82%" stopColor={auraC} stopOpacity=".5" />
          <stop offset="100%" stopColor={auraC} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ── 몸 뒤에 깔리는 것들 ── */}
      {tier >= 4 && <circle className="aura" cx="60" cy="84" r="68" fill={`url(#${gid}a)`} />}
      {tier >= 5 && (
        <g>
          <path className="wing l" {...ln} fill="#fbfaf6"
            d="M46 88 Q6 54 2 96 Q12 88 17 99 Q15 113 30 112 Q34 126 49 117 Z" />
          <path className="wing r" {...ln} fill="#fbfaf6"
            d="M74 88 Q114 54 118 96 Q108 88 103 99 Q105 113 90 112 Q86 126 71 117 Z" />
        </g>
      )}
      {tier >= 3 && (
        <path className="cape" {...ln} fill={`hsl(${(h + 160) % 360} 45% 30%)`}
          d="M42 86 Q20 112 22 144 Q60 152 98 144 Q100 112 78 86 Z" />
      )}
      <ellipse cx="60" cy="147" rx="26" ry="3.4" fill="rgba(0,0,0,.33)" />

      {/* ── 다리 · 신발 (복장이 발목까지 덮는 직업은 신발만 보인다) ── */}
      <Legs job={job} pal={pal} />

      {/* ── 복장 상의 (직업별) ── */}
      <Torso job={job} pal={pal} />
      {tier >= 1 && <Brooch metal={metal} />}
      {tier >= 2 && <Mantle pal={pal} gold={tier >= 4} />}
      {tier >= 3 && (
        <>
          <ellipse cx="41" cy="86" rx="8" ry="4.6" fill={metal} {...ln} strokeWidth={1.4} />
          <ellipse cx="79" cy="86" rx="8" ry="4.6" fill={metal} {...ln} strokeWidth={1.4} />
        </>
      )}

      {/* ── 팔 (소매) ── */}
      <path d={arms.l} fill="none" stroke={LINE} strokeWidth={wide ? 12.4 : 9.4} strokeLinecap="round" />
      <path d={arms.r} fill="none" stroke={LINE} strokeWidth={wide ? 12.4 : 9.4} strokeLinecap="round" />
      <path d={arms.l} fill="none" stroke={sleeve} strokeWidth={wide ? 9.2 : 6.2} strokeLinecap="round" />
      <path d={arms.r} fill="none" stroke={sleeve} strokeWidth={wide ? 9.2 : 6.2} strokeLinecap="round" />
      <Prop acc={hero.acc} x={arms.rh[0]} y={arms.rh[1]} pal={pal} />
      <circle cx={arms.lh[0]} cy={arms.lh[1]} r="4.6" fill={pal.skin} {...ln} />
      <circle cx={arms.rh[0]} cy={arms.rh[1]} r="4.6" fill={pal.skin} {...ln} />

      {/* ── 머리 ── */}
      <rect x="55" y="76" width="10" height="10" fill={pal.skin} {...ln} />
      <Back job={job} pal={pal} />
      <ellipse cx="60" cy="52" rx="27" ry="25" fill={pal.skin} {...ln} />
      <path d="M36 56 Q38 74 56 77 Q44 72 41 58 Z" fill="#000" opacity=".07" />
      <ellipse cx="42" cy="62" rx="4.6" ry="2.8" fill="#ff8aa0" opacity=".4" />
      <ellipse cx="78" cy="62" rx="4.6" ry="2.8" fill="#ff8aa0" opacity=".4" />
      <Face mood={mood} eye={job === 'rogue' ? '#fffdf5' : '#2a2020'} hair={pal.hair} />
      <Front job={job} pal={pal} />

      {/* ── 최상위 장식 ── */}
      {tier >= 4 && (
        <>
          <path className="spark s1" fill="#ffe9a0" d="M12 44 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" />
          <path className="spark s2" fill="#ffe9a0" d="M104 30 l1.6 4.8 4.8 1.6 -4.8 1.6 -1.6 4.8 -1.6 -4.8 -4.8 -1.6 4.8 -1.6z" />
        </>
      )}
      {tier >= 5 && <ellipse className="halo" cx="60" cy={TOP[job] - 7} rx="18" ry="5.4" fill="none" stroke="#ffd75e" strokeWidth="3.2" />}
    </svg>
  );
}

/* ───────────── 공통 부품 ───────────── */

function Legs({ job, pal }: { job: Job; pal: Pal }) {
  const boot = (x: number, flip = false) => (
    <path d={`M${x - 8} 138 h16 v5 q0 4 -4 4 h-8 q-4 0 -4 -4z`} fill="#4a382f" {...ln}
      transform={flip ? `translate(${2 * x} 0) scale(-1 1)` : undefined} />
  );
  if (job === 'nomad') { // 풍성한 바지
    return (
      <>
        <ellipse cx="52" cy="124" rx="10" ry="13" fill={pal.cream} {...ln} />
        <ellipse cx="68" cy="124" rx="10" ry="13" fill={pal.cream} {...ln} />
        <path d="M43 134 h18 M59 134 h18" stroke={pal.accent} strokeWidth="3.4" strokeLinecap="round" />
        <path d="M44 140 q-2 -4 6 -4 h12 q8 0 8 6 q-2 4 -8 4 h-10 q-8 0 -8 -6z" fill="#8a5a3a" {...ln} transform="translate(-2 0)" />
        <path d="M60 140 q-2 -4 6 -4 h12 q8 0 8 6 q-2 4 -8 4 h-10 q-8 0 -8 -6z" fill="#8a5a3a" {...ln} transform="translate(2 0)" />
      </>
    );
  }
  const pants = job === 'ninja' ? pal.dark : job === 'rogue' ? '#3b3440' : '#2f3442';
  return (
    <>
      <rect x="49" y="110" width="9" height="28" rx="4" fill={pants} {...ln} />
      <rect x="62" y="110" width="9" height="28" rx="4" fill={pants} {...ln} />
      {job === 'ninja' && <path d="M49 122 h9 M62 122 h9 M49 129 h9 M62 129 h9" stroke={pal.accent} strokeWidth="2" />}
      {boot(53.5)}{boot(66.5)}
    </>
  );
}

function Brooch({ metal }: { metal: string }) {
  return (
    <g>
      <circle cx="60" cy="99" r="4.4" fill={metal} {...ln} strokeWidth={1.4} />
      <path d="M60 96.4 l1.1 2.2 2.4 .4 -1.8 1.7 .5 2.4 -2.2 -1.2 -2.2 1.2 .5 -2.4 -1.8 -1.7 2.4 -.4 z" fill="#fff" opacity=".85" />
    </g>
  );
}

function Mantle({ pal, gold }: { pal: Pal; gold: boolean }) {
  return (
    <g>
      <path d="M38 85 Q60 77 82 85 L84 96 Q77 91 72 98 Q66 92 60 99 Q54 92 48 98 Q43 91 36 96 Z"
        fill={pal.dark} {...ln} />
      <path d="M37 94 Q43 90 48 97 Q54 91 60 98 Q66 91 72 97 Q77 90 83 94"
        fill="none" stroke={gold ? GOLD : pal.accent} strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function Prop({ acc, x, y, pal }: { acc: HeroData['acc']; x: number; y: number; pal: Pal }) {
  switch (acc) {
    case 'lens': // 돋보기
      return (
        <g transform={`translate(${x} ${y})`}>
          <line x1="0" y1="0" x2="10" y2="-10" stroke="#8a5a2b" strokeWidth="3.4" strokeLinecap="round" />
          <circle cx="16" cy="-16" r="9" fill="rgba(190,225,255,.4)" stroke={GOLD} strokeWidth="2.8" />
          <path d="M10.6 -19 q2 -3.6 6 -3.8" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
        </g>
      );
    case 'staff': // 지팡이
      return (
        <g transform={`translate(${x} ${y})`}>
          <line x1="0" y1="26" x2="0" y2="-34" stroke="#7a5532" strokeWidth="3.4" strokeLinecap="round" />
          <circle cx="0" cy="-38" r="6" fill={pal.accent} {...ln} strokeWidth={1.4} />
          <path d="M-2.5 -41 q1.6 -2 3.6 -1.6" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity=".8" />
        </g>
      );
    case 'flower': // 장미
      return (
        <g transform={`translate(${x} ${y})`}>
          <line x1="0" y1="0" x2="5" y2="-14" stroke="#4d7a3c" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="6" cy="-17" r="5" fill="#d8344c" {...ln} strokeWidth={1.4} />
          <path d="M3.4 -17 q2.6 -3 5.4 0 M4.4 -15 q2 1.6 4 0" fill="none" stroke="#8c1f30" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      );
    default:
      return null;
  }
}

function Face({ mood, eye, hair }: { mood: Mood; eye: string; hair: string }) {
  const eyes: ReactNode = mood === 'happy'
    ? [49, 71].map(cx => <path key={cx} d={`M${cx - 4.4} 55 Q${cx} 49 ${cx + 4.4} 55`} fill="none" stroke={eye === '#fffdf5' ? eye : LINE} strokeWidth="2.2" strokeLinecap="round" />)
    : mood === 'dizzy'
      ? [49, 71].map(cx => <path key={cx} d={`M${cx - 3.6} 51 l7.2 7.2 M${cx + 3.6} 51 l-7.2 7.2`} stroke={eye === '#fffdf5' ? eye : LINE} strokeWidth="2.2" strokeLinecap="round" />)
      : [49, 71].map(cx => (
        <g key={cx} className="eye">
          <ellipse cx={cx} cy="54" rx="2.6" ry="3.6" fill={eye} />
          <circle cx={cx - 0.8} cy="52.6" r="1" fill={eye === '#2a2020' ? '#fff' : '#2a2020'} />
        </g>
      ));
  const brows: ReactNode = mood === 'dizzy' ? null : (
    <>
      <path d={`M44 ${mood === 'happy' ? 45 : 47} q5 -2.4 9 0`} fill="none" stroke={hair} strokeWidth="1.8" strokeLinecap="round" opacity=".9" />
      <path d={`M67 ${mood === 'happy' ? 45 : 47} q5 -2.4 9 0`} fill="none" stroke={hair} strokeWidth="1.8" strokeLinecap="round" opacity=".9" />
    </>
  );
  const mouth: ReactNode = mood === 'happy'
    ? <path d="M54 62 Q60 71 66 62 Z" fill="#7a2638" stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
    : mood === 'dizzy'
      ? <path d="M54 65 q3 -3 6 0 t6 0" fill="none" stroke={LINE} strokeWidth="1.8" strokeLinecap="round" />
      : <path d="M56.5 63 Q60 66 63.5 63" fill="none" stroke={LINE} strokeWidth="1.8" strokeLinecap="round" />;
  return <g className="face">{eyes}{brows}{mouth}</g>;
}

/* ───────────── 직업별: 상의 ───────────── */

function Torso({ job, pal }: { job: Job; pal: Pal }) {
  switch (job) {
    case 'detective': // 트렌치코트 + 스카프
      return (
        <g>
          <path d="M43 84 Q60 77 77 84 L84 124 Q60 131 36 124 Z" fill={pal.main} {...ln} />
          <path d="M52 83 L60 104 L68 83 Z" fill={pal.cream} {...ln} strokeWidth={1.3} />
          <path d="M51 82 L42 94 L55 102 Z M69 82 L78 94 L65 102 Z" fill={pal.dark} {...ln} strokeWidth={1.3} />
          <path d="M44 108 Q60 114 76 108" fill="none" stroke={pal.dark} strokeWidth="4" />
          <rect x="56.5" y="106.5" width="7" height="6" rx="1.5" fill={GOLD} {...ln} strokeWidth={1.2} />
          <circle cx="60" cy="118" r="1.6" fill={pal.dark} />
          <path d="M50 81 Q60 90 70 81 L69 88 Q60 94 51 88 Z" fill={pal.accent} {...ln} strokeWidth={1.3} />
          <path d="M65 88 l9 15 l-6 1 -5 -9z" fill={pal.accent} {...ln} strokeWidth={1.3} />
        </g>
      );
    case 'mage': // 긴 로브
      return (
        <g>
          <path d="M45 84 Q60 77 75 84 L90 134 Q60 142 30 134 Z" fill={pal.main} {...ln} />
          <path d="M60 92 L60 138" stroke={pal.dark} strokeWidth="2" />
          <path d="M31 131 Q60 139 89 131" fill="none" stroke={pal.accent} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M46 105 Q60 111 74 105" fill="none" stroke={pal.accent} strokeWidth="4" strokeLinecap="round" />
          <path d="M47 83 Q60 96 73 83 L75 77 Q60 86 45 77 Z" fill={pal.dark} {...ln} strokeWidth={1.3} />
          <circle cx="60" cy="93" r="2.6" fill={GOLD} {...ln} strokeWidth={1.1} />
        </g>
      );
    case 'ninja': // 감싸 입은 도복 + 어깨끈
      return (
        <g>
          <path d="M45 84 Q60 79 75 84 L78 113 Q60 119 42 113 Z" fill={pal.dark} {...ln} />
          <path d="M46 86 L74 110 L70 114 L44 92 Z" fill={pal.accent} {...ln} strokeWidth={1.2} />
          <path d="M43 106 Q60 112 77 106 L77 112 Q60 118 43 112 Z" fill={pal.accent} {...ln} strokeWidth={1.3} />
          <path d="M38 84 Q60 94 82 84 L84 92 Q60 102 36 92 Z" fill={pal.dark} {...ln} strokeWidth={1.3} />
        </g>
      );
    case 'cleric': // 흰 로브 + 영대
      return (
        <g>
          <path d="M45 84 Q60 77 75 84 L86 134 Q60 141 34 134 Z" fill={pal.cream} {...ln} />
          <path d="M55 84 h10 v52 h-10 z" fill={pal.accent} {...ln} strokeWidth={1.3} />
          <path d="M57 90 h6 M57 100 h6 M57 110 h6 M57 120 h6" stroke={GOLD} strokeWidth="1.6" />
          <path d="M46 105 Q60 110 74 105 L74 110 Q60 115 46 110 Z" fill={pal.main} {...ln} strokeWidth={1.3} />
          <path d="M35 131 Q60 138 85 131" fill="none" stroke={pal.main} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 'nomad': // 조끼 + 허리 띠
      return (
        <g>
          <path d="M45 84 Q60 78 75 84 L78 110 Q60 115 42 110 Z" fill={pal.cream} {...ln} />
          <path d="M45 84 L52 84 L53 112 L42 110 Z M75 84 L68 84 L67 112 L78 110 Z" fill={pal.main} {...ln} strokeWidth={1.3} />
          <path d="M42 106 Q60 113 78 106 L79 113 Q60 120 41 113 Z" fill={pal.accent} {...ln} strokeWidth={1.3} />
          <path d="M70 112 l4 14 l-5 -2 -3 -10z" fill={pal.accent} {...ln} strokeWidth={1.2} />
        </g>
      );
    default: // rogue — 짧은 재킷 + 스카프
      return (
        <g>
          <path d="M45 84 Q60 79 75 84 L78 109 Q60 114 42 109 Z" fill={pal.main} {...ln} />
          <path d="M60 86 V110" stroke={pal.dark} strokeWidth="2" />
          <path d="M43 104 Q60 110 77 104" fill="none" stroke={pal.dark} strokeWidth="4" />
          <path d="M46 83 Q60 92 74 83 L74 90 Q60 99 46 90 Z" fill={pal.accent} {...ln} strokeWidth={1.3} />
          <path d="M52 92 l-6 14 l6 -2 z" fill={pal.accent} {...ln} strokeWidth={1.3} />
          <path d="M42 108 h36 v3 h-36z" fill="#3b3440" />
        </g>
      );
  }
}

/* ───────────── 직업별: 머리 뒤쪽 (얼굴보다 먼저) ───────────── */

function Back({ job, pal }: { job: Job; pal: Pal }) {
  const hair = { fill: pal.hair, ...ln };
  switch (job) {
    case 'mage':
      return (
        <>
          <path {...hair} d="M34 46 Q24 74 32 98 Q42 86 40 62 Z" />
          <path {...hair} d="M86 46 Q96 74 88 98 Q78 86 80 62 Z" />
        </>
      );
    case 'cleric': // 베일
      return (
        <path d="M27 58 Q22 12 60 10 Q98 12 93 58 L99 100 Q89 104 85 88 L85 60 Q83 34 60 33 Q37 34 35 60 L35 88 Q31 104 21 100 Z"
          fill="#f6f2e8" {...ln} />
      );
    case 'ninja':
      return <path d="M30 56 Q24 14 60 12 Q96 14 90 56 Q92 70 84 80 L36 80 Q28 70 30 56 Z" fill={pal.dark} {...ln} />;
    case 'rogue': // 포니테일
      return <path {...hair} d="M82 34 Q112 34 108 68 Q106 86 94 92 Q99 74 90 56 Z" />;
    case 'nomad':
      return <path {...hair} d="M33 48 Q27 64 34 76 Q39 66 38 54 Z" />;
    default:
      return <path {...hair} d="M34 50 Q30 62 36 72 Q39 62 38 52 Z" />;
  }
}

/* ───────────── 직업별: 머리 앞쪽 (모자 · 두건 · 가면) ───────────── */

function Front({ job, pal }: { job: Job; pal: Pal }) {
  const hair = { fill: pal.hair, ...ln };
  switch (job) {
    case 'detective': {
      const hat = pal.hat;
      return (
        <g>
          <path {...hair} d="M35 40 Q44 50 41 62 Q34 52 35 40 Z" />
          <path {...hair} d="M46 38 Q62 46 82 38 L80 47 Q64 44 49 49 Z" />
          <path d="M37 36 Q36 8 60 7 Q84 8 83 36 Z" fill={hat} {...ln} />
          <path d="M37 28 Q60 34 83 28 L83 35 Q60 41 37 35 Z" fill={pal.accent} {...ln} strokeWidth={1.3} />
          <ellipse cx="60" cy="37" rx="42" ry="7" fill={hat} {...ln} transform="rotate(-5 60 37)" />
          <path d="M26 38 Q60 31 94 36" fill="none" stroke="#fff" strokeWidth="1.4" opacity=".25" />
        </g>
      );
    }
    case 'mage': {
      const hat = pal.dark;
      return (
        <g>
          <path {...hair} d="M38 40 Q60 48 82 40 L80 48 Q60 44 40 48 Z" />
          <path d="M39 34 Q42 14 54 6 Q68 -6 86 2 Q72 4 71 18 Q78 28 81 34 Z" fill={hat} {...ln} />
          <ellipse cx="60" cy="35" rx="40" ry="8" fill={hat} {...ln} />
          <path d="M40 31 Q60 38 80 31 L81 36 Q60 43 39 36 Z" fill={pal.accent} {...ln} strokeWidth={1.3} />
          <path d="M60 18 l1.8 4.2 4.4 .5 -3.3 3 1 4.4 -3.9 -2.3 -3.9 2.3 1 -4.4 -3.3 -3 4.4 -.5 z" fill={GOLD} />
        </g>
      );
    }
    case 'ninja':
      return (
        <g>
          {/* 이마를 덮는 후드 끝선 + 머리띠 */}
          <path d="M31 52 Q30 22 60 20 Q90 22 89 52 Q84 40 60 38 Q36 40 31 52 Z" fill={pal.dark} {...ln} />
          <path d="M33 44 Q60 36 87 44 L87 50 Q60 42 33 50 Z" fill={pal.accent} {...ln} strokeWidth={1.3} />
          <rect x="50" y="38.5" width="20" height="8" rx="2" fill={SILVER} {...ln} strokeWidth={1.3} />
          <path d="M55 41 l10 0 M55 44 l10 0" stroke={LINE} strokeWidth="1" opacity=".6" />
          {/* 복면 */}
          <path d="M34 61 Q60 58 86 61 Q85 78 60 80 Q35 78 34 61 Z" fill={pal.dark} {...ln} />
          <path d="M82 52 Q106 48 114 62 Q104 58 96 64 Q108 68 110 80 Q94 74 84 64 Z" fill={pal.accent} {...ln} strokeWidth={1.3} />
        </g>
      );
    case 'cleric':
      return (
        <g>
          <path {...hair} d="M36 44 Q60 30 84 44 Q80 38 60 36 Q40 38 36 44 Z" />
          <path d="M35 38 Q60 24 85 38" fill="none" stroke={GOLD} strokeWidth="3.4" strokeLinecap="round" />
          <circle cx="60" cy="29.4" r="3.2" fill={pal.accent} {...ln} strokeWidth={1.2} />
          <path d="M33 36 Q16 22 6 30 Q17 30 14 36 Q24 36 27 43 Z" fill="#fbfaf6" {...ln} strokeWidth={1.3} />
          <path d="M87 36 Q104 22 114 30 Q103 30 106 36 Q96 36 93 43 Z" fill="#fbfaf6" {...ln} strokeWidth={1.3} />
        </g>
      );
    case 'nomad':
      return (
        <g>
          {/* 얼굴 가리개 */}
          <path d="M34 58 Q60 52 86 58 Q85 77 60 79 Q35 77 34 58 Z" fill="#e9dcc4" {...ln} />
          <path d="M40 66 Q60 72 80 66" fill="none" stroke={LINE} strokeWidth="1" opacity=".35" />
          {/* 터번 */}
          <ellipse cx="60" cy="25" rx="35" ry="22" fill={pal.cream} {...ln} />
          <path d="M31 28 Q60 12 89 28 M36 18 Q60 4 84 18 M33 36 Q60 24 87 36" fill="none" stroke={LINE} strokeWidth="1.2" opacity=".45" />
          <path d="M28 38 Q60 50 92 38 L92 33 Q60 45 28 33 Z" fill={pal.accent} {...ln} strokeWidth={1.3} />
          <circle cx="60" cy="38" r="4" fill={GOLD} {...ln} strokeWidth={1.2} />
          <path d="M64 8 Q76 -8 84 -6 Q80 8 66 14 Z" fill={pal.accent} {...ln} strokeWidth={1.3} />
        </g>
      );
    default: // rogue — 두건 + 눈가리개
      return (
        <g>
          <path {...hair} d="M33 48 Q40 56 36 66 Q31 58 33 48 Z" />
          <path d="M31 46 Q31 18 60 17 Q89 18 89 46 Q60 36 31 46 Z" fill={pal.accent} {...ln} />
          <path d="M35 38 Q60 28 85 38 M33 43 Q60 33 87 43" fill="none" stroke="#ffd24a" strokeWidth="3" strokeLinecap="round" />
          <path d="M86 36 L108 32 L101 44 Z M86 38 L106 48 L97 50 Z" fill={pal.accent} {...ln} strokeWidth={1.3} />
          <circle cx="87" cy="38" r="3.2" fill={pal.accent} {...ln} strokeWidth={1.3} />
          <path d="M35 49 Q60 43 85 49 L83 59 Q60 54 37 59 Z" fill="#1b1a22" {...ln} strokeWidth={1.3} />
          {/* 가면 위로 다시 그리는 눈 */}
          <ellipse cx="49" cy="54" rx="2.8" ry="3.2" fill="#fffdf5" />
          <ellipse cx="71" cy="54" rx="2.8" ry="3.2" fill="#fffdf5" />
        </g>
      );
  }
}

/** 안내 로봇 '렌즈' — 떠 있는 눈 로봇 */
export function Npc() {
  return (
    <svg className="chara npc" viewBox="0 0 120 150" data-mood="idle" aria-hidden="true">
      <ellipse className="thruster" cx="60" cy="140" rx="16" ry="4" fill="rgba(94,230,197,.45)" />
      <line x1="60" y1="22" x2="60" y2="8" stroke={LINE} strokeWidth="5" strokeLinecap="round" />
      <line x1="60" y1="22" x2="60" y2="8" stroke="#9aa6ba" strokeWidth="2" strokeLinecap="round" />
      <circle className="antenna" cx="60" cy="7" r="5" fill="#5EE6C5" stroke={LINE} strokeWidth="2" />
      <path d="M30 96 Q16 100 18 116" fill="none" stroke={LINE} strokeWidth="10" strokeLinecap="round" />
      <path d="M30 96 Q16 100 18 116" fill="none" stroke="#9aa6ba" strokeWidth="6.5" strokeLinecap="round" />
      <path d="M90 96 Q104 100 102 116" fill="none" stroke={LINE} strokeWidth="10" strokeLinecap="round" />
      <path d="M90 96 Q104 100 102 116" fill="none" stroke="#9aa6ba" strokeWidth="6.5" strokeLinecap="round" />
      <path d="M40 100 Q60 94 80 100 L76 128 Q60 134 44 128 Z" fill="#b8c2d3" stroke={LINE} strokeWidth="2" strokeLinejoin="round" />
      <rect x="52" y="106" width="16" height="6" rx="3" fill="#0e1116" stroke={LINE} strokeWidth="1.5" />
      <circle cx="56" cy="109" r="1.6" fill="#5EE6C5" /><circle cx="64" cy="109" r="1.6" fill="#ff8aa0" />
      <circle cx="60" cy="62" r="40" fill="#dfe6f2" stroke={LINE} strokeWidth="2.4" />
      <path d="M26 54 Q34 28 60 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".55" />
      <circle cx="60" cy="64" r="27" fill="#0e1116" stroke="#5EE6C5" strokeWidth="3" />
      <g className="scan">
        <circle cx="60" cy="64" r="14" fill="#5EE6C5" />
        <circle cx="60" cy="64" r="8" fill="#0b2a22" />
        <circle cx="55" cy="58" r="4" fill="#fff" opacity=".9" />
      </g>
    </svg>
  );
}
