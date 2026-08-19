# 과제제출보고서.pdf 생성
#
# 문서를 따로 다시 쓰지 않고 기존 .md 파일을 읽어 묶는다.
# 문서를 고치면 이 스크립트를 다시 돌리기만 하면 되므로 내용이 갈라지지 않는다.
#
# 실행: pip install reportlab && python tools/build_report.py

import os, re, sys, glob
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Table, TableStyle, Image, PageBreak, KeepTogether)

sys.stdout.reconfigure(encoding='utf-8')
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

TITLE = "내가 설계한 미니게임 — 과제 제출 보고서"
GAME = "딱 하나 이상함"
URL = "https://stulss.github.io/odd-one-out/"
REPO = "https://github.com/stulss/odd-one-out"
OUT = "과제제출보고서.pdf"

# ── 한글 폰트 (없으면 만들지 않는다. 글자가 네모로 나오는 PDF는 제출물이 못 된다) ──
FONTS = [("KO", r"C:\Windows\Fonts\malgun.ttf"), ("KO-B", r"C:\Windows\Fonts\malgunbd.ttf")]
for name, path in FONTS:
    if not os.path.exists(path):
        sys.exit(f"한글 폰트를 찾을 수 없습니다: {path}")
    pdfmetrics.registerFont(TTFont(name, path))

INK, DIM, BRAND, LINE = colors.HexColor('#1B2027'), colors.HexColor('#5A6470'), \
                        colors.HexColor('#0F8F73'), colors.HexColor('#D7DDE4')

def S(name, size, leading, **kw):
    return ParagraphStyle(name, fontName=kw.pop('font', 'KO'), fontSize=size,
                          leading=leading, textColor=kw.pop('color', INK), **kw)

ST = {
    'h1':   S('h1', 20, 28, font='KO-B', spaceBefore=2, spaceAfter=10),
    'h2':   S('h2', 14, 21, font='KO-B', spaceBefore=14, spaceAfter=7, color=BRAND),
    'h3':   S('h3', 11.5, 18, font='KO-B', spaceBefore=10, spaceAfter=5),
    'p':    S('p', 9.5, 15.5, spaceAfter=5),
    'li':   S('li', 9.5, 15.5, leftIndent=10, bulletIndent=2, spaceAfter=3),
    'quote':S('quote', 9, 14.5, leftIndent=10, color=DIM, spaceAfter=5),
    'code': S('code', 8.5, 13, font='KO', backColor=colors.HexColor('#F2F5F8'),
              leftIndent=6, rightIndent=6, spaceAfter=6),
    'cap':  S('cap', 8, 12, color=DIM, alignment=1, spaceBefore=3),
    'cell': S('cell', 8.2, 12.5),
    'cellb':S('cellb', 8.2, 12.5, font='KO-B'),
}

def esc(t):
    t = t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t, flags=re.S)
    t = re.sub(r'`(.+?)`', r'<font face="KO-B">\1</font>', t)
    t = re.sub(r'\[(.+?)\]\((.+?)\)', r'\1', t)          # 링크는 글자만 남긴다
    t = re.sub(r'~~(.+?)~~', r'\1', t)
    t = t.replace('**', '')          # 짝이 안 맞고 남은 강조 기호는 지운다
    return t

BLOCK_START = re.compile(r'^(\s*[-*] |\s*\d+\. |#|>|\||```|---|\*\*\*|\s*$)')

def join_soft_wraps(md):
    """마크다운 원문은 가독성 때문에 문장 중간에서 줄을 접는다.
    그대로 문단으로 만들면 굵게 표시가 줄바꿈에 걸려 깨지므로 먼저 이어 붙인다."""
    out, i, lines, in_code = [], 0, md.split('\n'), False
    while i < len(lines):
        ln = lines[i]
        if ln.startswith('```'):
            in_code = not in_code
            out.append(ln); i += 1; continue
        if in_code:
            out.append(ln); i += 1; continue
        if re.match(r'^\s*[-*] |^\s*\d+\. ', ln):
            # 목록 항목: 다음 줄이 들여쓰기된 이어짐이면 합친다
            buf = ln.rstrip()
            while i + 1 < len(lines) and re.match(r'^\s{2,}\S', lines[i + 1]) \
                    and not BLOCK_START.match(lines[i + 1].strip()):
                i += 1; buf += ' ' + lines[i].strip()
            out.append(buf); i += 1; continue
        if BLOCK_START.match(ln):
            out.append(ln); i += 1; continue
        # 일반 문단: 다음 줄이 새 블록이 아니면 이어 붙인다
        buf = ln.rstrip()
        while i + 1 < len(lines) and lines[i + 1].strip() and not BLOCK_START.match(lines[i + 1]):
            i += 1; buf += ' ' + lines[i].strip()
        out.append(buf); i += 1
    return '\n'.join(out)

