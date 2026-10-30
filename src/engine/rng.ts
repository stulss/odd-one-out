// 시드 기반 난수 — 같은 시드는 어느 기기에서든 같은 결과를 낸다.
// Math.random()은 퍼즐 생성에서 쓰지 않는다 (오늘의 문제/도전장 재현성).

export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 스테이지마다 독립 스트림 — 같은 스테이지를 다시 뽑아도 결과가 같다
export const stageRng = (rootKey: string, n: number) => mulberry32(xmur3(`${rootKey}#${n}`)());

// 도전장 코드 ↔ 시드 (혼동 문자 I,O,0,1 제외한 32자)
const AB = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function encodeSeed(seed: number): string {
  let s = seed >>> 0;
  let out = '';
  for (let i = 0; i < 6; i++) {
    out = AB[s & 31] + out;
    s >>>= 5;
  }
  return out;
}

export function decodeSeed(code: unknown): number | null {
  if (typeof code !== 'string' || code.length !== 6) return null;
  let a = 0;
  for (const ch of code.toUpperCase()) {
    const v = AB.indexOf(ch);
    if (v < 0) return null;
    a = ((a << 5) | v) >>> 0;
  }
  return a;
}
