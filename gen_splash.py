"""
FoodLens 스플래시 & 아이콘 생성
소스: logo_source.jpg (1194×768 가로형 전체 로고 이미지)
"""
from PIL import Image, ImageDraw
import os

SRC = r"D:\Claude-code-app\FoodLens\logo_source.jpg"
OUT = r"D:\Claude-code-app\FoodLens\assets\images"

src = Image.open(SRC).convert("RGBA")
W, H = src.size
print(f"원본: {W}x{H}")

# ── 배경색 (원본 이미지 배경과 일치: 크림화이트) ──────────────────────────
BG = (250, 247, 244)

# ── 원형 로고 영역 크롭 (아이콘용) ────────────────────────────────────────
# 1194×768 기준: 원 중심 약 (490, 307), 반지름 약 252px
cx = int(W * 0.408)
cy = int(H * 0.385)
r  = int(H * 0.295)

box = (max(0, cx-r), max(0, cy-r), min(W, cx+r), min(H, cy+r))
logo_raw = src.crop(box)
LS = r * 2

# 원형 마스크
circle_mask = Image.new("L", (LS, LS), 0)
ImageDraw.Draw(circle_mask).ellipse([0, 0, LS, LS], fill=255)
logo_raw_sq = logo_raw.resize((LS, LS), Image.LANCZOS)
logo_raw_sq.putalpha(circle_mask)

# ─────────────────────────────────────────────────────
# 1. icon.png  1024×1024
# ─────────────────────────────────────────────────────
IS = 1024
icon = Image.new("RGBA", (IS, IS), (*BG, 255))
logo_sz = int(IS * 0.82)
logo_r = logo_raw_sq.resize((logo_sz, logo_sz), Image.LANCZOS)
ox = (IS - logo_sz) // 2
oy = (IS - logo_sz) // 2
icon.paste(logo_r, (ox, oy), logo_r)
# 둥근 모서리
rmask = Image.new("L", (IS, IS), 0)
ImageDraw.Draw(rmask).rounded_rectangle([0, 0, IS, IS], radius=int(IS*0.22), fill=255)
icon.putalpha(rmask)
icon.save(os.path.join(OUT, "icon.png"))
print("icon.png ✓")

# ─────────────────────────────────────────────────────
# 2. splash-icon.png  1080×1920
# 전체 로고 이미지를 폭 기준 스케일 후 세로 중앙 배치
# ─────────────────────────────────────────────────────
SW, SH = 1080, 1920
splash = Image.new("RGBA", (SW, SH), (*BG, 255))

scale = SW / W
scaled_h = int(H * scale)   # ≈ 694
scaled = src.resize((SW, scaled_h), Image.LANCZOS)

# 세로 중앙보다 약간 위 (40% 지점)
sy = int((SH - scaled_h) * 0.40)
splash.paste(scaled, (0, sy), scaled)

splash.convert("RGB").save(os.path.join(OUT, "splash-icon.png"), quality=95)
print("splash-icon.png ✓")

# ─────────────────────────────────────────────────────
# 3. adaptive-icon.png  Android 포그라운드 (투명 배경)
# ─────────────────────────────────────────────────────
AI = 1024
adi = Image.new("RGBA", (AI, AI), (0, 0, 0, 0))
al = int(AI * 0.76)
adi_logo = logo_raw_sq.resize((al, al), Image.LANCZOS)
ao = (AI - al) // 2
adi.paste(adi_logo, (ao, ao), adi_logo)
adi.save(os.path.join(OUT, "adaptive-icon.png"))
print("adaptive-icon.png ✓")

# ─────────────────────────────────────────────────────
# 4. favicon.png  256×256
# ─────────────────────────────────────────────────────
fav = Image.new("RGBA", (256, 256), (*BG, 255))
fl = 210
fav_logo = logo_raw_sq.resize((fl, fl), Image.LANCZOS)
fav.paste(fav_logo, ((256-fl)//2, (256-fl)//2), fav_logo)
fmask = Image.new("L", (256, 256), 0)
ImageDraw.Draw(fmask).rounded_rectangle([0, 0, 256, 256], radius=56, fill=255)
fav.putalpha(fmask)
fav.save(os.path.join(OUT, "favicon.png"))
print("favicon.png ✓")

print("\n완료!")
