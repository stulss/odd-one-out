// 대사 — 확인 버튼 없이 자동으로 흘러간다.
// 한 줄이 타자기로 나타나고 → 잠깐 머물고 → 다음 줄 → 마지막 줄 뒤에 화면이 스르르 사라지며 게임이 시작된다.
// 서두르고 싶으면 화면을 누르거나 Enter/Space (누를 때마다 한 단계씩 빨리 넘어간다).
import { buildHero, buildNpc } from './hero.js';
import { NPC_NAME } from './story.js';

const TYPE_MS = 16;     // 글자당 시간
const FADE_MS = 260;

export function createDialog({ root, zoneCard, zoneK, zoneN, avatar, who, text }){
  let lines = [], idx = 0, done = null, hero = null, hold = 650;
  let full = '', pos = 0, typeTimer = null, holdTimer = null, active = false;
  const bubble = text.parentElement;
  const instant = () => document.documentElement.dataset.reduced === 'on';

  const clearTimers = () => { clearInterval(typeTimer); clearTimeout(holdTimer); typeTimer = holdTimer = null; };

  function avatarFor(l){
    if (l.who === 'npc') return buildNpc();
    const h = buildHero(hero, l.tier ?? 0);
    if (l.who === 'sys') h.classList.add('evolve');     // 승급 장면: 진화 연출
    return h;
  }

  function showLine(){
    const l = lines[idx];
    clearTimers();
    full = l.text; pos = 0;
    avatar.replaceChildren(avatarFor(l));
    who.textContent = l.who === 'npc' ? NPC_NAME : l.who === 'sys' ? '승급' : hero.name;
    bubble.classList.toggle('sys', l.who === 'sys');
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    if (instant()){ text.textContent = full; afterTyped(); return; }
    text.textContent = '';
    typeTimer = setInterval(() => {
      text.textContent = full.slice(0, ++pos);
      if (pos >= full.length){ clearInterval(typeTimer); typeTimer = null; afterTyped(); }
    }, TYPE_MS);
  }

  function afterTyped(){ holdTimer = setTimeout(advance, hold); }

  function advance(){
    clearTimers();
    if (++idx < lines.length) showLine();
    else finish();
  }

  function finish(){
    active = false;
    root.classList.add('out');
    setTimeout(() => { root.classList.remove('out'); const cb = done; done = null; cb?.(); }, instant() ? 0 : FADE_MS);
  }

  // 누를 때마다 한 단계 빨리: 타이핑 중이면 즉시 완성, 이미 완성이면 다음 줄로
  function skip(){
    if (!active) return;
    if (typeTimer){ clearInterval(typeTimer); typeTimer = null; text.textContent = full; afterTyped(); }
    else advance();
  }
  root.addEventListener('pointerdown', skip);
  document.addEventListener('keydown', e => {
    if (active && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')){ e.preventDefault(); skip(); }
  });

  /** opts: { hero, zone?, hold? }  zone이 있으면 구역 카드를 함께 보여 준다 */
  return function play(list, opts, onDone){
    clearTimers();
    lines = list; idx = 0; done = onDone; hero = opts.hero; hold = opts.hold ?? 650; active = true;
    root.classList.remove('out');
    zoneCard.hidden = !opts.zone;
    if (opts.zone){
      zoneK.textContent = `ZONE ${opts.zone.idx + 1}`;
      zoneN.textContent = opts.zone.name;
      zoneCard.classList.remove('flip'); void zoneCard.offsetWidth; zoneCard.classList.add('flip');
    }
    showLine();
  };
}
