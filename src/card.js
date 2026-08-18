// 결과 카드 — Canvas로 런타임 생성 (이미지 파일 0개).
// 카드에 '정답 없는 마지막 격자'를 넣어, 보는 사람이 카드 자체를 풀게 만든다.
import { DIFF_AXES } from './stage.js';

const W = 1080, H = 1350;

export function drawCard(canvas, { stages, bestReaction, avgReaction, label, stage, isBest }){
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');

  g.fillStyle = '#0E1116'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(94,230,197,.35)'; g.lineWidth = 3;
  g.strokeRect(40, 40, W - 80, H - 80);

  g.textAlign = 'center';
  const font = (size, weight = '700') =>
    `${weight} ${size}px -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;

  // 상단 워드마크
  g.fillStyle = '#5EE6C5'; g.font = font(46);
  g.fillText('딱 하나 이상함', W / 2, 150);

  // 거대 숫자
  g.fillStyle = '#E8EDF4'; g.font = font(260);
  g.fillText(String(stages), W / 2, 420);
  g.fillStyle = '#8A94A6'; g.font = font(52, '500');
  g.fillText('단계', W / 2, 490);

  if (isBest){
    g.fillStyle = '#5EE6C5'; g.font = font(40);
    g.fillText('★ 최고 기록 갱신', W / 2, 560);
  }

  // 보조 스탯
  g.fillStyle = '#8A94A6'; g.font = font(38, '500');
  g.fillText(`최고 반응 ${fmt(bestReaction)}초   ·   평균 ${fmt(avgReaction)}초`, W / 2, 640);

  // 마지막 격자 (정답 표시 없음)
  if (stage) drawGrid(g, stage, W / 2, 700, 560);

  g.fillStyle = '#5A6272'; g.font = font(34, '500');
  g.fillText(label, W / 2, H - 130);
  g.fillStyle = '#8A94A6'; g.font = font(30, '500');
  g.fillText(location.host || 'odd-one-out', W / 2, H - 80);

  return canvas;
}

function drawGrid(g, stage, cx, top, boxW){
  const gap = 12;
  const cell = Math.min((boxW - gap * (stage.cols - 1)) / stage.cols,
                        (420 - gap * (stage.rows - 1)) / stage.rows);
  const gw = cell * stage.cols + gap * (stage.cols - 1);
  const gh = cell * stage.rows + gap * (stage.rows - 1);
  const x0 = cx - gw / 2, y0 = top;

  g.save();
  g.strokeStyle = 'rgba(94,230,197,.18)'; g.lineWidth = 2;
  g.strokeRect(x0 - 24, y0 - 24, gw + 48, gh + 48);

  for (let i = 0; i < stage.total; i++){
    const r = Math.floor(i / stage.cols), c = i % stage.cols;
    const x = x0 + c * (cell + gap), y = y0 + r * (cell + gap);
    const odd = i === stage.answer;
    g.save();
    g.translate(x + cell / 2, y + cell / 2);
    applyDiff(g, stage, odd);
    g.fillStyle = fillFor(stage, odd);
    round(g, -cell / 2, -cell / 2, cell, cell, cell * 0.18);
    g.fill();
    g.restore();
  }
  g.restore();
}

// 캔버스에서 재현 가능한 축만 반영한다. 나머지는 기본 모양으로 그린다.
function applyDiff(g, stage, odd){
  if (!odd) return;
  const d = stage.delta;
  if (stage.axis === 'rotate') g.rotate(d * Math.PI / 180);
  else if (stage.axis === 'size') g.scale(1 + d / 100, 1 + d / 100);
  else if (stage.axis === 'skew') g.transform(1, 0, Math.tan(d * Math.PI / 180), 1, 0, 0);
  else if (stage.axis === 'offset') g.translate(d, 0);
  else if (stage.axis === 'opacity') g.globalAlpha = 1 - d / 100;
}

function fillFor(stage, odd){
  const h = stage.hue;
  if (!odd) return `hsl(${h} 62% 58%)`;
  const d = stage.delta;
  if (stage.axis === 'hue')   return `hsl(${(h + d) % 360} 62% 58%)`;
  if (stage.axis === 'light') return `hsl(${h} 62% ${Math.min(92, 58 + d * 0.5)}%)`;
  if (stage.axis === 'sat')   return `hsl(${h} ${Math.max(5, 62 - d)}% 58%)`;
  return `hsl(${h} 62% 58%)`;
}

function round(g, x, y, w, h, r){
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else {
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);         g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
}

const fmt = v => (v == null ? '-' : v.toFixed(2));

export function toBlob(canvas){
  return new Promise(res => {
    try { canvas.toBlob(b => res(b), 'image/png'); } catch { res(null); }
  });
}
