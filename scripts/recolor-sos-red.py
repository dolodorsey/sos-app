#!/usr/bin/env python3
"""One-shot recolor: S.O.S. orange accents -> official S.O.S. red family.

Official red sampled from AppIcon-1024-official.png: #E3000B (227,0,11).
Run from repo root. Idempotent (re-running changes nothing).
"""
import pathlib, re, sys

HEX = {
    # primary fills
    'ff6b35': 'e3000b', 'ff6b00': 'e3000b', 'ff7a00': 'e3000b',
    # light end of gradients
    'ff7b45': 'ff1f2a', 'ff7a42': 'ff1f2a',
    # dark end of gradients
    'e55a2b': 'b80009', 'e24c20': 'b80009', 'e85826': 'b80009', 'd65324': 'b80009', 'e5432f': 'b80009',
    # accent text on dark
    'ff8a4c': 'ff3b42', 'ff8a5b': 'ff3b42', 'ff9a5f': 'ff4b52', 'ff9a63': 'ff4b52',
    'ff9b68': 'ff4b52', 'ff9d77': 'ff4b52', 'ff9c6b': 'ff4b52',
    # soft accent text / highlights
    'ffbd63': 'ff6a70', 'ffb347': 'ff5a60', 'ffca78': 'ff9095', 'ffcf88': 'ff9095',
    'ffdca5': 'ffb8bb', 'ffbd90': 'ff9095', 'ff9a5b': 'ff4b52',
    'ffcf8a': 'ff9095', 'ffcf84': 'ff9095', 'ffcf76': 'ff9095', 'ffc766': 'ff9095', 'ffc05d': 'ff9095', 'ffc49e': 'ffb8bb',
    'e53232': 'e3000b', 'a93417': '8a0008', 'd34b20': 'b80009', '130805': 'ffffff', '2d180d': '2a0608',
    'ffe0bd': 'ffd6d8', 'fff1e8': 'fff0f0', 'ffd799': 'ffb8bb', 'ffd78e': 'ffb8bb', 'ffd393': 'ffb8bb', 'ffd18a': 'ffb8bb', 'ffd1ad': 'ffb8bb', 'ffd5c4': 'ffc4c8',
}
RGB = {
    (255, 107, 53): (227, 0, 11),
    (255, 138, 76): (255, 59, 66), (255, 139, 73): (255, 59, 66), (255, 138, 91): (255, 59, 66),
    (255, 121, 69): (255, 59, 66),
    (255, 189, 99): (255, 106, 112), (255, 179, 71): (255, 90, 96), (255, 183, 71): (255, 90, 96),
    (255, 184, 93): (255, 90, 96), (245, 170, 50): (255, 90, 96), (242, 174, 85): (255, 90, 96),
    (229, 67, 47): (184, 0, 9), (255, 108, 92): (255, 59, 66), (255, 241, 223): (255, 236, 236),
}

hex_re = re.compile(r'#(' + '|'.join(HEX) + r')([0-9a-f]{2})?\b', re.I)
rgb_re = re.compile(r'rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})')


def sub_hex(m):
    old = m.group(1)
    new = HEX[old.lower()]
    return '#' + (new.upper() if old.isupper() else new) + (m.group(2) or '')


def sub_rgb(m):
    key = tuple(int(x) for x in m.groups())
    if key not in RGB:
        return m.group(0)
    r, g, b = RGB[key]
    prefix = m.group(0)[: m.group(0).index('(') + 1]
    return f'{prefix}{r},{g},{b}'


roots = [pathlib.Path('src'), pathlib.Path('public')]
exts = {'.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.json', '.svg'}
changed = 0
for root in roots:
    for f in root.rglob('*'):
        if f.suffix not in exts or not f.is_file():
            continue
        text = f.read_text(encoding='utf-8')
        new = rgb_re.sub(sub_rgb, hex_re.sub(sub_hex, text))
        if new != text:
            f.write_text(new, encoding='utf-8')
            changed += 1
            print('recolored', f)
print(changed, 'files', file=sys.stderr)


# ---- Pass 2: hue shift for any remaining orange (12°–34°) -> S.O.S. red hue (357°).
# Gold/amber (>= 34°) is left alone: it carries warning / premium meaning.
import colorsys

RED_HUE = 357 / 360


def shift(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if not (12 / 360 <= h < 34 / 360 and s > .45 and .2 < l < .85):
        return None
    nr, ng, nb = colorsys.hls_to_rgb(RED_HUE, l, min(1, s))
    return round(nr * 255), round(ng * 255), round(nb * 255)


def sub_hex2(m):
    v = m.group(1)
    out = shift(int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16))
    if not out:
        return m.group(0)
    new = '%02x%02x%02x' % out
    return '#' + (new.upper() if v.isupper() else new) + (m.group(2) or '')


def sub_rgb2(m):
    out = shift(*(int(x) for x in m.groups()))
    if not out:
        return m.group(0)
    prefix = m.group(0)[: m.group(0).index('(') + 1]
    return f'{prefix}{out[0]},{out[1]},{out[2]}'


hex6 = re.compile(r'#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?\b')
changed2 = 0
for root in roots:
    for f in root.rglob('*'):
        if f.suffix not in exts or not f.is_file() or f.name == 'manifest.json':
            continue
        text = f.read_text(encoding='utf-8')
        new = rgb_re.sub(sub_rgb2, hex6.sub(sub_hex2, text))
        if new != text:
            f.write_text(new, encoding='utf-8')
            changed2 += 1
            print('hue-shifted', f)
print(changed2, 'files (hue pass)', file=sys.stderr)