def md_to_flow(md, skip_h1=True):
    """마크다운을 PDF 요소로. 표·목록·인용·코드블록을 다룬다."""
    md = join_soft_wraps(md)
    out, i, lines = [], 0, md.split('\n')
    while i < len(lines):
        ln = lines[i]

        if ln.startswith('```'):                          # 코드블록
            i += 1; buf = []
            while i < len(lines) and not lines[i].startswith('```'):
                buf.append(lines[i]); i += 1
            i += 1
            if buf: out.append(Paragraph('<br/>'.join(esc(b) for b in buf), ST['code']))
            continue

        if ln.startswith('|') and i + 1 < len(lines) and re.match(r'^\|[\s:|-]+\|$', lines[i+1]):
            rows = []                                      # 표
            while i < len(lines) and lines[i].startswith('|'):
                if not re.match(r'^\|[\s:|-]+\|$', lines[i]):
                    rows.append([c.strip() for c in lines[i].strip('|').split('|')])
                i += 1
            if rows:
                ncol = max(len(r) for r in rows)
                rows = [r + [''] * (ncol - len(r)) for r in rows]
                data = [[Paragraph(esc(c), ST['cellb'] if ri == 0 else ST['cell'])
                         for c in r] for ri, r in enumerate(rows)]
                t = Table(data, colWidths=[(170*mm)/ncol]*ncol, repeatRows=1)
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#EEF3F7')),
                    ('GRID', (0,0), (-1,-1), 0.4, LINE),
                    ('VALIGN', (0,0), (-1,-1), 'TOP'),
                    ('LEFTPADDING', (0,0), (-1,-1), 4), ('RIGHTPADDING', (0,0), (-1,-1), 4),
                    ('TOPPADDING', (0,0), (-1,-1), 3), ('BOTTOMPADDING', (0,0), (-1,-1), 3),
                ]))
                out += [Spacer(1, 3), t, Spacer(1, 7)]
            continue

        if ln.startswith('#'):
            lvl = len(ln) - len(ln.lstrip('#'))
            txt = ln.lstrip('#').strip()
            if not (lvl == 1 and skip_h1):
                out.append(Paragraph(esc(txt), ST['h1' if lvl == 1 else 'h2' if lvl == 2 else 'h3']))
        elif ln.startswith('>'):
            out.append(Paragraph(esc(ln.lstrip('> ').strip()), ST['quote']))
        elif re.match(r'^\s*[-*] ', ln):
            out.append(Paragraph(esc(re.sub(r'^\s*[-*] ', '', ln)), ST['li'], bulletText='·'))
        elif re.match(r'^\s*\d+\. ', ln):
            out.append(Paragraph(esc(ln.strip()), ST['li']))
        elif ln.strip() in ('---', '***'):
            out.append(Spacer(1, 6))
        elif ln.strip():
            out.append(Paragraph(esc(ln.strip()), ST['p']))
        i += 1
    return out

def read(p):
    return open(p, encoding='utf-8').read() if os.path.exists(p) else ''

