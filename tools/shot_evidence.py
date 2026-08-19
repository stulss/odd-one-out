# 체크리스트 증거용 추가 스크린샷 — 지금까지 수치로만 확인했던 두 항목의 실제 화면을 찍는다.
#
# 1) 두 기준 해상도(1366×768 / 1920×1080)에서 실제 플레이 화면 — 지금까지는
#    getBoundingClientRect() 수치로만 "넘침 없음"을 확인했지 화면을 찍어두지 않았다.
# 2) 저장값 손상 → 기본값 정상 실행 — localStorage를 깨뜨린 뒤 새로고침해도
#    게임이 정상적으로 뜨는 것을 전/후로 찍는다.
#
# 실행: python tools/shot_evidence.py

import os, sys, hashlib
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')
BASE = "https://stulss.github.io/odd-one-out/"
OUT = os.path.join("img", "evidence")
os.makedirs(OUT, exist_ok=True)

def cap(page, name):
    path = os.path.join(OUT, name + ".png")
    page.screenshot(path=path)
    h = hashlib.md5(open(path, "rb").read()).hexdigest()[:8]
    print(f"  {name:22s} {os.path.getsize(path):7d}B  {h}")

def play_a_bit(page, rounds=6):
    page.evaluate("() => window.__game.newGame()")
    page.wait_for_timeout(200)
    page.evaluate("""() => { if (document.getElementById('app').dataset.screen === 'PAUSED')
                               window.__game.togglePause(); }""")
    for _ in range(rounds):
        page.evaluate("""() => {
          const g = window.__game, s = g.run.stage;
          const cells = [...document.querySelectorAll('.cell')].filter(c => !c.hidden);
          cells[s.answer]?.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}));
        }""")
        page.wait_for_timeout(170)

def main():
    with sync_playwright() as p:
        b = p.chromium.launch()

        # ── 1) 두 기준 해상도 실제 화면 ──────────────────────
        for w, h, tag in [(1366, 768, "1366x768"), (1920, 1080, "1920x1080")]:
            print(f"[{tag}]")
            page = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1).new_page()
            page.goto(BASE); page.wait_for_timeout(1000)
            play_a_bit(page, rounds=10)  # 최악 격자(4x6) 근처까지 진행시켜 최악 조건에서 찍는다
            cap(page, f"resolution_{tag}")
            page.close()

        # ── 2) 저장 손상 → 기본값 정상 실행 (전/후) ──────────
        print("[storage corruption]")
        page = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1).new_page()
        page.goto(BASE); page.wait_for_timeout(1000)
        # 정상 진행해서 최고 기록을 만들어 둔다 (망가뜨리기 전 상태를 보여주기 위해)
        play_a_bit(page, rounds=5)
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
        page.evaluate("() => window.__game.goTitle ? window.__game.goTitle() : null")
        page.wait_for_timeout(300)
        cap(page, "storage_before_normal")

        # localStorage를 깨뜨린다 (글자만 있는 값 — 카드4가 요구하는 손상 케이스 중 하나)
        page.evaluate("""() => {
          for (const k of Object.keys(localStorage)) {
            if (k.toLowerCase().includes('ooo') || k.toLowerCase().includes('odd')) {
              localStorage.setItem(k, 'abc');
            }
          }
        }""")
        page.reload(); page.wait_for_timeout(1200)
        cap(page, "storage_after_corrupted_still_works")

        page.close()
        b.close()
    print("완료 —", OUT)

main()
