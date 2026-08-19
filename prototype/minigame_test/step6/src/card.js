// STEP 5에서 추가 — 결과 카드를 Canvas로 그린다.
//
// 설계 의도: 카드에 점수만 넣으면 자랑으로 끝난다.
// **마지막 문제의 격자를 정답 표시 없이** 넣으면, 보는 사람이 카드 자체를 풀게 되고
// 링크를 누를 이유가 생긴다. 공유는 기능이 아니라 이 한 장의 설계에 달려 있다.

const W = 1080, H = 1350;     // 4:5 — 인스타·카톡에서 잘리지 않는 비율

export function drawCard(canvas, { stages, points, bestReaction, label, stage, isBest }){
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const F = (size, weight = '700') =>
    `${weight} ${size}px -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;

  g.fillStyle = '#0E1116'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(94,230,197,.35)'; g.lineWidth = 3;
  g.strokeRect(40, 40, W - 80, H - 80);
  g.textAlign = 'center';

  g.fillStyle = '#5EE6C5'; g.font = F(46);
  g.fillText('딱 하나 이상함', W / 2, 150);

  g.fillStyle = '#E8EDF4'; g.font = F(250);
  g.fillText(String(stages), W / 2, 420);
  g.fillStyle = '#8A94A6'; g.font = F(52, '500');
  g.fillText('단계', W / 2, 490);

  if (isBest){
    g.fillStyle = '#5EE6C5'; g.font = F(40);
    g.fillText('최고 기록 갱신', W / 2, 555);
  }

  g.fillStyle = '#8A94A6'; g.font = F(38, '500');
  const r = bestReaction == null ? '-' : bestReaction.toFixed(2);
  g.fillText(`${points.toLocaleString('ko-KR')}점 · 최고 반응 ${r}초`, W / 2, 630);

  if (stage) drawGrid(g, stage, W / 2, 700);

  g.fillStyle = '#5A6272'; g.font = F(34, '500');
  g.fillText(label, W / 2, H - 110);

  return canvas;
}

// 정답을 표시하지 않는다. 보는 사람이 직접 찾아보게 두는 것이 핵심이다.
function drawGrid(g, stage, cx, top){
  const gap = 12;
  const cell = Math.min((560 - gap * (stage.cols - 1)) / stage.cols,
                        (430 - gap * (stage.rows - 1)) / stage.rows);
  const gw = cell * stage.cols + gap * (stage.cols - 1);
  const gh = cell * stage.rows + gap * (stage.rows - 1);
  const x0 = cx - gw / 2, y0 = top;

  g.save();
  g.strokeStyle = 'rgba(94,230,197,.18)'; g.lineWidth = 2;
  g.strokeRect(x0 - 24, y0 - 24, gw + 48, gh + 48);

  for (let i = 0; i < stage.total; i++){
    const row = Math.floor(i / stage.cols), col = i % stage.cols;
    const x = x0 + col * (cell + gap), y = y0 + row * (cell + gap);
    const odd = i === stage.answer;
    g.save();
    g.translate(x + cell / 2, y + cell / 2);
    // Canvas에서 재현 가능한 축만 반영한다. CSS 필터 계열은 근사도 하지 않는다.
    if (odd){
      const d = stage.delta;
      if (stage.axis === 'rotate') g.rotate(d * Math.PI / 180);
      else if (stage.axis === 'size') g.scale(1 + d / 100, 1 + d / 100);
      else if (stage.axis === 'skew') g.transform(1, 0, Math.tan(d * Math.PI / 180), 1, 0, 0);
      else if (stage.axis === 'offset') g.translate(d, 0);
      else if (stage.axis === 'opacity') g.globalAlpha = 1 - d / 100;
    }
    g.fillStyle = fillFor(stage, odd);
    roundRect(g, -cell / 2, -cell / 2, cell, cell, cell * 0.16);
    g.fill();
    g.restore();
  }
  g.restore();
}

function fillFor(stage, odd){
  const h = stage.hue;
  if (!odd) return `hsl(${h} 55% 62%)`;
  const d = stage.delta;
  if (stage.axis === 'hue')   return `hsl(${(h + d) % 360} 55% 62%)`;
  if (stage.axis === 'light') return `hsl(${h} 55% ${Math.min(92, 62 + d * 0.5)}%)`;
  if (stage.axis === 'sat')   return `hsl(${h} ${Math.max(5, 55 - d)}% 62%)`;
  return `hsl(${h} 55% 62%)`;
}

function roundRect(g, x, y, w, h, r){
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else {
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);         g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
}

export function toBlob(canvas){
  return new Promise(res => {
    try { canvas.toBlob(b => res(b), 'image/png'); } catch { res(null); }
  });
}
