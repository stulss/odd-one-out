// 라운드 변주 — 사건부의 몇몇 라운드는 특별한 규칙이 붙는다. 매 판이 똑같이 흘러가지 않게 하는 장치다.
//  ⚡ 번개 판: 제한 시간이 짧지만 정답 보상이 있다 (위험 ↔ 보상)
//  🌟 황금 판: 시간은 그대로, 정답 보상이 더 크다 (놓치기 싫은 기회)
// 공정성: 변주는 시간과 보상만 바꾼다. 퍼즐(차이의 크기·정답 위치)은 건드리지 않는다.
import { xmur3 } from './rng';

export type ModId = 'rush' | 'golden';

export interface ModDef { id: ModId; icon: string; label: string; desc: string; timeMul: number; coins: number }

export const MODS: Record<ModId, ModDef> = {
  rush: { id: 'rush', icon: '⚡', label: '번개 판', desc: '제한 시간이 짧아요! 정답이면 +2코인', timeMul: 0.68, coins: 2 },
  golden: { id: 'golden', icon: '🌟', label: '황금 판', desc: '황금 물건! 정답이면 +3코인', timeMul: 1, coins: 3 },
};

/**
 * 이번 라운드의 변주를 정한다. 시드(rootKey)와 라운드 번호로만 정해지므로 같은 시도 안에서는 항상 같다.
 *  · 1라운드와 초반 사건(1번)에는 붙이지 않는다 — 규칙을 익힐 시간
 *  · 보스전: 마지막 일격만 번개 판 (극적인 마무리), 나머지엔 없음
 */
export function rollModifier(rootKey: string, round: number, rounds: number, isBoss: boolean, caseId: number): ModId | null {
  if (round === 1) return null;
  if (isBoss) return round === rounds ? 'rush' : null;
  if (caseId < 2) return null;
  const r = (xmur3(`${rootKey}#mod${round}`)() % 1000) / 1000;
  return r < 0.18 ? 'rush' : r < 0.3 ? 'golden' : null;
}
