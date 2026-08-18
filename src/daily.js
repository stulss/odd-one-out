// 오늘의 문제 / 도전장 — URL 하나로 같은 문제를 재현한다.
import { xmur3, encodeSeed, decodeSeed } from './rng.js';

// 날짜는 KST(UTC+9) 고정. 로컬 타임존을 쓰면 해외 친구와 다른 문제를 보게 된다.
export function todayKeyKST(now = new Date()){
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  return `${kst.getUTCFullYear()}${String(kst.getUTCMonth() + 1).padStart(2, '0')}${String(kst.getUTCDate()).padStart(2, '0')}`;
}

export function formatKey(key){
  return `${key.slice(0, 4)}.${key.slice(4, 6)}.${key.slice(6, 8)}`;
}

/** URL을 읽어 이번 판의 정체를 결정한다. 잘못된 값이 와도 절대 던지지 않는다. */
export function readChallenge(search = location.search){
  let params;
  try { params = new URLSearchParams(search); } catch { params = new URLSearchParams(''); }

  const c = params.get('c');
  if (c){
    const seed = decodeSeed(c);
    if (seed !== null){
      const rival = parseInt(params.get('s') ?? '', 10);
      return { type:'code', key:c.toUpperCase(), rootKey:`c:${c.toUpperCase()}`,
               rival: Number.isFinite(rival) && rival > 0 ? rival : null };
    }
    // 잘못된 코드 → 조용히 자유 플레이로 폴백 (크래시 금지)
  }

  const d = params.get('d');
  if (d && /^\d{8}$/.test(d)) return { type:'daily', key:d, rootKey:`d:${d}`, rival:null };

  if (params.has('daily')) {
    const k = todayKeyKST();
    return { type:'daily', key:k, rootKey:`d:${k}`, rival:null };
  }

  const k = freeKey();
  return { type:'free', key:k, rootKey:`c:${k}`, rival:null };
}

export function freeKey(){
  const buf = new Uint32Array(1);
  (self.crypto ?? {}).getRandomValues?.(buf);
  const seed = buf[0] || xmur3(String(Date.now()))();
  return encodeSeed(seed);
}

export function shareUrl(challenge, stages){
  const base = location.origin + location.pathname;
  if (challenge.type === 'daily') return `${base}?d=${challenge.key}&s=${stages}`;
  return `${base}?c=${challenge.key}&s=${stages}`;
}

export function challengeLabel(ch){
  if (ch.type === 'daily') return `${formatKey(ch.key)} 오늘의 문제`;
  if (ch.type === 'code')  return `도전장 ${ch.key}`;
  return '자유 플레이';
}
