// 캐릭터 '감별사' — 인라인 SVG 일러스트. 이미지 파일 없이 코드로 그린다 (게임 오브젝트와 같은 원칙).
//
// 설계: 큰 머리 + 아주 작은 얼굴, 대신 모자·두건·후드·망토 같은 '복장의 실루엣'으로 개성을 낸다.
//  · 복장(job) 7종 — 세계관(이상 감별국)에 맞춘 수습 제복 · 현장 수사관 · 공장 기술자 · 위장 수사관 · 도서관 감식관 · 야시장 정보원 · 수석 정복.
//    구역(이야기)마다 한 벌씩 대응하고, 모자와 상의 모양이 완전히 다르다.
//  · 색은 머리색 · 피부 · 옷색(포인트 색은 옷색의 보색에서 자동 계산)으로 고른다.
//  · 등급(tier 0~5)이 오르면 복장 종류와 상관없이 같은 방식으로 한 겹씩 얹힌다.
//      0 기본 복장 → 1 브로치 → 2 어깨 망토 → 3 뒷망토+견장 → 4 금장+오라 → 5 날개+후광
// 표정·진화 연출은 data-mood / .evolve 와 theme.css 가 맡는다. viewBox 120×150, 발끝이 y≈146.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Hero as HeroData, Job } from '../engine/save';
import type { Mood } from '../engine/game';
import { HAIR_COLORS, OUTFIT_HUES, SKINS, normalizeHero } from '../engine/heroData';
import { hero3dEnabled } from '../hero3d/support';
import type { HeroView } from '../hero3d';

const LINE = '#3a2c2c'; // 따뜻한 갈색 윤곽선 — 순검정보다 손그림 느낌이 난다
const GOLD = '#f2c14e';
const SILVER = '#cfd6e4';
const BRONZE = '#c27a2c';
// 직업별 머리 장식의 맨 위 y좌표 (후광을 그 위에 띄우기 위해)
const TOP: Record<Job, number> = { rookie: 11, field: 6, engineer: 6, disguise: 4, archivist: 4, street: 18, chief: 9 };

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

/**
 * 캐릭터 — 3D가 기본이고, WebGL을 못 쓰거나 설정에서 끄면 2D(SVG)로 그린다.
 * 3D는 three.js를 처음 필요할 때 내려받으므로(코드 분할), 불러오는 동안에도 2D가 먼저 보인다.
 */
export function Hero(props: Props) {
  return hero3dEnabled() ? <Hero3D {...props} /> : <HeroSvg {...props} />;
}

function Hero3D(props: Props) {
  const { hero, tier = 0, mood = 'idle' } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<HeroView | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let dead = false;
    let view: HeroView | null = null;
    import('../hero3d').then(m => {
      if (dead || !canvasRef.current) return;
      view = m.createHeroView(canvasRef.current);
      viewRef.current = view;
      const p = latest.current;
      view.update(normalizeHero(p.hero), p.tier ?? 0, p.mood ?? 'idle', !!p.evolve); // 진화 연출은 만들어질 때 한 번
      setReady(true);
    }).catch(() => { if (!dead) setFailed(true); }); // 불러오기 실패 → 2D로 계속
    return () => { dead = true; view?.dispose(); viewRef.current = null; };
  }, []);

  const hk = JSON.stringify([hero.job, hero.hairColor, hero.skin, hero.outfit, hero.acc]);
  useEffect(() => {
    viewRef.current?.update(normalizeHero(latest.current.hero), tier, mood, false);
  }, [hk, tier, mood]);

  return (
    <div className="chara3dWrap" data-mood={mood} data-tier={tier} data-job={hero.job}>
      {(!ready || failed) && <HeroSvg {...props} />}
      {!failed && <canvas ref={canvasRef} className={'chara3d' + (ready ? ' ready' : '')} aria-hidden="true" />}
    </div>
  );
}

