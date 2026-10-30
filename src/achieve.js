// 업적 — 순수 함수. 저장은 store.ach 문자열(쉼표로 이은 id)에 한다.
export const ACHIEVEMENTS = [
  { id:'first',   icon:'①', name:'첫 걸음',      desc:'처음으로 한 판을 끝냈다',          test: c => c.store.stats.played >= 1 },
  { id:'s10',     icon:'⑩', name:'10단계',       desc:'일반 모드에서 10단계 도달',        test: c => c.mode === 'normal' && c.stages >= 10 },
  { id:'s20',     icon:'⑳', name:'20단계',       desc:'일반 모드에서 20단계 도달',        test: c => c.mode === 'normal' && c.stages >= 20 },
  { id:'s30',     icon:'㉚', name:'30단계',       desc:'일반 모드에서 30단계 도달',        test: c => c.mode === 'normal' && c.stages >= 30 },
  { id:'combo10', icon:'🔥', name:'콤보 10',      desc:'한 판에서 연속 10번 정답',         test: c => c.maxCombo >= 10 },
  { id:'fast',    icon:'⚡', name:'번개 눈',      desc:'한 번 0.8초 안에 정답',            test: c => c.bestReaction != null && c.bestReaction < 0.8 },
  { id:'clean',   icon:'✓',  name:'무결점',       desc:'오답 없이 10단계 이상',            test: c => c.mode === 'normal' && c.wrongs === 0 && c.stages >= 10 },
  { id:'daily',   icon:'📅', name:'오늘의 도전자', desc:'오늘의 문제를 완료',               test: c => c.challengeType === 'daily' },
  { id:'streak3', icon:'🗓', name:'3일 연속',     desc:'3일 연속 플레이',                  test: c => c.store.streak.count >= 3 },
  { id:'blitz15', icon:'⏱', name:'30초 15단계',  desc:'30초 도전에서 15단계',             test: c => c.mode === 'blitz' && c.stages >= 15 },
];

export const owned = store => new Set(String(store.ach || '').split(',').filter(Boolean));

/** 이번 판으로 새로 달성한 업적을 store에 기록하고 목록을 돌려준다. */
export function evaluate(ctx){
  const have = owned(ctx.store);
  const fresh = ACHIEVEMENTS.filter(a => !have.has(a.id) && a.test(ctx));
  fresh.forEach(a => have.add(a.id));
  ctx.store.ach = [...have].join(',');
  return fresh;
}
