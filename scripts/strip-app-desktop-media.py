#!/usr/bin/env python3
"""Remove wide-screen (min-width >= 600px) media rules that target the S.O.S.
app's own components (.sos2-*, .sos3-*, .sosx-*).

Why: the customer app is a phone app. On desktop it now renders inside a
fixed-width app column (see sos-app-frame.css), but these viewport-based
rules kept stretching it into a sidebar/dashboard layout that fought the
column. Rules for marketing/authority pages are left untouched.
Idempotent.
"""
import pathlib, re

APP_SEL = re.compile(r'\.sos[23x]-|\.sos-mobility-layer')
MINW = re.compile(r'min-width\s*:\s*(\d+)px')


def blocks(text, start=0):
    """Yield (prelude, body, block_start, block_end) for top-level blocks."""
    i, n = start, len(text)
    while i < n:
        brace = text.find('{', i)
        if brace == -1:
            return
        # skip comments in prelude
        prelude_start = i
        depth, j = 1, brace + 1
        while j < n and depth:
            c = text[j]
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
            elif c == '/' and text.startswith('/*', j):
                j = text.find('*/', j) + 1
            j += 1
        yield text[prelude_start:brace], text[brace + 1:j - 1], prelude_start, j
        i = j


def strip_rules(body):
    out, removed = [], 0
    for prelude, inner, _, _ in blocks(body):
        selector = re.sub(r'/\*.*?\*/', '', prelude, flags=re.S).strip()
        parts = [p.strip() for p in selector.split(',') if p.strip()]
        keep = [p for p in parts if not APP_SEL.search(p)]
        if selector.startswith('@'):
            out.append(f'{prelude}{{{inner}}}')
        elif not keep:
            removed += 1
        else:
            if len(keep) != len(parts):
                removed += 1
            out.append(f'{",".join(keep)}{{{inner}}}')
    return ''.join(out), removed


total = 0
for f in sorted(pathlib.Path('src').rglob('*.css')):
    text = f.read_text(encoding='utf-8')
    out, last, changed = [], 0, 0
    for prelude, body, s, e in blocks(text):
        p = re.sub(r'/\*.*?\*/', '', prelude, flags=re.S).strip()
        m = MINW.search(p) if p.startswith('@media') else None
        if m and int(m.group(1)) >= 600 and APP_SEL.search(body):
            new_body, removed = strip_rules(body)
            changed += removed
            out.append(text[last:s])
            if new_body.strip():
                out.append(f'{prelude}{{{new_body}}}')
            last = e
    out.append(text[last:])
    if changed:
        f.write_text(''.join(out), encoding='utf-8')
        print(f'{f}: removed {changed} desktop app rules')
        total += changed
print('total', total)