# ── 버튼 전/후 스크린샷 섹션 ────────────────────────────────
ACTIONS = [
    ("01_start",    "[▶ 시작하기] 버튼",  "타이틀 화면(규칙 노출)", "게임 시작 — 격자·타이머·점수 표시"),
    ("02_correct",  "정답 칸 선택",       "STAGE N 진행 중",        "STAGE 증가 + 점수 상승 + 새 격자"),
    ("03_wrong",    "오답 칸 선택",       "누르기 직전",            "해당 칸 빨강 + 남은 시간 1초 차감"),
    ("04_pause",    "[❙❙ 일시정지] 버튼", "진행 중",                "타이머 정지 + 일시정지 화면"),
    ("05_settings", "[⚙ 설정] 버튼",      "설정 열기 전",           "설정 시트 — 소리·움직임·난이도 T"),
    ("06_sound",    "[소리] 토글",        "소리 켜짐",              "소리 꺼짐 — 즉시 무음"),
    ("07_motion",   "[움직임 줄이기] 토글","움직임 보통",           "움직임 줄임 — 흔들림 대신 색 점멸"),
    ("08_gameover", "시간 초과 → 종료",   "진행 중 (시간 남음)",    "실패 표시 + 정답 공개 + 결과 카드"),
    ("09_share",    "[결과 공유] 버튼",   "누르기 전",              "네이티브 공유 없음 → 복사 버튼 노출"),
    ("10_restart",  "[다시 하기] 버튼",   "결과 화면",              "STAGE 1 · SCORE 0 초기화 (최고 기록 유지)"),
]

def action_section():
    flow = [Paragraph("버튼 동작 전 / 후", ST['h2']),
            Paragraph("조작 1회에 화면 상태가 실제로 바뀌는지를 전·후 두 장으로 확인합니다. "
                      "모든 사진은 공개 주소에서 390×844 해상도로 촬영했으며, "
                      "전·후 이미지가 동일하면 촬영 실패로 간주해 자동 검사합니다.", ST['p']),
            Spacer(1, 4)]
    missing = []
    for key, name, cap_b, cap_a in ACTIONS:
        pb, pa = f"img/actions/{key}_before.png", f"img/actions/{key}_after.png"
        if not (os.path.exists(pb) and os.path.exists(pa)):
            missing.append(key); continue
        w = 62*mm; h = w * 844 / 390
        t = Table([[Image(pb, w, h), Image(pa, w, h)],
                   [Paragraph("전 — " + cap_b, ST['cap']), Paragraph("후 — " + cap_a, ST['cap'])]],
                  colWidths=[w + 8*mm]*2)
        t.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP'),
                               ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                               ('BOTTOMPADDING', (0,0), (-1,0), 2)]))
        flow.append(KeepTogether([Paragraph(name, ST['h3']), t, Spacer(1, 8)]))
    if missing:
        flow.append(Paragraph("※ 스크린샷 누락: " + ", ".join(missing) +
                              " — tools/shot_actions.py 를 실행하세요.", ST['quote']))
    return flow

# ── 문서 조립 ───────────────────────────────────────────────
story = []
story += [Spacer(1, 45*mm),
          Paragraph(TITLE, ST['h1']),
          Paragraph(f"게임: 「{GAME}」", ST['p']),
          Spacer(1, 6),
          Paragraph(f"공개 주소: {URL}", ST['p']),
          Paragraph(f"소스 코드: {REPO}", ST['p']),
          Spacer(1, 10),
          Paragraph("프레임워크·빌드도구·이미지 파일·음원 파일 없이 "
                    "순수 HTML/CSS/JavaScript로 만든 브라우저 관찰력 게임입니다.", ST['quote']),
          PageBreak()]

for path in ['검증안내서.md']:
    story += md_to_flow(read(path)); story.append(PageBreak())

story += action_section(); story.append(PageBreak())

for path in ['AI_3줄.md', '트러블슈팅.md']:
    story += md_to_flow(read(path)); story.append(PageBreak())

story += md_to_flow(read('docs/06_프로젝트기록.md'))

# ── 페이지 번호 ─────────────────────────────────────────────
def footer(canv, doc):
    canv.saveState()
    canv.setFont('KO', 8); canv.setFillColor(DIM)
    canv.drawCentredString(A4[0]/2, 12*mm, f"{doc.page}")
    canv.setStrokeColor(LINE); canv.setLineWidth(0.4)
    canv.line(20*mm, 17*mm, A4[0]-20*mm, 17*mm)
    canv.restoreState()

doc = BaseDocTemplate(OUT, pagesize=A4,
                      leftMargin=20*mm, rightMargin=20*mm,
                      topMargin=18*mm, bottomMargin=22*mm, title=TITLE)
doc.addPageTemplates([PageTemplate(id='n',
    frames=[Frame(20*mm, 22*mm, A4[0]-40*mm, A4[1]-40*mm, id='f')], onPage=footer)])
doc.build(story)

print(f"생성 완료: {OUT}  ({os.path.getsize(OUT)/1024:.0f}KB)")
