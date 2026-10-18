"""Render the homepage share image (public/og-home-2026-10.jpg, 1200x630).

Needs: /tmp/zbi-1024.png (3BI mark render), Space Grotesk, Inter, JetBrains Mono TTFs in /tmp.
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 630
BG = (3, 11, 18)
INK = (230, 237, 243)
MUTED = (139, 157, 173)
CYAN = (6, 182, 212)
CARD = (10, 22, 32)
LINE = (24, 48, 60)


def font(path, size, wght):
    f = ImageFont.truetype(path, size)
    try:
        f.set_variation_by_axes([wght] if "Inter" not in path else [14 if size < 20 else 28, wght])
    except Exception:
        pass
    return f


SG = "/tmp/SpaceGrotesk-Bold.ttf"
IN = "/tmp/Inter.ttf"
JB = "/tmp/JBM.ttf"

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)
# grid
for x in range(0, W, 40):
    d.line([(x, 0), (x, H)], fill=(9, 22, 32))
for y in range(0, H, 40):
    d.line([(0, y), (W, y)], fill=(9, 22, 32))
# glow
glow = Image.new("RGB", (W, H), (0, 0, 0))
ImageDraw.Draw(glow).ellipse([700, -150, 1350, 520], fill=(0, 70, 90))
glow = glow.filter(ImageFilter.GaussianBlur(140))
img = Image.blend(img, Image.composite(glow, img, Image.new("L", (W, H), 0)), 0)
img = Image.fromarray(__import__("numpy").clip(
    __import__("numpy").asarray(img, dtype="int16") + __import__("numpy").asarray(glow, dtype="int16"), 0, 255).astype("uint8"))
d = ImageDraw.Draw(img)

L = 72
# logo + wordmark
mark = Image.open("/tmp/zbi-1024.png").convert("RGBA").resize((76, 76), Image.LANCZOS)
img.paste(mark, (L, 64), mark)
d.text((L + 96, 76), "SixVox", font=font(SG, 40, 700), fill=INK)
wx = L + 96 + d.textlength("SixVox", font=font(SG, 40, 700)) + 12
d.text((wx, 92), "by", font=font(SG, 20, 400), fill=MUTED)
d.text((wx + 28, 90), "3BI", font=font(SG, 22, 500), fill=MUTED)

# eyebrow
d.text((L, 196), "BUSINESS PHONE · SHARED INBOX · AI RECEPTIONIST", font=font(JB, 16, 500), fill=CYAN)
# headline
h = font(SG, 60, 700)
y = 236
d.text((L, y), "The business line", font=h, fill=INK)
d.text((L, y + 70), "that ", font=h, fill=INK)
d.text((L + d.textlength("that ", font=h), y + 70), "picks up", font=h, fill=CYAN)
d.text((L, y + 140), "when you can't.", font=h, fill=INK)

# bottom strip
pill = font(SG, 24, 700)
txt = "From $29/mo"
tw = d.textlength(txt, font=pill)
d.rounded_rectangle([L, 512, L + tw + 40, 562], radius=10, fill=CYAN)
d.text((L + 20, 523), txt, font=pill, fill=BG)
d.text((L + tw + 64, 524), "sixvox.3bi.io", font=font(JB, 22, 500), fill=MUTED)

# phone card
px, py, pw, ph = 846, 70, 282, 500
d.rounded_rectangle([px, py, px + pw, py + ph], radius=38, fill=CARD, outline=LINE, width=3)
d.rounded_rectangle([px + pw // 2 - 40, py + 16, px + pw // 2 + 40, py + 28], radius=6, fill=LINE)
cx = px + pw // 2
d.text((cx, py + 70), "INCOMING CALL", font=font(JB, 13, 500), fill=CYAN, anchor="mm")
for r, a in ((70, 40), (56, 80)):
    d.ellipse([cx - r, py + 170 - r, cx + r, py + 170 + r], outline=(6, 182 * a // 100 + 40, 212 * a // 100 + 30), width=2)
d.ellipse([cx - 42, py + 128, cx + 42, py + 212], fill=CYAN)
d.text((cx, py + 170), "JM", font=font(SG, 28, 700), fill=BG, anchor="mm")
d.text((cx, py + 262), "(580) 555-0142", font=font(SG, 24, 700), fill=INK, anchor="mm")
d.text((cx, py + 294), "Leak under kitchen sink", font=font(IN, 16, 400), fill=MUTED, anchor="mm")
# chip
chip = "AI answered · booked 9am"
cf = font(IN, 15, 600)
cw = d.textlength(chip, font=cf)
d.rounded_rectangle([cx - cw / 2 - 16, py + 330, cx + cw / 2 + 16, py + 364], radius=17, outline=CYAN, width=2, fill=(6, 40, 52))
d.text((cx, py + 347), chip, font=cf, fill=CYAN, anchor="mm")
# buttons
d.ellipse([px + 54, py + 400, px + 118, py + 464], fill=(190, 60, 70))
d.ellipse([px + pw - 118, py + 400, px + pw - 54, py + 464], fill=(16, 185, 129))

img.save("public/og-home-2026-10.jpg", quality=88, optimize=True, progressive=True)
print("ok")
