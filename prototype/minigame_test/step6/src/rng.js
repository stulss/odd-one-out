// STEP 2에서 추가.
// STEP 1은 Math.random()을 썼다. 그러면 같은 URL을 열어도 매번 다른 문제가 나온다.
// "친구에게 같은 문제 보내기"를 나중에 하려면 지금 바꿔야 한다.
// (나중에 바꾸려 하면 이미 여기저기서 난수를 쓰고 있어서 훨씬 비싸진다)

export function xmur3(str){
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export function mulberry32(a){
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 스테이지마다 독립 스트림.
// 이렇게 하면 5번 스테이지를 다시 뽑아도 항상 같은 결과가 나온다.
export const stageRng = (rootKey, n) => mulberry32(xmur3(`${rootKey}#${n}`)());

// STEP 5에서 추가 — 시드 ↔ 6자리 도전장 코드.
// 혼동되는 글자(I, O, 0, 1)를 뺀 32자만 쓴다. 사람이 입력하거나 읽어줄 수 있어야 하기 때문이다.
const AB = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function encodeSeed(seed){
  let s = seed >>> 0, out = '';
  for (let i = 0; i < 6; i++){ out = AB[s & 31] + out; s >>>= 5; }
  return out;
}

export function decodeSeed(code){
  if (typeof code !== 'string' || code.length !== 6) return null;
  let a = 0;
  for (const ch of code.toUpperCase()){
    const v = AB.indexOf(ch);
    if (v < 0) return null;              // 잘못된 코드는 null. 던지지 않는다.
    a = ((a << 5) | v) >>> 0;
  }
  return a;
}
