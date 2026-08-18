// 부트스트랩 — DOM 배선만 담당한다. 게임 규칙은 game.js에 있다.
import { createGame } from './game.js';
import { copy, saveImage } from './share.js';

const game = createGame();
const $ = id => document.getElementById(id);
const on = (id, fn) => $(id).addEventListener('click', fn);

on('btnStart',    () => game.newGame());
on('btnDaily',    () => game.playDaily());
on('btnPause',    () => game.togglePause());
on('btnResume',   () => game.togglePause());
on('btnToTitle',  () => game.goTitle());
on('btnRestart',  () => game.restart());
on('btnShare',    () => game.doShare());
on('btnResultTitle', () => game.goTitle());

const sheet = $('settings');
on('btnSettings',      () => { sheet.hidden = false; });
on('btnCloseSettings', () => { sheet.hidden = true; });

$('optSound').addEventListener('change',  e => game.setSetting('sound', e.target.checked));
$('optMotion').addEventListener('change', e => game.setSetting('reducedMotion', e.target.checked));
$('tuneOut2').addEventListener('input',   e => game.setSetting('tuneT', +e.target.value));

on('btnCSV',   () => copy(game.exportCSV(), game.toast));
on('btnReset', () => game.resetAll());

const fb = $('fallback');
on('fbCopyText', () => copy(fb.dataset.text || '', game.toast));
on('fbCopyUrl',  () => copy(fb.dataset.url  || '', game.toast));
on('fbSaveImg',  () => saveImage(game.cardBlob, game.toast));

game.boot();

// 개발 중 확인용 — 배포본에서도 해가 없다 (개인정보 없음)
window.__game = game;
