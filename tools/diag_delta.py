import os, sys
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')
JS = """
async () => {
  const S = await import('./src/stage.js?v=2');
  const rows=[];
  for (const n of [5,10,15,20,25,30]) {
    const r={n};
    for (const T of [3.6,4.4,5.4]) {
      // 축마다 스케일이 달라 '지각 여유'(0~1)로 정규화해 비교한다
      let prev=null, st=null;
      for(let i=1;i<=n;i++){ st=S.makeStage('CMP',i,T,prev); prev=st; }
      const sp=S.DIFF_AXES[st.axis];
      r['T'+T]=+(((st.delta-sp.min)/(sp.easy-sp.min))*100).toFixed(0);
    }
    rows.push(r);
  }
  return rows;
}
"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context().new_page()
    pg.goto("https://odd-one-out-nine.vercel.app/"); pg.wait_for_timeout(1500)
    rows=pg.evaluate(JS); b.close()
print("차이 여유(%) — 낮을수록 어렵다. 0%면 지각 임계값(더 못 좁힘)")
print(f"{'단계':>4} {'T=3.6':>7} {'T=4.4':>7} {'T=5.4':>7}   {'3.6→5.4 차':>10}")
print("-"*46)
for r in rows:
    print(f"{r['n']:>4} {r['T3.6']:>6}% {r['T4.4']:>6}% {r['T5.4']:>6}%   {r['T3.6']-r['T5.4']:>9}%p")
