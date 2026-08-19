# 버튼 동작 전/후 스크린샷 — 과제제출보고서용
#
# "조작 1회에 화면 상태가 바뀐다"를 증명하려면 말보다 전/후 두 장이 낫다.
# 각 조작마다 누르기 직전과 직후를 같은 조건에서 찍는다.
#
# 실행: python tools/shot_actions.py            (배포된 공개 주소에서 촬영)
#       python tools/shot_actions.py local      (로컬 서버 http://localhost:8124)

import os, sys, hashlib
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

LIVE = "https://stulss.github.io/odd-one-out/"
LOCAL = "http://localhost:8124/"
BASE = LOCAL if (len(sys.argv) > 1 and sys.argv[1] == 'local') else LIVE
OUT = os.path.join("img", "actions")
W, H = 390, 844          # 세로형. 전/후를 나란히 놓기 좋고 UI가 통째로 들어온다.

os.makedirs(OUT, exist_ok=True)
shots = []

def cap(page, name, note):
    path = os.path.join(OUT, name + ".png")
    page.screenshot(path=path)
    h = hashlib.md5(open(path, "rb").read()).hexdigest()[:8]
    shots.append((name, h, os.path.getsize(path)))
    print(f"  {name:28s} {os.path.getsize(path):7d}B  {h}  {note}")

def play(page, n):
    """정답을 n번 눌러 스테이지를 진행시킨다."""
    for _ in range(n):
        page.evaluate("""() => {
          const g = window.__game;
          const cells = [...document.querySelectorAll('.cell')].filter(c => !c.hidden);
          cells[g.run.stage.answer]?.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}));
        }""")
        page.wait_for_timeout(180)

def start(page):
    page.evaluate("() => window.__game.newGame()")
    page.wait_for_timeout(150)
    # 자동 일시정지가 걸렸으면 푼다 (헤드리스는 포커스가 없을 수 있다)
    page.evaluate("""() => {
      if (document.getElementById('app').dataset.screen === 'PAUSED') window.__game.togglePause();
    }""")
    page.wait_for_timeout(100)

