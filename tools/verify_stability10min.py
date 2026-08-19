# 10분 연속 실행 안정성 검증 — 카드2 학생 자체 점검 4번 항목.
#
# 자동 플레이로 배포된 실제 게임을 10분간 계속 진행시키며 60초 간격으로
# DOM 노드 수 · JS 힙 · 프레임 간격(부드러움의 대리 지표) · 콘솔 오류를 샘플링한다.
# "FPS 유지, 메모리 증가 없음, 콘솔 오류 0"을 판정하는 데 필요한 전부 여기서 잰다.
#
# 실행: python tools/verify_stability10min.py   (백그라운드 실행 권장, 총 ~11분 소요)

import os, sys, csv, hashlib
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')
BASE = "https://stulss.github.io/odd-one-out/"
OUT_DIR = os.path.join("img", "stability")
CSV_PATH = os.path.join("docs", "10분_안정성_로그.csv")
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs("docs", exist_ok=True)

SETUP_JS = """
() => {
  const g = window.__game;
  window.__frameBuf = [];
  let lastT = performance.now();
  function frameLoop(t){
    window.__frameBuf.push(t - lastT); lastT = t;
    if (window.__frameBuf.length > 600) window.__frameBuf.shift();
    window.__rafId = requestAnimationFrame(frameLoop);
  }
  window.__rafId = requestAnimationFrame(frameLoop);

  window.__stab = { t0: performance.now(), errors: 0 };
  const origErr = console.error;
  console.error = (...a) => { window.__stab.errors++; origErr.apply(console, a); };

  g.newGame();
  window.__autoplay = setInterval(() => {
    const screen = document.getElementById('app').dataset.screen;
    if (screen === 'PAUSED') { g.togglePause(); return; }
    if (screen === 'RESULT') { g.newGame(); return; }
    const s = g.run.stage; if (!s) return;
    const cells = [...document.querySelectorAll('.cell')].filter(c => !c.hidden);
    cells[s.answer]?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  }, 220);
  return true;
}
"""

SNAPSHOT_JS = """
() => {
  const g = window.__game;
  const buf = window.__frameBuf.slice();
  const avg = buf.length ? buf.reduce((a,b) => a+b, 0) / buf.length : 0;
  const max = buf.length ? Math.max(...buf) : 0;
  const jank = buf.filter(dt => dt > 33.4).length;
  return {
    tSec: +((performance.now() - window.__stab.t0) / 1000).toFixed(1),
    stage: g.run.n,
    domNodes: document.querySelectorAll('*').length,
    cellNodes: document.querySelectorAll('.cell').length,
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize/1048576).toFixed(2) : null,
    avgFrameMs: +avg.toFixed(2),
    maxFrameMs: +max.toFixed(2),
    jankFrames: jank,
    sampleFrames: buf.length,
    consoleErrors: window.__stab.errors,
    screen: document.getElementById('app').dataset.screen,
  };
}
"""

def main():
    rows = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1).new_page()
        page.goto(BASE); page.wait_for_timeout(1200)
        page.evaluate(SETUP_JS)
        print("시작 —", BASE, "· 10분 자동 진행 (60초 간격 11개 지점 샘플링)")

        SHOT_AT_INDEX = {0: "t000_start", 3: "t180_3min", 6: "t360_6min", 10: "t600_10min"}
        for i in range(11):
            if i > 0:
                page.wait_for_timeout(60000)
            snap = page.evaluate(SNAPSHOT_JS)
            rows.append(snap)
            print(f"  t={snap['tSec']:>6}s  stage={snap['stage']:>4}  DOM={snap['domNodes']:>4}  "
                  f"heap={snap['heapMB']}MB  avgFrame={snap['avgFrameMs']}ms  "
                  f"jank={snap['jankFrames']}/{snap['sampleFrames']}  errors={snap['consoleErrors']}  "
                  f"screen={snap['screen']}")
            if i in SHOT_AT_INDEX:
                page.screenshot(path=os.path.join(OUT_DIR, SHOT_AT_INDEX[i] + ".png"))

        page.evaluate("() => { clearInterval(window.__autoplay); cancelAnimationFrame(window.__rafId); }")
        b.close()

    with open(CSV_PATH, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        for r in rows: w.writerow(r)

    dom0, domN = rows[0]['domNodes'], rows[-1]['domNodes']
    heap0 = next((r['heapMB'] for r in rows if r['heapMB'] is not None), None)
    heapN = next((r['heapMB'] for r in reversed(rows) if r['heapMB'] is not None), None)
    totalErr = rows[-1]['consoleErrors']
    totalJank = sum(r['jankFrames'] for r in rows)
    totalSampled = sum(r['sampleFrames'] for r in rows)
    finalStage = rows[-1]['stage']

    print("\n=== 10분 안정성 요약 ===")
    print(f"DOM 노드: {dom0} → {domN} (증가 {domN - dom0})")
    print(f"JS 힙: {heap0}MB → {heapN}MB (증가 {None if heap0 is None else round(heapN-heap0,2)}MB)")
    print(f"콘솔 오류 누적: {totalErr}건")
    print(f"프레임 잭(33ms 초과): {totalJank}/{totalSampled} ({100*totalJank/max(1,totalSampled):.2f}%)")
    print(f"도달 스테이지: {finalStage} (10분간 자동 진행)")
    print(f"\n기록 저장: {CSV_PATH}")
    print(f"판정: {'PASS' if dom0 == domN and totalErr == 0 else 'FAIL — 위 수치 확인 필요'}")

main()
