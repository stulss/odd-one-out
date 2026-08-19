# 카드3(난이도) 증거 스크린샷 — 배포된 실제 화면에서 T=4.4 / T=5.4를 각각 찍는다.
#
# docs/자동플레이_난이도비교.csv는 이미 D-19 수정(손잡이를 차이 곡선에 걸기) 이후에
# 재실행된 데이터라 그대로 쓴다. 이 스크립트는 그 숫자에 대응하는 실제 화면 증거를 남긴다.
#
# 실행: python tools/shot_difficulty.py

import os, sys, hashlib
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')
BASE = "https://stulss.github.io/odd-one-out/"
OUT = os.path.join("img", "difficulty")
os.makedirs(OUT, exist_ok=True)

def cap(page, name):
    path = os.path.join(OUT, name + ".png")
    page.screenshot(path=path)
    h = hashlib.md5(open(path, "rb").read()).hexdigest()[:8]
    print(f"  {name:24s} {os.path.getsize(path):7d}B  {h}")

def set_tune(page, t):
    page.evaluate(f"() => window.__game.setSetting('tuneT', {t})")
    page.wait_for_timeout(150)

def play_to_result(page):
    page.evaluate("() => window.__game.newGame()")
    page.wait_for_timeout(150)
    page.evaluate("""() => { if (document.getElementById('app').dataset.screen === 'PAUSED')
                               window.__game.togglePause(); }""")
    # 정답만 계속 눌러 자연스럽게 몇 단계 진행한 뒤, 오답으로 빠르게 시간을 소진시켜 종료화면까지
    for _ in range(4):
        page.evaluate("""() => {
          const g = window.__game, s = g.run.stage;
          const cells = [...document.querySelectorAll('.cell')].filter(c => !c.hidden);
          cells[s.answer]?.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}));
        }""")
        page.wait_for_timeout(170)
    page.evaluate("""() => {
      const g = window.__game, s = g.run.stage;
      const cells = [...document.querySelectorAll('.cell')].filter(c => !c.hidden);
      for (let i = 0; i < 14; i++)
        cells[(s.answer + 1) % s.total]?.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}));
    }""")
    for _ in range(30):
        page.wait_for_timeout(300)
        if page.evaluate("() => document.getElementById('app').dataset.screen") == 'RESULT':
            break
    page.wait_for_timeout(500)

def main():
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1).new_page()
        page.goto(BASE); page.wait_for_timeout(1200)

        for t in (4.4, 5.4):
            tag = str(t).replace('.', '_')
            print(f"[T={t}]")
            # 타이틀 오버레이가 헤더까지 덮어 설정 버튼을 가린다 — 게임을 먼저 시작해야 열 수 있다.
            page.evaluate("() => window.__game.newGame()")
            page.wait_for_timeout(200)
            page.evaluate("""() => { if (document.getElementById('app').dataset.screen === 'PAUSED')
                                       window.__game.togglePause(); }""")
            set_tune(page, t)
            page.click("#btnSettings"); page.wait_for_timeout(250)
            cap(page, f"settings_T{tag}")
            page.click("#btnCloseSettings"); page.wait_for_timeout(150)
            play_to_result(page)
            cap(page, f"result_T{tag}")

        b.close()
    print("완료 —", OUT)

main()
