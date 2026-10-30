// 게임판 칸의 물건 — 이상 감별국이 단속하는 '복제품' 8종.
// 한 단계의 모든 칸은 같은 물건이고, 그중 하나만 어딘가 다르다.
//
// 그림은 SVG 경로 문자열로만 정의한다. 같은 데이터를 React(<svg>)와 결과 카드(Canvas Path2D)가
// 함께 쓰므로, 물건을 추가·수정할 때 이 파일 한 곳만 고치면 된다.
// 규칙: 좌우·상하가 완전히 대칭인 물건은 넣지 않는다 (대칭이면 '회전' 차이가 안 보이는 판이 생긴다).

export type Tone = 'base' | 'dark' | 'light' | 'ink';
export interface Layer { d: string; tone: Tone; eo?: boolean }
export interface ObjectArt { name: string; layers: Layer[] }

const f = (n: number) => +n.toFixed(2);
const circle = (cx: number, cy: number, r: number) =>
  `M${f(cx - r)} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${f(cx - rx)} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`;
const rect = (x: number, y: number, w: number, h: number, r = 0) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;

export const OBJECTS: ObjectArt[] = [
  { // 버섯
    name: '버섯',
    layers: [
      { tone: 'light', d: rect(37, 48, 26, 40, 9) },
      { tone: 'dark', d: 'M12 52H88Q88 60 78 60H22Q12 60 12 52Z' },
      { tone: 'base', d: 'M12 52Q12 12 50 12Q88 12 88 52Z' },
      { tone: 'light', d: circle(33, 33, 6.5) },
      { tone: 'light', d: circle(58, 27, 7.5) },
      { tone: 'light', d: circle(72, 43, 5) },
    ],
  },
  { // 열쇠
    name: '열쇠',
    layers: [
      { tone: 'dark', d: rect(56, 66, 16, 9, 3) },
      { tone: 'dark', d: rect(56, 79, 11, 9, 3) },
      { tone: 'base', d: rect(44, 36, 12, 54, 4) },
      { tone: 'base', eo: true, d: circle(50, 24, 19) + circle(50, 24, 8) },
    ],
  },
  { // 찻주전자
    name: '주전자',
    layers: [
      { tone: 'dark', d: 'M20 50Q3 50 5 67Q8 80 25 77L25 70Q14 70 14 64Q14 56 25 56Z' },
      { tone: 'base', d: 'M74 56Q95 52 93 32L84 37Q86 47 73 47Z' },
      { tone: 'base', d: ellipse(48, 62, 30, 24) },
      { tone: 'dark', d: ellipse(48, 40, 17, 6) },
      { tone: 'light', d: circle(48, 33, 4.5) },
      { tone: 'light', d: ellipse(36, 56, 5.5, 10) },
    ],
  },
  { // 물고기
    name: '물고기',
    layers: [
      { tone: 'dark', d: 'M74 50L95 30L95 70Z' },
      { tone: 'dark', d: 'M38 33Q50 17 62 33Z' },
      { tone: 'base', d: ellipse(46, 52, 33, 21) },
      { tone: 'light', d: ellipse(40, 62, 14, 5) },
      { tone: 'light', d: circle(31, 47, 5) },
      { tone: 'ink', d: circle(30, 47, 2.4) },
    ],
  },
  { // 우산
    name: '우산',
    layers: [
      { tone: 'dark', d: rect(47, 50, 6, 36, 3) },
      { tone: 'dark', d: 'M47 82Q47 94 33 91L34 84Q41 86 41 81Z' },
      { tone: 'base', d: 'M7 54Q8 14 50 12Q92 14 93 54Q81 45 72 54Q61 45 50 54Q39 45 28 54Q19 45 7 54Z' },
      { tone: 'light', d: 'M50 12Q28 18 28 54Q39 45 50 54Z' },
      { tone: 'light', d: circle(50, 9, 3.5) },
    ],
  },
  { // 유령
    name: '유령',
    layers: [
      { tone: 'base', d: 'M19 88V46Q19 12 50 12Q81 12 81 46V88L69 77L59 88L50 77L41 88L31 77Z' },
      { tone: 'light', d: ellipse(32, 56, 5, 3) },
      { tone: 'light', d: ellipse(68, 56, 5, 3) },
      { tone: 'ink', d: circle(40, 42, 5) },
      { tone: 'ink', d: circle(60, 42, 5) },
      { tone: 'ink', d: ellipse(50, 58, 5, 6.5) },
    ],
  },
  { // 약병
    name: '약병',
    layers: [
      { tone: 'dark', d: rect(39, 8, 22, 11, 4) },
      { tone: 'light', d: rect(41, 16, 18, 22, 3) },
      { tone: 'base', d: circle(50, 63, 29) },
      { tone: 'dark', d: 'M23 66Q50 80 77 66L77 71Q50 85 23 71Z' },
      { tone: 'light', d: ellipse(39, 54, 5.5, 11) },
    ],
  },
  { // 책
    name: '책',
    layers: [
      { tone: 'dark', d: 'M70 84V97L76 91L82 97V84Z' },
      { tone: 'base', d: rect(15, 16, 70, 70, 7) },
      { tone: 'dark', d: rect(15, 16, 13, 70, 5) },
      { tone: 'light', d: rect(38, 32, 34, 9, 3.5) },
      { tone: 'light', d: rect(38, 47, 25, 7, 3) },
    ],
  },
];

export const OBJECT_COUNT = OBJECTS.length;

/** 톤 → 색. React는 CSS(.t-*)로, Canvas는 이 함수로 같은 색을 낸다. */
export function toneColor(tone: Tone, hue: number): string {
  switch (tone) {
    case 'base': return `hsl(${hue} 62% 58%)`;
    case 'dark': return `hsl(${hue} 56% 38%)`;
    case 'light': return `hsl(${hue} 75% 82%)`;
    default: return '#2a2230';
  }
}
