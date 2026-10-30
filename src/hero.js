// 캐릭터 — 이미지 파일 없이 CSS 도형으로 그린다 (게임 오브젝트와 같은 원칙).
// 몸 모양 4종 × 색 8종 × 액세서리 4종. 표정은 data-mood 속성 하나로 바뀐다.

export const HERO_SHAPES = [['circle','동글'], ['square','네모'], ['diamond','마름모'], ['hexagon','육각']];
export const HERO_HUES   = [160, 215, 280, 40, 330, 195, 10, 100];
export const HERO_ACCS   = [['none','없음'], ['antenna','안테나'], ['hat','탐정모'], ['lens','돋보기']];
export const NAME_MAX = 8;

const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

/** 이름은 화면에 textContent로만 넣지만, 공백·제어문자·꺾쇠는 저장 전에 걸러 둔다. */
export function sanitizeName(s){
  return String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, NAME_MAX);
}

export function buildHero(hero){
  const root = el('div', 'hero');
  root.dataset.mood = 'idle';
  root.style.setProperty('--hh', hero.hue);
  const body = el('div', 'hero-body hs-' + hero.shape);
  body.append(el('i', 'eye l'), el('i', 'eye r'), el('i', 'mouth'));
  root.append(body);
  if (hero.acc && hero.acc !== 'none') root.append(el('b', 'acc ' + hero.acc));
  return root;
}

export function buildNpc(){
  const root = el('div', 'hero npc');
  root.dataset.mood = 'idle';
  const body = el('div', 'hero-body hs-circle');
  body.append(el('i', 'ring'), el('i', 'pupil'));
  root.append(body, el('b', 'acc antenna'));
  return root;
}

export function setMood(root, mood){ if (root) root.dataset.mood = mood; }

/** 캐릭터를 container에 다시 그린다 (container 안의 기존 내용은 교체) */
export function mountHero(container, hero, mood = 'idle'){
  const h = buildHero(hero);
  h.dataset.mood = mood;
  container.replaceChildren(h);
  return h;
}

/** 캐릭터 편집기 — 입력이 바뀔 때마다 미리보기를 다시 그린다. */
export function createCreator({ preview, nameInput, pickShape, pickHue, pickAcc }){
  let cur = { name:'', shape:'circle', hue:160, acc:'none' };

  function pick(group, items, key, label){
    group.replaceChildren(...items.map(it => {
      const [val, text] = Array.isArray(it) ? it : [it, ''];
      const b = el('button', 'chip');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(cur[key] === val));
      b.setAttribute('aria-label', label + ' ' + (text || val));
      if (key === 'hue'){ b.classList.add('swatch'); b.style.setProperty('--hh', val); }
      else b.textContent = text;
      b.addEventListener('click', () => { cur[key] = val; redraw(); });
      return b;
    }));
  }

  function redraw(){
    mountHero(preview, cur, 'happy');
    pick(pickShape, HERO_SHAPES, 'shape', '몸 모양');
    pick(pickHue,   HERO_HUES,   'hue',   '색');
    pick(pickAcc,   HERO_ACCS,   'acc',   '액세서리');
  }

  nameInput.addEventListener('input', () => { cur.name = sanitizeName(nameInput.value); });

  return {
    set(h){ cur = { ...cur, ...h }; nameInput.value = cur.name; redraw(); },
    get(){ return { ...cur, name: sanitizeName(nameInput.value) }; },
  };
}
