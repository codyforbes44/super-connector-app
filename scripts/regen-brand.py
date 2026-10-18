"""Regenerate every SixVox brand asset from the 3BI mark.

Prerequisites (render before running):
  nix run nixpkgs#resvg -- --width 1024 --height 1024 \
    <(sed 's/viewBox="0 0 64 64"/viewBox="-3 -3 70 70"/' src/assets/sixvox-logo.svg) /tmp/zbi-1024.png
  # white monochrome variant (rounded-square outline + dot) -> /tmp/zbi-mono-512.png
  # Space Grotesk variable TTF (fonts.google.com) -> /tmp/SpaceGrotesk-Bold.ttf
Regenerates: favicons, PWA icons, maskable, monochrome, Android launcher/notification/status,
iOS AppIcons, mobile app icons, apple splashes, OG images, and Play feature graphic.
"""
from PIL import Image, ImageDraw, ImageFont
import os, glob, shutil

MARK = Image.open("/tmp/zbi-1024.png").convert("RGBA")
MONO = Image.open("/tmp/zbi-mono-512.png").convert("RGBA")
FONT = "/tmp/SpaceGrotesk-Bold.ttf"
TILE_BG = (5, 10, 16, 255)      # #050A10
SPLASH_BG = (3, 11, 18, 255)    # #030B12
OUT = "/tmp/newicons"
os.makedirs(OUT, exist_ok=True)
for f in glob.glob(OUT + "/*.png"):
    os.remove(f)
P = OUT + "/"


def canvas(size, bg=None):
    return Image.new("RGBA", (size, size), bg if bg else (0, 0, 0, 0))