export function HeroSvg({ hero: raw, tier = 0, mood = 'idle', evolve = false }: Props) {
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
  const wide = false; // 넓은 소매 (현재 복장에는 없다)

  // 팔 · 손: 기쁨 = 만세, 어지러움 = 벌린 팔, 기본 = 내림
  const arms = mood === 'happy'
    ? { l: 'M45 88 Q33 84 31 68', r: 'M75 88 Q87 84 89 68', lh: [31, 65], rh: [89, 65] }
    : mood === 'dizzy'
      ? { l: 'M45 88 Q33 96 31 106', r: 'M75 88 Q87 96 89 106', lh: [31, 109], rh: [89, 109] }
      : { l: 'M45 88 Q37 98 40 108', r: 'M75 88 Q83 98 80 108', lh: [40, 111], rh: [80, 111] };
  const sleeve = ({ rookie: pal.main, field: pal.main, engineer: pal.main, disguise: pal.dark, archivist: '#f4f1ea', street: pal.accent, chief: '#fbfaf6' } as Record<Job, string>)[job];

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
      <Face mood={mood} eye="#2a2020" hair={pal.hair} />
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

function Legs({ job, pal }: { job: Job; pal: Pal }) {
  const pants: Record<Job, string> = {
    rookie: '#2b3140', field: '#2f3442', engineer: pal.main, disguise: '#1d1f27', archivist: '#3a3f4f', street: '#3d4f78', chief: '#f4f1ea',
  };
  const boots: Record<Job, string> = {
    rookie: '#3b2f2a', field: '#4a382f', engineer: '#5a4a36', disguise: '#15161c', archivist: '#4a382f', street: '#f4f1ea', chief: '#15161c',
  };
  const boot = (x: number) => (
    <path d={`M${x - 8} 138 h16 v5 q0 4 -4 4 h-8 q-4 0 -4 -4z`} fill={boots[job]} {...ln} />
  );
  return (
    <>
      <rect x="49" y="110" width="9" height="28" rx="4" fill={pants[job]} {...ln} />
      <rect x="62" y="110" width="9" height="28" rx="4" fill={pants[job]} {...ln} />
      {job === 'engineer' && <path d="M49 126 h9 M62 126 h9" stroke="#ffe27a" strokeWidth="2.6" />}
      {job === 'street' && <path d="M49 140 h9 M62 140 h9" stroke={pal.accent} strokeWidth="2.4" />}
      {job === 'chief' && <path d="M53.5 112 V136 M66.5 112 V136" stroke={GOLD} strokeWidth="1.6" />}
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
    case 'lens': // 감별 돋보기
      return (
        <g transform={`translate(${x} ${y})`}>
          <line x1="0" y1="0" x2="10" y2="-10" stroke="#8a5a2b" strokeWidth="3.4" strokeLinecap="round" />
          <circle cx="16" cy="-16" r="9" fill="rgba(190,225,255,.4)" stroke={GOLD} strokeWidth="2.8" />
          <path d="M10.6 -19 q2 -3.6 6 -3.8" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
        </g>
      );
    case 'torch': // 손전등 — 빛줄기가 위로 뻗는다
      return (
        <g transform={`translate(${x} ${y})`}>
          <path d="M-5 -22 L-15 -44 L15 -44 L5 -22 Z" fill="rgba(255,240,170,.32)" />
          <rect x="-3" y="-14" width="6" height="18" rx="2.4" fill="#3a3f4f" {...ln} strokeWidth={1.4} />
          <path d="M-5 -14 h10 l3 -7 h-16 z" fill={SILVER} {...ln} strokeWidth={1.4} />
          <circle cx="0" cy="-20" r="3" fill="#fff6bf" />
        </g>
      );
    case 'notebook': // 수사 수첩
      return (
        <g transform={`translate(${x} ${y})`}>
          <rect x="-7" y="-16" width="14" height="18" rx="1.8" fill={pal.accent} {...ln} strokeWidth={1.4} />
          <path d="M-3.5 -11 h7 M-3.5 -7 h7 M-3.5 -3 h4" stroke={pal.cream} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M5 -17 l3 -5" stroke="#8a5a2b" strokeWidth="2" strokeLinecap="round" />
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

/* ───────────── 복장별: 상의 ───────────── */

function Torso({ job, pal }: { job: Job; pal: Pal }) {
  switch (job) {
    case 'field': // 현장 수사관 — 트렌치코트 + 스카프
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
    case 'engineer': // 공장 기술자 — 작업복 + 반사띠 + 공구 벨트
      return (
        <g>
          <path d="M44 85 Q60 80 76 85 L80 120 Q60 125 40 120 Z" fill={pal.main} {...ln} />
          <path d="M60 86 V120" stroke={pal.dark} strokeWidth="1.8" />
          <rect x="47" y="93" width="10" height="9" rx="1.4" fill={pal.dark} opacity=".55" />
          <path d="M42 105 H78 M41.5 111 H78.5" stroke="#ffe27a" strokeWidth="3.4" />
          <rect x="40" y="116" width="40" height="6" rx="1.6" fill="#5a4a36" {...ln} strokeWidth={1.3} />
          <rect x="45" y="118" width="7" height="9" rx="1.4" fill="#7a6246" {...ln} strokeWidth={1.2} />
          <path d="M70 118 l5 10" stroke={SILVER} strokeWidth="2.6" strokeLinecap="round" />
        </g>
      );
    case 'disguise': // 위장 수사관 — 턱시도 + 나비넥타이
      return (
        <g>
          <path d="M44 85 Q60 80 76 85 L79 118 Q60 122 41 118 Z" fill={pal.dark} {...ln} />
          <path d="M53 84 L60 106 L67 84 Z" fill={pal.cream} {...ln} strokeWidth={1.3} />
          <path d="M52 84 L45 98 L58 104 Z M68 84 L75 98 L62 104 Z" fill={pal.main} {...ln} strokeWidth={1.3} />
          <path d="M60 88 l-8 -4.5 v9 z M60 88 l8 -4.5 v9 z" fill={pal.accent} {...ln} strokeWidth={1.3} />
          <circle cx="60" cy="88" r="2.2" fill={pal.accent} {...ln} strokeWidth={1.2} />
          <path d="M44 110 Q60 116 76 110" fill="none" stroke={pal.accent} strokeWidth="3.4" />
        </g>
      );
    case 'archivist': // 도서관 감식관 — 흰 가운
      return (
        <g>
          <path d="M43 85 Q60 79 77 85 L83 128 Q60 134 37 128 Z" fill="#f4f1ea" {...ln} />
          <path d="M54 84 L60 100 L66 84 Z" fill={pal.main} {...ln} strokeWidth={1.3} />
          <path d="M52 83 L46 96 L58 104 Z M68 83 L74 96 L62 104 Z" fill="#e3ddcc" {...ln} strokeWidth={1.3} />
          <rect x="43" y="108" width="12" height="10" rx="1.6" fill="#e9e3d2" {...ln} strokeWidth={1.3} />
          <rect x="65" y="108" width="12" height="10" rx="1.6" fill="#e9e3d2" {...ln} strokeWidth={1.3} />
          <path d="M49 105 v7" stroke={pal.accent} strokeWidth="2" strokeLinecap="round" />
          <rect x="49" y="93" width="8" height="5" rx="1" fill={pal.accent} {...ln} strokeWidth={1.1} />
        </g>
      );
    case 'street': // 야시장 정보원 — 네온 후드 집업
      return (
        <g>
          <path d="M44 85 Q60 80 76 85 L79 119 Q60 123 41 119 Z" fill={pal.accent} {...ln} />
          <path d="M42 84 Q60 99 78 84 L76 93 Q60 106 44 93 Z" fill={pal.main} {...ln} strokeWidth={1.4} />
          <path d="M56 95 v12 M64 95 v12" stroke={pal.cream} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M47 109 H73 L71 119 H49 Z" fill={pal.dark} opacity=".6" />
          <path d="M60 99 V119" stroke={pal.dark} strokeWidth="1.5" />
        </g>
      );
    case 'chief': // 수석 정복 — 흰 제복 + 금단추 + 어깨띠
      return (
        <g>
          <path d="M43 85 Q60 79 77 85 L80 124 Q60 130 40 124 Z" fill="#fbfaf6" {...ln} />
          <path d="M52 83 L60 95 L68 83 L66 80 H54 Z" fill={pal.dark} {...ln} strokeWidth={1.3} />
          <path d="M44 88 L76 113 L72.5 118 L42 94 Z" fill={pal.main} {...ln} strokeWidth={1.3} />
          {[96, 104, 112, 120].map(y => <g key={y}><circle cx="54" cy={y} r="1.7" fill={GOLD} /><circle cx="66" cy={y} r="1.7" fill={GOLD} /></g>)}
          <rect x="46" y="92" width="3" height="5" fill={pal.accent} /><circle cx="47.5" cy="99" r="2.2" fill={GOLD} {...ln} strokeWidth={1} />
        </g>
      );
    default: // rookie — 감별국 제복
      return (
        <g>
          <path d="M44 86 Q60 80 76 86 L79 119 Q60 123 41 119 Z" fill={pal.main} {...ln} />
          <path d="M54 84 L60 99 L66 84 Z" fill={pal.cream} {...ln} strokeWidth={1.3} />
          <path d="M51 83 L45 94 L57 100 Z M69 83 L75 94 L63 100 Z" fill={pal.dark} {...ln} strokeWidth={1.3} />
          <path d="M60 90 l-3 4 l3 12 l3 -12 z" fill={pal.accent} {...ln} strokeWidth={1.2} />
          {[108, 114].map(y => <g key={y}><circle cx="52" cy={y} r="1.7" fill={GOLD} /><circle cx="68" cy={y} r="1.7" fill={GOLD} /></g>)}
        </g>
      );
  }
}

/* ───────────── 복장별: 머리 뒤쪽 (얼굴보다 먼저) ───────────── */

function Back({ job, pal }: { job: Job; pal: Pal }) {
  const hair = { fill: pal.hair, ...ln };
  switch (job) {
    case 'disguise': // 망토
      return <path d="M40 86 Q14 116 19 147 Q60 155 101 147 Q106 116 80 86 Z" fill={pal.accent} {...ln} opacity=".95" />;
    case 'engineer':
    case 'street':
    case 'chief':
      return <path {...hair} d="M34 50 Q31 60 36 68 Q39 60 38 52 Z" />;
    default: // rookie · field · archivist — 옆머리
      return <path {...hair} d="M34 50 Q30 62 36 72 Q39 62 38 52 Z" />;
  }
}

/* ───────────── 복장별: 머리 앞쪽 (모자 · 안경 · 가면) ───────────── */

function Front({ job, pal }: { job: Job; pal: Pal }) {
  const hair = { fill: pal.hair, ...ln };
  const fringe = <path {...hair} d="M35 40 Q44 50 41 62 Q34 52 35 40 Z M46 38 Q62 46 82 38 L80 47 Q64 44 49 49 Z" />;
  switch (job) {
    case 'field': // 중절모
      return (
        <g>
          {fringe}
          <path d="M37 36 Q36 8 60 7 Q84 8 83 36 Z" fill={pal.hat} {...ln} />
          <path d="M37 28 Q60 34 83 28 L83 35 Q60 41 37 35 Z" fill={pal.accent} {...ln} strokeWidth={1.3} />
          <ellipse cx="60" cy="37" rx="42" ry="7" fill={pal.hat} {...ln} transform="rotate(-5 60 37)" />
          <path d="M26 38 Q60 31 94 36" fill="none" stroke="#fff" strokeWidth="1.4" opacity=".25" />
        </g>
      );
    case 'engineer': // 안전모 + 헤드랜턴 + 고글
      return (
        <g>
          <path d="M32 40 Q32 10 60 10 Q88 10 88 40 Z" fill="#f2c744" {...ln} />
          <path d="M52 10 Q60 6 68 10 L68 38 H52 Z" fill="#e6b52f" {...ln} strokeWidth={1.3} />
          <path d="M27 40 H93 Q93 47 60 47 Q27 47 27 40 Z" fill="#e6b52f" {...ln} />
          <rect x="53" y="20" width="14" height="10" rx="2.4" fill={SILVER} {...ln} strokeWidth={1.3} />
          <circle cx="60" cy="25" r="3.4" fill="#fff6bf" />
          <path d="M34 36 H86" stroke={pal.dark} strokeWidth="3" />
          <circle cx="47" cy="36.5" r="6" fill="rgba(190,225,255,.55)" {...ln} strokeWidth={1.5} />
          <circle cx="73" cy="36.5" r="6" fill="rgba(190,225,255,.55)" {...ln} strokeWidth={1.5} />
        </g>
      );
    case 'disguise': // 실크햇 + 반가면
      return (
        <g>
          <path {...hair} d="M35 42 Q42 50 40 60 Q34 52 35 42 Z" />
          <path d="M33 49 Q47 44 60 50 Q73 44 87 49 Q86 62 72 62 Q64 62 60 56 Q56 62 48 62 Q34 62 33 49 Z" fill={pal.accent} {...ln} />
          <ellipse cx="49" cy="55" rx="3.2" ry="3.6" fill="#fffdf5" /><ellipse cx="71" cy="55" rx="3.2" ry="3.6" fill="#fffdf5" />
          <circle cx="49.4" cy="55.4" r="1.5" fill="#2a2020" /><circle cx="71.4" cy="55.4" r="1.5" fill="#2a2020" />
          <path d="M41 38 L43 4 H77 L79 38 Z" fill={pal.dark} {...ln} />
          <path d="M42 28 H78 V34 H42 Z" fill={pal.accent} {...ln} strokeWidth={1.3} />
          <ellipse cx="60" cy="38" rx="32" ry="6.5" fill={pal.dark} {...ln} />
        </g>
      );
    case 'archivist': // 올림머리 + 동그란 안경
      return (
        <g>
          {fringe}
          <circle cx="60" cy="15" r="11" fill={pal.hair} {...ln} />
          <path d="M52 21 Q60 25 68 21" fill="none" stroke={pal.accent} strokeWidth="2.6" strokeLinecap="round" />
          <g fill="rgba(210,235,255,.24)" stroke="#3a3f4f" strokeWidth="2.4">
            <circle cx="49" cy="55" r="9.5" /><circle cx="71" cy="55" r="9.5" />
            <path d="M58.5 54 Q60 51.8 61.5 54" fill="none" /><path d="M39.5 54 L33 52 M80.5 54 L87 52" fill="none" />
          </g>
          <path d="M42 50 q3 -3 7 -3" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case 'street': // 헤드폰
      return (
        <g>
          <path {...hair} d="M36 38 Q46 30 60 31 Q76 30 84 38 Q80 46 74 44 Q62 38 48 44 Q40 46 36 38 Z" />
          <path d="M31 52 Q31 18 60 18 Q89 18 89 52" fill="none" stroke="#2b3140" strokeWidth="5.5" strokeLinecap="round" />
          <path d="M31 52 Q31 18 60 18 Q89 18 89 52" fill="none" stroke={pal.accent} strokeWidth="1.6" strokeLinecap="round" />
          <ellipse cx="30" cy="57" rx="6.5" ry="10" fill={pal.accent} {...ln} />
          <ellipse cx="90" cy="57" rx="6.5" ry="10" fill={pal.accent} {...ln} />
          <ellipse cx="30" cy="57" rx="3" ry="6" fill="#2b3140" /><ellipse cx="90" cy="57" rx="3" ry="6" fill="#2b3140" />
        </g>
      );
    case 'chief': // 군모
      return (
        <g>
          <path {...hair} d="M35 42 Q42 50 40 60 Q34 52 35 42 Z" />
          <path d="M33 38 Q34 11 60 10 Q86 11 87 38 Q60 31 33 38 Z" fill="#fbfaf6" {...ln} />
          <path d="M33 33 Q60 27 87 33 L87 40 Q60 34 33 40 Z" fill={pal.dark} {...ln} strokeWidth={1.3} />
          <path d="M35 42 Q60 35 85 42 Q82 52 60 50 Q38 52 35 42 Z" fill="#1b1a22" {...ln} />
          <path d="M38 44 Q60 38 82 44" fill="none" stroke={GOLD} strokeWidth="1.8" />
          <circle cx="60" cy="27" r="5.4" fill={GOLD} {...ln} strokeWidth={1.3} />
          <path d="M60 23.6 l1.2 2.5 2.7 .4 -2 1.9 .5 2.7 -2.4 -1.3 -2.4 1.3 .5 -2.7 -2 -1.9 2.7 -.4 z" fill="#fff" opacity=".9" />
        </g>
      );
    default: // rookie — 감별국 제모
      return (
        <g>
          {fringe}
          <path d="M34 38 Q36 13 60 12 Q84 13 86 38 Q60 31 34 38 Z" fill={pal.main} {...ln} />
          <path d="M34 38 Q60 31 86 38 Q88 47 60 45 Q32 47 34 38 Z" fill={pal.dark} {...ln} />
          <path d="M36 33 Q60 26 84 33" fill="none" stroke={pal.accent} strokeWidth="3" />
          <circle cx="60" cy="25" r="4.6" fill={GOLD} {...ln} strokeWidth={1.3} />
          <path d="M60 22 l1.1 2.2 2.4 .4 -1.8 1.7 .5 2.4 -2.2 -1.2 -2.2 1.2 .5 -2.4 -1.8 -1.7 2.4 -.4 z" fill="#fff" opacity=".9" />
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
