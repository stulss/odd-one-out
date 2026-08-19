// STEP 5에서 추가 — 오늘의 문제 / 도전장.
//
// STEP 2에서 시드 난수를 미리 넣어둔 이유가 여기서 회수된다.
// 그때 Math.random()을 그대로 뒀다면 이 기능은 성립하지 않았다.

import { encodeSeed, decodeSeed, xmur3 } from './rng.js';

// 날짜는 KST(UTC+9) 고정.
// 기기의 로컬 타임존을 쓰면 해외에 있는 친구가 다른 문제를 보게 된다.
export function todayKeyKST(now = new Date()){
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  return `${kst.getUTCFullYear()}${String(kst.getUTCMonth() + 1).padStart(2, '0')}${String(kst.getUTCDate()).padStart(2, '0')}`;
}

export const formatKey = k => `${k.slice(0,4)}.${k.slice(4,6)}.${k.slice(6,8)}`;

// URL을 읽어 이번 판의 정체를 결정한다.
// 잘못된 값이 들어와도 **절대 던지지 않고** 자유 플레이로 떨어진다.
// 링크는 남이 손대는 값이므로, 여기서 크래시가 나면 게임 자체가 열리지 않는다.
export function readChallenge(search = location.search){
  let p;
  try { p = new URLSearchParams(search); } catch { p = new URLSearchParams(''); }

  const c = p.get('c');
  if (c && decodeSeed(c) !== null){
    const rival = parseInt(p.get('r') ?? '', 10);
    return { type:'code', key:c.toUpperCase(), rootKey:`c:${c.toUpperCase()}`,
             rival: Number.isFinite(rival) && rival > 0 ? rival : null };
  }

  const d = p.get('d');
  if (d && /^\d{8}$/.test(d)) return { type:'daily', key:d, rootKey:`d:${d}`, rival:null };

  const k = freeKey();
  return { type:'free', key:k, rootKey:`c:${k}`, rival:null };
}

export function freeKey(){
  try {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    if (buf[0]) return encodeSeed(buf[0]);
  } catch { /* crypto가 없으면 아래로 */ }
  return encodeSeed(xmur3(String(Date.now()))());
}

export function shareUrl(ch, stages){
  const base = location.origin + location.pathname;
  const q = ch.type === 'daily' ? `?d=${ch.key}` : `?c=${ch.key}`;
  return `${base}${q}&r=${stages}`;
}

export function label(ch){
  if (ch.type === 'daily') return `${formatKey(ch.key)} 오늘의 문제`;
  if (ch.type === 'code')  return `도전장 ${ch.key}`;
  return '자유 플레이';
}