def paste_frac(cv, img, frac):
    s = int(min(cv.size) * frac)
    im = img.resize((s, s), Image.LANCZOS)
    cv.alpha_composite(im, ((cv.width - s) // 2, (cv.height - s) // 2))
    return cv


def tile_icon(size, frac=0.92):
    return paste_frac(canvas(size, TILE_BG), MARK, frac)


def circular(cv):
    m = Image.new("L", cv.size, 0)
    ImageDraw.Draw(m).ellipse((0, 0, cv.width - 1, cv.height - 1), fill=255)
    out = Image.new("RGBA", cv.size, (0, 0, 0, 0))
    out.paste(cv, (0, 0), m)
    return out


# 1. Web favicons
for s in [16, 32, 48, 64, 96, 180, 192, 512]:
    MARK.resize((s, s), Image.LANCZOS).save(P + f"favicon-{s}x{s}.png")
MARK.resize((64, 64), Image.LANCZOS).save(P + "favicon.png")
imgs = [MARK.resize((s, s), Image.LANCZOS) for s in [16, 32, 48, 64, 128, 256]]
imgs[0].save(P + "favicon.ico", format="ICO",
             sizes=[(s, s) for s in [16, 32, 48, 64, 128, 256]], append_images=imgs[1:])

# 2. apple-touch + PWA icons
for s in [120, 152, 167, 180]:
    tile_icon(s).save(P + f"apple-touch-icon-{s}.png")
tile_icon(180).save(P + "apple-touch-icon.png")
for s in [72, 96, 128, 144, 152, 167, 180, 192, 256, 384, 512]:
    tile_icon(s).save(P + f"icon-{s}.png")

# 3. maskable
for s in [72, 96, 128, 144, 152, 192, 256, 384, 512]:
    paste_frac(canvas(s, TILE_BG), MARK, 0.62).save(P + f"icon-maskable-{s}.png")

# 4. monochrome
paste_frac(canvas(512), MONO, 0.82).save(P + "icon-monochrome-512.png")

# 5. Android
for d, s in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    tile_icon(s).save(P + f"ic_launcher-{d}.png")
    circular(tile_icon(s)).save(P + f"ic_launcher_round-{d}.png")
    paste_frac(canvas(s), MARK, 0.55).save(P + f"ic_notification_large-{d}.png")
for d, s in {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}.items():
    paste_frac(canvas(s), MARK, 0.55).save(P + f"ic_launcher_foreground-{d}.png")
    canvas(s, TILE_BG).convert("RGB").save(P + f"ic_launcher_background-{d}.png")
for d, s in {"mdpi": 24, "hdpi": 36, "xhdpi": 48, "xxhdpi": 72, "xxxhdpi": 96}.items():
    paste_frac(canvas(s), MONO, 0.62).save(P + f"ic_stat_sixvox-{d}.png")

# 6. iOS
tile_icon(1024).save(P + "ios-dark.png")
paste_frac(canvas(1024, (255, 255, 255, 255)), MARK, 0.92).save(P + "ios-light.png")
paste_frac(canvas(1024, TILE_BG), MONO, 0.80).save(P + "ios-tinted.png")
for s in [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180]:
    tile_icon(s).save(P + f"AppIcon-{s}.png")

# 7. Mobile app
tile_icon(1024).save(P + "m-icon.png")
paste_frac(canvas(1024), MARK, 0.55).save(P + "m-adaptive.png")

# install into project
shutil.copy(P + "ios-dark.png", "public/ios/AppIcon-1024-dark.png")
shutil.copy(P + "ios-light.png", "public/ios/AppIcon-1024-light.png")
shutil.copy(P + "ios-tinted.png", "public/ios/AppIcon-1024-tinted.png")
shutil.copy(P + "ios-dark.png", "public/ios/AppIcon.appiconset/AppIcon-1024.png")
for f in glob.glob(P + "AppIcon-*.png"):
    shutil.copy(f, "public/ios/AppIcon.appiconset/" + os.path.basename(f))
for f in glob.glob(P + "ic_*.png"):
    shutil.copy(f, "public/android/" + os.path.basename(f))
for f in glob.glob(P + "favicon*.png") + glob.glob(P + "apple-touch-icon*.png") + glob.glob(P + "icon-*.png"):
    shutil.copy(f, "public/" + os.path.basename(f))
shutil.copy(P + "m-icon.png", "mobile/assets/icon.png")
shutil.copy(P + "m-adaptive.png", "mobile/assets/adaptive-icon.png")

# 8. Splash screens
for f in sorted(glob.glob("public/apple-splash-*.png")):
    im = Image.open(f).convert("RGBA")
    cv = Image.new("RGBA", im.size, SPLASH_BG)
    paste_frac(cv, MARK, 0.16)
    cv.convert("RGB").save(f)

# 9. Brand asset + graphics
shutil.copy("/tmp/zbi-1024.png", "src/assets/sixvox-logo-signal.png")


def font(size, weight):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_axes([weight])
    except Exception:
        pass
    return f


def grid_bg(w, h, base=(3, 11, 18)):
    cv = Image.new("RGB", (w, h), base)
    d = ImageDraw.Draw(cv, "RGBA")
    for x in range(0, w, 60):
        d.line([(x, 0), (x, h)], fill=(6, 182, 212, 10))
    for y in range(0, h, 60):
        d.line([(0, y), (w, y)], fill=(6, 182, 212, 10))
    return cv


def compose(w, h, mark_px, title_px, tag_px, tagline, x_mark, x_text):
    cv = grid_bg(w, h).convert("RGBA")
    m = MARK.resize((mark_px, mark_px), Image.LANCZOS)
    cv.alpha_composite(m, (x_mark, (h - mark_px) // 2))
    d = ImageDraw.Draw(cv)
    tb = d.textbbox((0, 0), "SixVox", font=font(title_px, 700))
    th = tb[3] - tb[1]
    tag_h = int(tag_px * 1.3) * len(tagline)
    block = th + int(tag_px * 0.9) + tag_h
    ty = (h - block) // 2 - tb[1]
    d.text((x_text, ty), "SixVox", font=font(title_px, 700), fill=(230, 237, 243))
    y = ty + tb[3] + int(tag_px * 0.9)
    for line in tagline:
        d.text((x_text, y), line, font=font(tag_px, 400), fill=(122, 140, 158))
        y += int(tag_px * 1.3)
    return cv


compose(1200, 630, 270, 118, 42, ["The business line that picks up", "when you can't."],
        88, 412).convert("RGB").save("src/assets/sixvox-og-home-2026.jpg", quality=90)
compose(1024, 500, 230, 100, 34, ["Business line, shared inbox", "and AI receptionist"],
        70, 350).convert("RGB").save("src/assets/play-feature-graphic.png")

print("brand regeneration complete")
