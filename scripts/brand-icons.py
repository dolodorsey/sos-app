"""Regenerate every S.O.S. icon, favicon and splash from the official logo.

Source: public/brand/sos-logo.webp (the S.O.S. Superheros On Standby shield).
Run from the repo root:  python3 scripts/brand-icons.py
"""
import base64, io, json, os
from PIL import Image, ImageDraw

SRC = 'public/brand/sos-logo.webp'
BG_EDGE = (5, 8, 13)      # #05080d, the S.O.S. dark
BG_GLOW = (40, 6, 10)     # deep red glow behind the shield
logo = Image.open(SRC).convert('RGBA')
logo = logo.crop(logo.getbbox())
# The "S.O.S." lettering band, for icons too small to show the full shield.
letters = logo.crop((int(logo.width*.03), int(logo.height*.26), int(logo.width*.93), int(logo.height*.60)))

def bg(w, h):
    img = Image.new('RGB', (w, h), BG_EDGE)
    g = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(g)
    r = int(max(w, h) * .62)
    cx, cy = w // 2, int(h * .42)
    steps = 40
    for i in range(steps, 0, -1):
        rr = r * i / steps
        d.ellipse((cx-rr, cy-rr, cx+rr, cy+rr), fill=int(255 * (1 - i/steps) ** 1.4))
    glow = Image.new('RGB', (w, h), BG_GLOW)
    return Image.composite(glow, img, g)

def place(canvas, mark, frac):
    w, h = canvas.size
    s = min(w * frac / mark.width, h * frac / mark.height)
    m = mark.resize((max(1, round(mark.width*s)), max(1, round(mark.height*s))), Image.LANCZOS)
    canvas.paste(m, ((w-m.width)//2, (h-m.height)//2), m)
    return canvas

def icon(size, frac=.84, mark=None, transparent=False):
    mark = mark or logo
    c = Image.new('RGBA', (size, size), (0, 0, 0, 0)) if transparent else bg(size, size).convert('RGBA')
    return place(c, mark, frac)

def save(img, path, opaque=True):
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    (img.convert('RGB') if opaque else img).save(path, optimize=True)
    print('wrote', path, img.size)

# Website
small = lambda n: icon(n, .92, letters)
save(small(32), 'public/favicon.png')
small(48).convert('RGB').save('public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)]); print('wrote public/favicon.ico')
save(icon(180, .86), 'public/apple-touch-icon.png')
save(icon(192), 'public/sos-app-icon-192.png')
save(icon(512), 'public/sos-app-icon-512.png')
save(icon(512, .66), 'public/sos-app-icon-512-maskable.png')  # Android crops to a circle: keep it inside the safe zone
for n in (192, 512):
    buf = io.BytesIO(); icon(n).convert('RGB').save(buf, 'PNG', optimize=True)
    open(f'public/sos-icon-{n}.svg', 'w').write(
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{n}" height="{n}" viewBox="0 0 {n} {n}" role="img" aria-label="S.O.S. Superheros On Standby">'
        f'<image width="{n}" height="{n}" href="data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"/></svg>\n')
    print('wrote', f'public/sos-icon-{n}.svg')

# App Store / iOS (opaque, no transparency allowed)
for p in ('AppIcon-1024.png', 'AppIcon-1024-official.png'):
    save(icon(1024), p)
iconset = 'ios/App/App/Assets.xcassets/AppIcon.appiconset'
for it in json.load(open(f'{iconset}/Contents.json'))['images']:
    px = round(float(it['size'].split('x')[0]) * int(it['scale'][0]))
    save(icon(px, .92, letters) if px < 60 else icon(px), f"{iconset}/{it['filename']}")
for f in ('splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'):
    save(place(bg(2732, 2732).convert('RGBA'), logo, .34), f'ios/App/App/Assets.xcassets/Splash.imageset/{f}')

# Android
res = 'android/app/src/main/res'
for d, n in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    save(icon(n), f'{res}/mipmap-{d}/ic_launcher.png')
    round_ = icon(n).convert('RGBA'); mask = Image.new('L', (n, n), 0); ImageDraw.Draw(mask).ellipse((0, 0, n-1, n-1), fill=255)
    out = Image.new('RGBA', (n, n), (0, 0, 0, 0)); out.paste(round_, (0, 0), mask); save(out, f'{res}/mipmap-{d}/ic_launcher_round.png', opaque=False)
    save(icon(round(n * 2.25), .56, transparent=True), f'{res}/mipmap-{d}/ic_launcher_foreground.png', opaque=False)
for root, _, files in os.walk(res):
    for f in files:
        if f == 'splash.png':
            p = os.path.join(root, f); w, h = Image.open(p).size
            save(place(bg(w, h).convert('RGBA'), logo, .42), p)
