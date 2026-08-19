# 스크린샷 촬영 — 과제 최종보고서 제출용
#
# 촬영 규칙 (고정)
#   ① 01_title   첫 화면
#   ② 02_play    게임 진행 중 화면
#   ③ 03_result  종료 화면
# 위 3개 상태를 4개 해상도에서 각각 찍는다.
#
# Playwright를 쓰는 이유:
#   - 헤드리스 Chrome CLI는 --window-size보다 넓은 뷰포트로 레이아웃한 뒤 이미지를 잘라내서
#     360·390 같은 작은 해상도 스크린샷이 "게임판이 넘친 것처럼" 잘못 나왔다.
#   - Playwright는 뷰포트를 정확히 지정할 수 있고, 페이지 안에서 JS를 실행해
#     진행 중 / 종료 상태로 직접 몰아넣을 수 있다.
#
# 실행:  python shot.py            (step1 step2 step3)
#        python shot.py step4      (특정 단계만)

import os, sys, hashlib
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')   # 콘솔이 cp949라 한글 기호에서 죽는 것을 막는다

ROOT = os.path.abspath(".").replace("\\", "/")
SIZES = [("360x640", 360, 640), ("390x844", 390, 844),
         ("1366x768", 1366, 768), ("1920x1080", 1920, 1080)]
STEPS = sys.argv[1:] or ["step1", "step2", "step3"]

# 페이지 안에서 window.__stepN 훅을 찾는다 (단계마다 이름이 다르다)
FIND_HOOK = """() => {
  const k = Object.keys(window).find(x => /^__step\\d+$/.test(x));
  return k || null;
}"""

ADVANCE = """(n) => {
  const k = Object.keys(window).find(x => /^__step\\d+$/.test(x));
  const g = window[k];
  const cells = [...document.querySelectorAll('.cell')].filter(c => !c.hidden);
  const i = g.stage ? g.stage.answer : 0;
  cells[i]?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
}"""

def cap(page, path, note):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    page.screenshot(path=path)
    h = hashlib.md5(open(path, "rb").read()).hexdigest()[:8]
    size = os.path.getsize(path)
    print(f"    {note:10s} {size:7d}B  {h}")
    return h

def main():
    seen, missing = {}, []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--allow-file-access-from-files"])
        for st in STEPS:
            print(f"\n[{st}]")
            for name, w, h in SIZES:
                ctx = browser.new_context(viewport={"width": w, "height": h},
                                          device_scale_factor=1)
                page = ctx.new_page()
                page.goto(f"file:///{ROOT.replace(' ', '%20')}/{st}/index.html")
                page.wait_for_timeout(500)
                hook = page.evaluate(FIND_HOOK)
                if not hook:
                    print(f"  {name}: 훅을 찾지 못함 — 건너뜀")
                    ctx.close(); continue
                print(f"  {name}")
                base = os.path.join("shots", st, name)

                # ① 첫 화면 — 타이틀 오버레이가 있는 단계만 별도 상태다.
                has_title = page.evaluate(
                    "() => document.getElementById('app')?.dataset.screen === 'TITLE'")
                if has_title:
                    seen.setdefault(cap(page, f"{base}/01_title.png", "01_title"), []).append(f"{st}/{name}/title")
                else:
                    missing.append(f"{st}/{name} 01_title (이 단계에는 타이틀 화면이 없음)")
                    print("    01_title   없음 — 이 단계에는 타이틀 화면이 없다")

                # ② 진행 중 — 격자가 커진 상태를 찍어야 플레이 화면답다. 5단계 진행.
                page.evaluate(f"() => window.{hook}.newGame && window.{hook}.newGame()")
                page.wait_for_timeout(200)
                for _ in range(5):
                    page.evaluate(ADVANCE)
                    page.wait_for_timeout(180)   # 입력 잠금 120ms보다 길게
                seen.setdefault(cap(page, f"{base}/02_play.png", "02_play"), []).append(f"{st}/{name}/play")

                # ③ 종료 — 남은 시간을 모두 깎아 게임 오버로 만든다.
                has_timer = page.evaluate(f"() => !!(window.{hook}.timer)")
                if has_timer:
                    page.evaluate(f"() => window.{hook}.timer.penalty(999)")
                    page.wait_for_timeout(700)
                    seen.setdefault(cap(page, f"{base}/03_result.png", "03_result"), []).append(f"{st}/{name}/result")
                else:
                    missing.append(f"{st}/{name} 03_result (이 단계에는 타이머·종료가 없음)")
                    print("    03_result  없음 — 이 단계에는 종료 상태가 없다")

                ctx.close()
        browser.close()

    # 촬영 실패 검사: 서로 다른 화면인데 이미지가 같으면 실패다.
    # (과거에 12장 전부 오류 화면이었는데 스크립트가 전부 OK를 찍은 적이 있다)
    print(chr(10) + "=== 촬영 실패 검사 ===")
    dups = {k: v for k, v in seen.items() if len(v) > 1}
    if dups:
        print("!! 서로 다른 화면인데 이미지가 동일하다:")
        for k, v in dups.items():
            print("   ", k, "->", ", ".join(v))
    else:
        print(f"이상 없음 - {sum(len(v) for v in seen.values())}장 모두 서로 다른 이미지")

    if missing:
        print(chr(10) + "=== 해당 상태가 없는 단계 (정상) ===")
        for m in missing:
            print("   ", m)

main()
