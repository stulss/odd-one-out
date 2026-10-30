# PWA 아이콘 + OG 이미지 생성 — 게임 아이콘(index.html의 favicon)과 같은 도형을 그린다.
# 실행: python tools/make_icons.py   (Pillow 필요)
import os
from PIL import Image, ImageDraw, ImageFont

BG, BLUE, MINT, INK, DIM = '#0E1116', '#3D6BFF', '#5EE6C5', '#E8EDF4', '#8A94A6'
OUT = 'icons'
os.makedirs(OUT, exist_ok=True)
SS = 4  # 슈퍼샘플링 배율 (안티에일리어싱)

def mark(size, pad_ratio):
    """2x2 격자 + 한 칸만 10° 돌아간 민트색. pad_ratio = 바깥 여백 비율(maskable은 크게)."""
    S = size * SS
    im = Image.new('RGBA', (S, S), BG)
    pad = S * pad_ratio
    area = S - pad * 2
    gap = area * 0.10
    cell = (area - gap) / 2
    for r in range(2):
        for c in range(2):
            x, y = pad + c * (cell + gap), pad + r * (cell + gap)
            odd = (r, c) == (1, 1)
            layer = Image.new('RGBA', (int(cell) + 2, int(cell) + 2), (0, 0, 0, 0))
            d = ImageDraw.Draw(layer)
            d.rounded_rectangle([1, 1, int(cell), int(cell)], radius=cell * 0.2, fill=MINT if odd else BLUE)
            if odd:
                layer = layer.rotate(-10, resample=Image.BICUBIC, expand=True)
            im.alpha_composite(layer, (int(x - (layer.width - cell) / 2), int(y - (layer.height - cell) / 2)))
    return im.resize((size, size), Image.LANCZOS).convert('RGB')

mark(192, 0.17).save(f'{OUT}/icon-192.png')
mark(512, 0.17).save(f'{OUT}/icon-512.png')
mark(512, 0.30).save(f'{OUT}/icon-maskable-512.png')   # 안전영역(중앙 80%) 안에 들어가도록 여백 확대
mark(180, 0.17).save(f'{OUT}/apple-touch-icon.png')

# ── OG 이미지 1200×630 ──
def font(sz):
    for p in ('C:/Windows/Fonts/malgunbd.ttf', 'C:/Windows/Fonts/malgun.ttf'):
        if os.path.exists(p): return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

W, H = 1200, 630
og = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(og)
d.rectangle([24, 24, W - 25, H - 25], outline='#1d4a40', width=3)
# 오른쪽: 5x4 격자, 한 칸만 다름
cols, rows, cell, gap = 5, 4, 70, 14
gw = cols * cell + (cols - 1) * gap
gh = rows * cell + (rows - 1) * gap
x0, y0 = W - gw - 90, (H - gh) // 2
for r in range(rows):
    for c in range(cols):
        x, y = x0 + c * (cell + gap), y0 + r * (cell + gap)
        if (r, c) == (1, 3):
            layer = Image.new('RGBA', (cell + 20, cell + 20), (0, 0, 0, 0))
            ImageDraw.Draw(layer).rounded_rectangle([10, 10, 10 + cell, 10 + cell], radius=14, fill=MINT)
            layer = layer.rotate(-12, resample=Image.BICUBIC)
            og.paste(layer, (x - 10, y - 10), layer)
        else:
            d.rounded_rectangle([x, y, x + cell, y + cell], radius=14, fill=BLUE)
d.text((90, 190), '딱 하나', font=font(120), fill=INK)
d.text((90, 330), '이상함', font=font(120), fill=MINT)
d.text((94, 485), '여러 개 중 딱 하나만 다릅니다. 찾을 수 있나요?', font=font(34), fill=DIM)
og.save('og-image.png', optimize=True)
for f in sorted(os.listdir(OUT)) + ['../og-image.png']:
    p = os.path.join(OUT, f); print(f, os.path.getsize(p))