def main():
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": W, "height": H}, device_scale_factor=1)
        ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=BASE.rstrip("/"))
        page = ctx.new_page()
        page.goto(BASE); page.wait_for_timeout(1200)
        print(f"[대상] {BASE}\n")

        # ── 1. 시작하기 ─────────────────────────────────────
        print("1. [시작하기] 버튼")
        cap(page, "01_start_before", "타이틀 화면 — 규칙이 보인다")
        page.click("#btnStart"); page.wait_for_timeout(400)
        page.evaluate("""() => { if (document.getElementById('app').dataset.screen === 'PAUSED')
                                   window.__game.togglePause(); }""")
        page.wait_for_timeout(150)
        cap(page, "01_start_after", "게임 시작 — 격자와 타이머")

        # ── 2. 정답 선택 ────────────────────────────────────
        print("2. 정답 칸 선택")
        start(page); play(page, 3)
        stage_before = page.evaluate("() => window.__game.run.n")
        cap(page, "02_correct_before", f"STAGE {stage_before} 진행 중")
        play(page, 1)
        stage_after = page.evaluate("() => window.__game.run.n")
        cap(page, "02_correct_after", f"STAGE {stage_after} 로 증가, 점수 상승")

        # ── 3. 오답 선택 ────────────────────────────────────
        print("3. 오답 칸 선택")
        cap(page, "03_wrong_before", "누르기 직전")
        page.evaluate("""() => {
          const g = window.__game, s = g.run.stage;
          const cells = [...document.querySelectorAll('.cell')].filter(c => !c.hidden);
          cells[(s.answer + 1) % s.total].dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}));
        }""")
        page.wait_for_timeout(90)     # 흔들림 애니메이션이 살아 있는 시점
        cap(page, "03_wrong_after", "해당 칸 빨강 + 남은 시간 1초 차감")

        # ── 4. 일시정지 ─────────────────────────────────────
        print("4. [❙❙ 일시정지] 버튼")
        start(page); play(page, 2)
        cap(page, "04_pause_before", "진행 중")
        page.click("#btnPause"); page.wait_for_timeout(350)
        cap(page, "04_pause_after", "타이머 정지 + 일시정지 화면")

        # ── 5. 설정 열기 ────────────────────────────────────
        print("5. [⚙ 설정] 버튼")
        page.evaluate("() => window.__game.togglePause()"); page.wait_for_timeout(200)
        cap(page, "05_settings_before", "설정 열기 전")
        page.click("#btnSettings"); page.wait_for_timeout(350)
        cap(page, "05_settings_after", "설정 시트 — 소리·움직임·난이도 T")

        # ── 6. 음소거 ───────────────────────────────────────
        print("6. [소리] 토글")
        cap(page, "06_sound_before", "소리 켜짐 (체크됨)")
        page.click("#optSound"); page.wait_for_timeout(300)
        cap(page, "06_sound_after", "소리 꺼짐 — 즉시 무음")

        # ── 7. 움직임 줄이기 ────────────────────────────────
        print("7. [움직임 줄이기] 토글")
        cap(page, "07_motion_before", "움직임 보통")
        page.click("#optMotion"); page.wait_for_timeout(300)
        cap(page, "07_motion_after", "움직임 줄임 — 흔들림 대신 색 점멸")
        page.click("#optSound"); page.click("#optMotion")   # 원상 복구
        page.wait_for_timeout(200)

        # ── 7b. 난이도 T 변경 ───────────────────────────────
        # 과제 카드 3: "현재 난이도 규칙과 선택한 값이 화면에 보인다"
        print("7b. [난이도 T] 슬라이더")
        page.evaluate("() => window.__game.setSetting('tuneT', 4.4)"); page.wait_for_timeout(200)
        cap(page, "07b_tune_before", "난이도 T = 4.4 (기본값)")
        page.evaluate("""() => {
          const el = document.getElementById('tuneOut2');
          el.value = 5.4;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }""")
        page.wait_for_timeout(350)
        cap(page, "07b_tune_after", "난이도 T = 5.4 — 설정과 하단 상태줄이 함께 바뀜")
        page.evaluate("() => window.__game.setSetting('tuneT', 4.4)"); page.wait_for_timeout(200)
        page.click("#btnCloseSettings"); page.wait_for_timeout(250)

        # ── 8. 종료 (시간 초과) ─────────────────────────────
        print("8. 시간 초과 → 종료")
        start(page); play(page, 3)
        cap(page, "08_gameover_before", "진행 중 (시간 남음)")
        page.evaluate("""() => {
          const g = window.__game, s = g.run.stage;
          const cells = [...document.querySelectorAll('.cell')].filter(c => !c.hidden);
          for (let i = 0; i < 14; i++)
            cells[(s.answer + 1) % s.total].dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}));
        }""")
        for _ in range(30):
            page.wait_for_timeout(300)
            if page.evaluate("() => document.getElementById('app').dataset.screen") == 'RESULT':
                break
        page.wait_for_timeout(600)
        cap(page, "08_gameover_after", "실패 — 시간 초과 + 정답 위치 공개 + 결과 카드")

        # ── 9. 결과 공유 ────────────────────────────────────
        print("9. [결과 공유] 버튼")
        cap(page, "09_share_before", "공유 누르기 전")
        page.click("#btnShare"); page.wait_for_timeout(700)
        cap(page, "09_share_after", "PC는 네이티브 공유 없음 → 복사 버튼 노출")

        # ── 10~12. 공유 폴백 3버튼 ──────────────────────────
        # 네이티브 공유가 없는 환경에서 실제로 무엇을 할 수 있는지 보여준다.
        for key, sel, name, after in [
            ("10_copytext", "#fbCopyText", "[텍스트 복사] 버튼", "클립보드 복사 + '복사했습니다' 안내"),
            ("11_copyurl",  "#fbCopyUrl",  "[링크 복사] 버튼",   "도전장 링크 복사 + 안내"),
            ("12_saveimg",  "#fbSaveImg",  "[이미지 저장] 버튼", "결과 카드 PNG 저장 + 안내"),
        ]:
            print(f"{key[:2]}. {name}")
            page.evaluate("() => document.getElementById('toast').classList.remove('show')")
            page.wait_for_timeout(200)
            cap(page, key + "_before", "누르기 전")
            page.click(sel)
            page.wait_for_timeout(320)      # 안내 문구가 떠 있는 동안
            cap(page, key + "_after", after)

        # ── 13. 다시 하기 ───────────────────────────────────
        print("13. [다시 하기] 버튼")
        cap(page, "13_restart_before", "결과 화면 (도달 단계·점수)")
        page.click("#btnRestart"); page.wait_for_timeout(500)
        page.evaluate("""() => { if (document.getElementById('app').dataset.screen === 'PAUSED')
                                   window.__game.togglePause(); }""")
        page.wait_for_timeout(200)
        cap(page, "13_restart_after", "STAGE 1 · SCORE 0 초기화 (최고 기록은 유지)")

        # ── 14. 처음으로 ────────────────────────────────────
        # 종료 화면에서 [처음으로]를 누르면 타이틀로 돌아간다.
        print("14. [처음으로] 버튼")
        start(page); play(page, 2)
        page.evaluate("""() => {
          const g = window.__game, s = g.run.stage;
          const cells = [...document.querySelectorAll('.cell')].filter(c => !c.hidden);
          for (let i = 0; i < 14; i++)
            cells[(s.answer + 1) % s.total].dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}));
        }""")
        for _ in range(30):
            page.wait_for_timeout(300)
            if page.evaluate("() => document.getElementById('app').dataset.screen") == 'RESULT':
                break
        page.wait_for_timeout(500)
        cap(page, "14_home_before", "게임 종료 화면")
        page.click("#btnResultTitle"); page.wait_for_timeout(500)
        cap(page, "14_home_after", "타이틀 복귀 — 규칙 노출 + 최고 기록 표시")

        b.close()

    # 촬영 실패 검사 — 전/후가 같은 이미지면 "화면이 안 바뀐 것"이므로 반드시 잡아야 한다
    print("\n=== 전/후 변화 검사 ===")
    d = dict((n, h) for n, h, _ in shots)
    bad = []
    for n in d:
        if n.endswith('_before'):
            a = n.replace('_before', '_after')
            if a in d and d[n] == d[a]:
                bad.append(n.replace('_before', ''))
    if bad:
        print("!! 전/후가 동일한 항목 (화면이 바뀌지 않았다):")
        for x in bad: print("   ", x)
    else:
        print(f"이상 없음 - {len(shots)}장, 모든 전/후 쌍이 서로 다름")

main()
