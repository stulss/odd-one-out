// 부트스트랩 — DOM 배선만 담당한다. 게임 규칙은 game.js에 있다.
import { createGame } from './game.js';
import { copy, saveImage } from './share.js';
import { DIFF_AXES } from './stage.js';

const game = createGame();
const $ = id => document.getElementById(id);
const on = (id, fn) => $(id).addEventListener('click', fn);

on('btnHeroOk',     () => game.confirmHero());
on('btnHeroCancel', () => game.goTitle());
on('btnHeroEdit',   () => game.openCreator(false));
on('btnStart',    () => game.startPlay());
on('btnDaily',    () => game.playDaily());
on('btnPause',    () => game.togglePause());
on('btnResume',   () => game.togglePause());
on('btnToTitle',  () => game.goTitle());
on('btnRestart',  () => game.restart());
on('btnShare',    () => game.doShare());
on('btnResultTitle', () => game.goTitle());

const sheet = $('settings');
on('btnSettings',      () => { sheet.hidden = false; });
on('btnTitleSettings', () => { sheet.hidden = false; });
on('btnCloseSettings', () => { sheet.hidden = true; });

$('optSound').addEventListener('change',  e => game.setSetting('sound', e.target.checked));
$('optMotion').addEventListener('change', e => game.setSetting('reducedMotion', e.target.checked));
$('optColor').addEventListener('change',    e => game.setSetting('colorSafe', e.target.checked));
$('optContrast').addEventListener('change', e => game.setSetting('highContrast', e.target.checked));
$('tuneOut2').addEventListener('input',   e => game.setSetting('tuneT', +e.target.value));

on('btnCSV',   () => copy(game.exportCSV(), game.toast));
on('btnReset', () => game.resetAll());

// 이름 입력창에서 Enter = 등록 완료
$('heroName').addEventListener('keydown', e => { if (e.key === 'Enter') game.confirmHero(); });

const fb = $('fallback');
on('fbCopyText', () => copy(fb.dataset.text || '', game.toast));
on('fbCopyUrl',  () => copy(fb.dataset.url  || '', game.toast));
on('fbSaveImg',  () => saveImage(game.cardBlob, game.toast));

// 모드 선택 · 연습 축 선택
for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => game.setMode(b.dataset.mode));
const axisSel = $('practiceAxis');
axisSel.add(new Option('무작위', ''));
for (const [id, a] of Object.entries(DIFF_AXES)) axisSel.add(new Option(a.label, id));
axisSel.addEventListener('change', () => game.setPracticeAxis(axisSel.value));

game.boot();

// PWA — 오프라인 실행. 등록에 실패해도 게임에는 영향이 없다.
if ('serviceWorker' in navigator && location.protocol !== 'file:'){
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// 개발 중 확인용 — 배포본에서도 해가 없다 (개인정보 없음)
window.__game = game;
