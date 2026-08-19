# 자동 플레이 시뮬레이션 — 난이도 상수 T 비교
#
# ⚠ 이 데이터는 사람이 플레이한 기록이 아니다.
#    과제가 요구하는 "10회 플레이 기록"으로 제출하면 안 된다.
#    용도는 하나뿐: **T를 바꾸면 난이도가 실제로 달라지는가**를 확인하는 설계 점검.
#
# 방식
#   - 실제 게임의 스테이지 생성기(src/stage.js)를 그대로 불러 쓴다.
#     즉 격자 크기·차이 축·delta·제한 시간은 진짜 게임과 완전히 같다.
#   - 사람 대신 아래 반응 모델이 판정한다. 이 모델의 계수가 절대 난이도를 좌우하므로
#     "몇 단계까지 갔는가"의 절대값은 의미가 없고, **T끼리의 상대 비교만** 의미가 있다.
#
# 반응 모델 (명시)
#   탐색시간 = 0.30초 + 0.020 × 칸수 + 1.80초 × (1 - 차이여유)
#     · 차이여유 = (delta - 지각임계값) / (easy - 지각임계값), 0~1
#     · 칸이 많을수록, 차이가 미묘할수록 오래 걸린다
#   실제반응 = 탐색시간 × (1 + 정규분포(0, 0.22))      ← 흔들림
#   오답확률 = 0.05 + 0.25 × (1 - 차이여유)            ← 오답 시 남은 시간 1초 차감
#   반응 > 남은시간 이면 그 판은 끝난다.
#
# 실행: python tools/sim_difficulty.py [T값들...]   기본: 4.4 5.4

import os, sys, json, csv
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE = "https://stulss.github.io/odd-one-out/"
RUNS = 10                                   # T당 판 수
TS = [float(x) for x in sys.argv[1:]] or [4.4, 5.4]

SIM = """
async ([T, runs, seedBase]) => {
  const S = await import('./src/stage.js');

  // 재현 가능한 난수 (시뮬레이션 자체도 같은 시드면 같은 결과가 나와야 한다)
  const mulberry32 = a => () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = r => { // Box-Muller
    let u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const rows = [];
  for (let run = 0; run < runs; run++) {
    const rnd = mulberry32(seedBase + run * 7919);
    const key = 'SIM-' + T.toFixed(1) + '-' + run;
    let n = 1, prev = null, survived = 0, reason = 'timeout';

    for (;;) {
      const st = S.makeStage(key, n, T, prev);
      prev = st;
      const spec = S.DIFF_AXES[st.axis];
      // 차이여유: 지각 임계값에 가까울수록 0
      const room = Math.max(0, Math.min(1,
        (st.delta - spec.min) / Math.max(0.001, spec.easy - spec.min)));

      let left = st.timeLimit;
      let cleared = false;
      for (let attempt = 0; attempt < 6; attempt++) {
        const search = 0.30 + 0.020 * st.total + 1.80 * (1 - room);
        const react = Math.max(0.12, search * (1 + gauss(rnd) * 0.22));
        if (react > left) { left = 0; break; }
        left -= react; survived += react;
        const missP = 0.05 + 0.25 * (1 - room);
        if (rnd() < missP) { left -= 1.0; if (left <= 0) break; continue; }  // 오답: 1초 차감
        cleared = true; break;
      }
      if (!cleared) { reason = 'timeout'; break; }
      n++;
      if (n > 200) { reason = 'cap'; break; }   // 안전장치
    }
    rows.push({ t: T, run: run + 1, stages: n - 1, sec: +survived.toFixed(1), reason });
  }
  return rows;
}
"""

def median(a):
    if not a: return 0
    s = sorted(a); m = len(s) // 2
    return s[m] if len(s) % 2 else (s[m-1] + s[m]) / 2

def main():
    all_rows = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_context().new_page()
        page.goto(BASE); page.wait_for_timeout(1200)
        for T in TS:
            rows = page.evaluate(SIM, [T, RUNS, 20260820])
            all_rows += rows
            st = [r['stages'] for r in rows]
            print(f"\n[T = {T}]  {RUNS}판")
            print("  판별 도달 단계:", st)
            print(f"  중앙값 {median(st)}단계 · 평균 {sum(st)/len(st):.1f} · "
                  f"최소 {min(st)} · 최대 {max(st)}")
        b.close()

    os.makedirs("docs", exist_ok=True)
    out = "docs/자동플레이_난이도비교.csv"
    with open(out, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["난이도T", "회차", "도달단계", "생존시간초", "종료사유", "구분"])
        for r in all_rows:
            w.writerow([r['t'], r['run'], r['stages'], r['sec'], r['reason'], "자동플레이(사람아님)"])

    print("\n=== 비교 ===")
    for T in TS:
        st = [r['stages'] for r in all_rows if r['t'] == T]
        sec = [r['sec'] for r in all_rows if r['t'] == T]
        print(f"  T={T}: 중앙값 {median(st)}단계 / 생존 {median(sec):.1f}초")
    a, z = TS[0], TS[-1]
    ma = median([r['stages'] for r in all_rows if r['t'] == a])
    mz = median([r['stages'] for r in all_rows if r['t'] == z])
    if ma == mz:
        print(f"\n  !! T를 {a} → {z}로 바꿔도 중앙값이 {ma}단계로 같다.")
        print("     난이도 상수가 실제로는 난이도를 바꾸지 않는다는 뜻이므로 설계를 확인해야 한다.")
    else:
        print(f"\n  T {a} → {z} 로 바꾸면 중앙값이 {ma} → {mz}단계로 변한다. "
              f"난이도 상수가 실제로 작동한다.")
    print(f"\n기록 저장: {out}")
    print("※ 이 수치는 자동 플레이다. 과제의 '10회 플레이 기록'으로 제출하지 말 것.")

main()
