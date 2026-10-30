// 대사 상자 — 타자기 효과로 한 줄씩 보여 준다. 탭하면 즉시 완성, 한 번 더 탭하면 다음 줄.
import { buildHero, buildNpc } from './hero.js';
import { NPC_NAME } from './story.js';

export function createDialog({ zoneCard, zoneK, zoneN, avatar, who, text, next }){
  let lines = [], idx = 0, done = null, hero = null, full = '', pos = 0, timer = null;
  const instant = () => document.documentElement.dataset.reduced === 'on';

  function stopType(){ clearInterval(timer); timer = null; }

  function show(){
    const l = lines[idx];
    full = l.text; pos = 0; stopType();
    avatar.replaceChildren(l.who === 'hero' ? buildHero(hero) : buildNpc());
    who.textContent = l.who === 'hero' ? hero.name : NPC_NAME;
    avatar.dataset.who = l.who;
    next.textContent = idx === lines.length - 1 ? '시작 ▶' : '다음 ▶';
    if (instant()){ text.textContent = full; return; }
    text.textContent = '';
    timer = setInterval(() => {
      text.textContent = full.slice(0, ++pos);
      if (pos >= full.length) stopType();
    }, 24);
    // 말풍선이 다시 튀어나오는 연출: 클래스를 뗐다 붙여 애니메이션을 재시작한다
    text.parentElement.classList.remove('pop'); void text.parentElement.offsetWidth;
    text.parentElement.classList.add('pop');
  }

  next.addEventListener('click', () => {
    if (timer){ stopType(); text.textContent = full; return; }
    if (++idx < lines.length) show();
    else { const cb = done; done = null; cb?.(); }
  });

  /** zone: { idx, name } 이면 구역 카드를 함께 보여 준다 */
  return function play(list, opts, onDone){
    lines = list; idx = 0; done = onDone; hero = opts.hero;
    zoneCard.hidden = !opts.zone;
    if (opts.zone){
      zoneK.textContent = `ZONE ${opts.zone.idx + 1}`;
      zoneN.textContent = opts.zone.name;
      zoneCard.classList.remove('flip'); void zoneCard.offsetWidth; zoneCard.classList.add('flip');
    }
    show();
    next.focus({ preventScroll: true });
  };
}
