"""
FoodLens 앱 아이콘 & 스플래시 이미지 생성기
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math
import os

OUT = "assets/images"
os.makedirs(OUT, exist_ok=True)

# ── 색상 팔레트 ──────────────────────────────────────
GREEN_DARK   = (30,  94,  44)   # #1E5E2C
GREEN_MID    = (56, 142,  60)   # #388E3C
GREEN_MAIN   = (76, 175,  80)   # #4CAF50
GREEN_LIGHT  = (200, 230, 201)  # #C8E6C9
ORANGE_WARM  = (255, 107,  53)  # #FF6B35
ORANGE_LIGHT = (255, 183, 100)  # #FFB764
AMBER        = (255, 160,   0)  # #FFA000
WHITE        = (255, 255, 255)
WHITE_SEMI   = (255, 255, 255, 200)
WHITE_DIM    = (255, 255, 255, 80)

def make_gradient_bg(size, c1, c2):
    """대각선 그라디언트 배경"""
    img = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(img)
    for i in range(size):
        r = int(c1[0] + (c2[0] - c1[0]) * i / size)
        g = int(c1[1] + (c2[1] - c1[1]) * i / size)
        b = int(c1[2] + (c2[2] - c1[2]) * i / size)
        draw.line([(i, 0), (i, size)], fill=(r, g, b, 255))
    return img

def draw_lens(draw, cx, cy, radius, color_outer, color_inner_glow):
    """카메라 렌즈 — 링 + 격자 + 내부 원"""
    # 격자선 (얇게)
    step = radius // 4
    for d in range(-radius, radius + step, step):
        # 수직
        x = cx + d
        if cx - radius <= x <= cx + radius:
            draw.line([(x, cy - radius), (x, cy + radius)], fill=(*color_outer[:3], 60), width=1)
        # 수평
        y = cy + d
        if cy - radius <= y <= cy + radius:
            draw.line([(cx - radius, y), (cx + radius, y)], fill=(*color_outer[:3], 60), width=1)

    # 바깥 링들 (3겹)
    for r, alpha, width in [(radius, 180, 4), (int(radius * 0.72), 140, 3), (int(radius * 0.44), 200, 4)]:
        draw.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            outline=(*color_outer[:3], alpha), width=width
        )

    # 내부 원 (warm glow)
    inner_r = int(radius * 0.3)
    draw.ellipse(
        [cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r],
        fill=(*color_inner_glow, 220)
    )

def draw_fork_knife(draw, cx, cy, size, color=(255, 255, 255, 210)):
    """포크 & 나이프 아이콘 (렌즈 오른쪽 아래 작은 크기)"""
    lw = max(2, size // 14)

    # 나이프 (왼쪽)
    kx = cx - size // 5
    top = cy - size // 2
    bot = cy + size // 2
    draw.line([(kx, top), (kx, bot)], fill=color, width=lw)
    # 나이프 날
    for i in range(size // 4):
        x_off = int((size // 6) * (i / (size // 4)) ** 0.5)
        y_pos = top + i
        draw.line([(kx, y_pos), (kx + x_off, y_pos)], fill=color, width=1)

    # 포크 (오른쪽)
    fx = cx + size // 5
    draw.line([(fx, top + size // 3), (fx, bot)], fill=color, width=lw)
    prong_count = 3
    prong_h = size // 4
    for i in range(prong_count):
        px = fx + (i - 1) * (size // 9)
        draw.line([(px, top), (px, top + prong_h)], fill=color, width=lw)
    # 포크 기저부
    draw.arc(
        [fx - size // 8, top + prong_h - size // 12,
         fx + size // 8, top + prong_h + size // 12],
        start=0, end=180, fill=color, width=lw
    )

# ═══════════════════════════════════════════════════════════
# 1. icon.png  (1024 × 1024)
# ═══════════════════════════════════════════════════════════
def make_icon(size=1024, path="assets/images/icon.png"):
    img = make_gradient_bg(size, GREEN_DARK, GREEN_MID)
    draw = ImageDraw.Draw(img, "RGBA")

    cx, cy = size // 2, size // 2
    lens_r = int(size * 0.38)

    draw_lens(draw, cx, cy, lens_r, WHITE, AMBER)

    # 포크·나이프 (렌즈 중심)
    draw_fork_knife(draw, cx, cy, int(size * 0.18))

    # 모서리 둥글게 (마스크)
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    radius = int(size * 0.22)
    mask_draw.rounded_rectangle([0, 0, size, size], radius=radius, fill=255)
    img.putalpha(mask)

    img.convert("RGBA").save(path)
    print(f"✅ {path}")

# ═══════════════════════════════════════════════════════════
# 2. adaptive-icon.png  (foreground, 1024 × 1024)
#    Android: foreground는 투명 배경 + 중앙 72% 안에 내용
# ═══════════════════════════════════════════════════════════
def make_adaptive_icon(size=1024, path="assets/images/adaptive-icon.png"):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img, "RGBA")

    cx, cy = size // 2, size // 2
    lens_r = int(size * 0.3)  # 72% 영역 안에 들어오도록 작게

    draw_lens(draw, cx, cy, lens_r, WHITE, AMBER)
    draw_fork_knife(draw, cx, cy, int(size * 0.15))

    img.save(path)
    print(f"✅ {path}")

# ═══════════════════════════════════════════════════════════
# 3. splash-icon.png  (스플래시용 — 더 큰 렌즈 + 텍스트 없음)
# ═══════════════════════════════════════════════════════════
def make_splash_icon(size=512, path="assets/images/splash-icon.png"):
    """
    스플래시는 흰 배경 위에 올려지므로 투명 배경 + 컬러 렌즈 아이콘
    """
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img, "RGBA")

    cx, cy = size // 2, size // 2
    lens_r = int(size * 0.44)

    # 배경 원 (그린 그라디언트 느낌 - 원형)
    for r in range(lens_r + 10, lens_r - 15, -1):
        alpha = int(180 * (1 - abs(r - lens_r) / 25))
        draw.ellipse([cx-r, cy-r, cx+r, cy+r], outline=(*GREEN_MAIN, alpha), width=2)

    # 렌즈 그리기
    draw_lens(draw, cx, cy, lens_r, GREEN_MAIN, ORANGE_WARM)
    draw_fork_knife(draw, cx, cy, int(size * 0.22), color=(*GREEN_DARK, 230))

    img.save(path)
    print(f"✅ {path}")

# ═══════════════════════════════════════════════════════════
# 4. favicon.png (256 × 256)
# ═══════════════════════════════════════════════════════════
def make_favicon(size=256, path="assets/images/favicon.png"):
    img = make_gradient_bg(size, GREEN_DARK, GREEN_MID)
    draw = ImageDraw.Draw(img, "RGBA")
    cx, cy = size // 2, size // 2
    lens_r = int(size * 0.38)
    draw_lens(draw, cx, cy, lens_r, WHITE, AMBER)
    draw_fork_knife(draw, cx, cy, int(size * 0.18))
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, size, size], radius=int(size * 0.22), fill=255)
    img.putalpha(mask)
    img.save(path)
    print(f"✅ {path}")

if __name__ == "__main__":
    make_icon()
    make_adaptive_icon()
    make_splash_icon()
    make_favicon()
    print("\n🎨 아이콘 생성 완료!")
