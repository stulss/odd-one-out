import os, sys
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')
os.chdir(r"C:\Users\stuls\Desktop\developer stuls\odd-one-out")

JS = """
async () => {
  const S = await import('./src/stage.js');
  const out = [];
  for (const n of [5,10,15,20,25,30]) {
    const row = { n };
    let prev=null, st=null;
    for (const T of [3.6,4.4,5.4]) {
      prev=null;
      for (let i=1;i<=n;i++){ st = S.makeStage('DIAG', i, T, prev); prev=st; }
      row['T'+T] = +st.timeLimit.toFixed(2);
    }
    const spec = S.DIFF_AXES[st.axis];
    const room = Math.max(0, Math.min(1,(st.delta-spec.min)/Math.max(0.001,spec.easy-spec.min)));
    row.axis = st.axis;
    row.room = +room.toFixed(2);
    row.search = +(0.30 + 0.020*st.total + 1.80*(1-room)).toFixed(2);
    out.push(row);
  }
  return out;
}
"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context().new_page()
    pg.goto("https://stulss.github.io/odd-one-out/"); pg.wait_for_timeout(1200)
    rows=pg.evaluate(JS); b.close()

print(f"{'단계':>4} {'T=3.6':>7} {'T=4.4':>7} {'T=5.4':>7} {'모델 탐색시간':>12}  {'차이여유':>7}  축")
print("-"*62)
for r in rows:
    bind = "  ← 시간이 제약" if r['search'] > r['T5.4'] else ""
    print(f"{r['n']:>4} {r['T3.6']:>7.2f} {r['T4.4']:>7.2f} {r['T5.4']:>7.2f} {r['search']:>12.2f}  {r['room']:>7.2f}  {r['axis']}{bind}")
