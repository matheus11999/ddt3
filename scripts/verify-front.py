"""Validator of the FRONT view (pedido do matheus, 21/10): outside battle the character faces the viewer like in DDTank.

Measures every front hair and hat on the front head template, checks the rules, and ALWAYS writes the approval
previews, so running it is enough to see the result:
  test-results/front/report.md    measures and problems of every piece
  test-results/front/pieces.png   each hair/hat alone on the head, eyes/mouth keep-out in red, ear tops in blue
  test-results/front/figures.png  full figures: every outfit x hair x with/without the hat
  test-results/front/sheets.png   walk and idle sheets of each outfit, frame by frame (when they exist)
Fits live in src/game/rig/frontFit.json ({piece: [scale around the crown, dx, dy]}). `--fit` searches the best placement
of every piece (or `--fit=<id>,<id>`) and writes it there.
Usage: py scripts/verify-front.py [--fit[=ids]] [--strict]   (--strict: exit 1 when any piece has a problem)

Front head template (public/assets/front/face-basic-*.png, 1254 px), a 3/4 front view like the DDTank bag portrait
(matheus, 21/10: not straight, the near ear shows): crown (634,182), skull x 425-842 (417 px, the same skull width as
the side head), near brow top y=357, eyes at (620,463) and (775,482), mouth (675,537), near ear top (452,440), far ear
top (820,466), neck stub down to (583,627).
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

ART = 'public/assets/front'
FIT_FILE = 'src/game/rig/frontFit.json'
OUT = 'test-results/front'
GENDERS = ('male', 'female')
HAIRS = {'hair-basic-male': 'male', 'hair-basic-female': 'female'}
LONG_HAIR = {'hair-basic-female'}   # long hair may be a little wider (it falls beside the jaw)
HATS = ['hat-starter']
OUTFITS = {'outfit-basic-male': 'male', 'outfit-basic-female': 'female'}

CROWN = (634, 182)
NECK = (583, 627)
SKULL_WIDTH = 417
HEAD_TO_BODY = 0.9      # drawn head height (crown to neck stub) / body height (collar to soles)
LIMITS = {'hair-long': {'width': 1.45, 'keepout': 200, 'skull_top': 0.95, 'ears': 0.6},
          'hair': {'width': 1.4, 'keepout': 200, 'skull_top': 0.95, 'ears': 0.6},
          'hat': {'width': 1.45, 'keepout': 0, 'skull_top': 0.9, 'band': (330, 382)}}

Q = 4
N = 1254 // Q
yy, xx = np.mgrid[0:N, 0:N] * Q


def ellipse(cx, cy, rx, ry):
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1


EYES = ellipse(620, 463, 64, 60) | ellipse(775, 482, 50, 58)
MOUTH = ellipse(675, 537, 46, 20)
SKULL = ellipse(634, 392, 209, 210)
SKULL_TOP = SKULL & (yy < 335)
EARS = ellipse(452, 446, 16, 12) | ellipse(822, 470, 12, 10)


def load(name):
    return Image.open(f'{ART}/{name}.png').convert('RGBA')


def placed(im, fit):
    """The piece on the 1254 template: uniform scale around the crown, then the offset (like a manifest pin)."""
    k, dx, dy = fit
    scaled = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    out = Image.new('RGBA', (1254, 1254), (0, 0, 0, 0))
    out.alpha_composite(scaled, (round(CROWN[0] - CROWN[0] * k + dx), round(CROWN[1] - CROWN[1] * k + dy)))
    return out


def mask_of(alpha_small, fit):
    k, dx, dy = fit
    h, w = alpha_small.shape
    a = np.asarray(Image.fromarray(alpha_small).resize((max(1, round(w * k)), max(1, round(h * k))), Image.BILINEAR))
    out = np.zeros((N, N), np.uint8)
    ox, oy = round((CROWN[0] - CROWN[0] * k + dx) / Q), round((CROWN[1] - CROWN[1] * k + dy) / Q)
    x0, y0, x1, y1 = max(0, ox), max(0, oy), min(N, ox + a.shape[1]), min(N, oy + a.shape[0])
    if x1 > x0 and y1 > y0:
        out[y0:y1, x0:x1] = a[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
    return out > 128


def measure(kind, mask):
    ys, xs = np.nonzero(mask)
    m = {'keepout': int((mask & (EYES | MOUTH)).sum() * Q * Q), 'skull_top': round(float(mask[SKULL_TOP].mean()), 3),
         'width': round(float((xs.max() - xs.min() + 1) * Q / SKULL_WIDTH), 2) if len(xs) else 0.0}
    centre = (xs * Q > 470) & (xs * Q < 560)  # the band over the near temple: the brim may come lower in front
    if kind.startswith('hair'):
        m['ears'] = round(float(mask[EARS].mean()), 2)
    else:
        m['band'] = int(ys[centre].max() * Q) if centre.any() else 0
    return m


def problems(kind, m):
    lim, out = LIMITS[kind], []
    if m['width'] > lim['width']:
        out.append(f"Largura {m['width']}× o crânio; limite {lim['width']}×")
    if m['keepout'] > lim['keepout']:
        out.append(f"Cobre olhos/boca em {m['keepout']}px")
    if m['skull_top'] < lim['skull_top']:
        out.append(f"Topo da cabeça aparece: cobre só {round(m['skull_top'] * 100)}%")
    if kind.startswith('hair') and m['ears'] < lim['ears']:
        out.append(f"Não encosta no topo das orelhas ({round(m['ears'] * 100)}%)")
    if kind == 'hat' and not lim['band'][0] <= m['band'] <= lim['band'][1]:
        out.append(f"Faixa do chapéu em y={m['band']}; deve ficar entre {lim['band'][0]} e {lim['band'][1]} (acima das sobrancelhas)")
    return out


def score(kind, m):
    lim = LIMITS[kind]
    s = m['keepout'] * 0.05 + (1 - m['skull_top']) * 400 + max(0, m['width'] - lim['width'] + .05) * 300
    if kind.startswith('hair'):
        s += (1 - m['ears']) * 150
    else:
        lo, hi = lim['band']
        s += max(0, m['band'] - hi + 5) * 2 + max(0, lo + 10 - m['band']) * 2
    return s


def search(kind, im):
    small = np.asarray(im.split()[3].resize((N, N), Image.BILINEAR))
    best = None
    for k in np.arange(0.5, 1.21, 0.02):
        for dx in range(-60, 61, 12):
            for dy in range(-120, 121, 8):
                m = measure(kind, mask_of(small, (k, dx, dy)))
                s = score(kind, m)
                if best is None or s < best[0]:
                    best = (s, [round(float(k), 2), dx, dy])
    return best[1]


def under_hat(hair, hat):
    """Hair under a hat: nothing of it shows above the hat's lower edge (the game does the same)."""
    h = np.asarray(hair).copy()
    a = np.asarray(hat)[..., 3] > 128
    cols = a.any(axis=0)
    bottom = np.where(cols, a.shape[0] - 1 - np.argmax(a[::-1], axis=0), 0)
    band = int(np.median(bottom[cols])) if cols.any() else 0
    limit = np.where(cols, bottom, band)
    h[np.arange(h.shape[0])[:, None] < limit[None, :], 3] = 0
    return Image.fromarray(h, 'RGBA')


def head(gender, hair_fit, hat_fit, fits, hat=True):
    face = load(f'face-basic-{gender}')
    hair = placed(load(f'hair-basic-{gender}'), fits[f'hair-basic-{gender}'])
    cap = placed(load('hat-starter'), fits['hat-starter']) if hat else None
    if cap:
        hair = under_hat(hair, cap)
    out = Image.new('RGBA', face.size, (0, 0, 0, 0))
    if gender == 'female':  # long hair falls behind the head; the fringe and sides come in front again
        out.alpha_composite(hair)
    out.alpha_composite(face)
    out.alpha_composite(hair)
    if cap:
        out.alpha_composite(cap)
    return out


def figure(outfit, gender, fits, hat):
    body = load(outfit)
    stand = json.load(open('src/game/frontAtlas.json', encoding='utf-8'))['stand'][outfit]
    (cx, cy), by1 = stand['collar'], stand['soles']
    height = by1 - cy
    h = head(gender, None, None, fits, hat)
    k = height * HEAD_TO_BODY / (NECK[1] - CROWN[1])
    hs = h.resize((round(h.width * k), round(h.height * k)), Image.LANCZOS)
    collar = (cx, cy + 12)
    canvas = Image.new('RGBA', (1254, 2000), (0, 0, 0, 0))
    top = 2000 - by1 - 20
    canvas.alpha_composite(body, (0, top))
    canvas.alpha_composite(hs, (round(collar[0] - NECK[0] * k), round(top + collar[1] - NECK[1] * k)))
    return canvas.crop(canvas.split()[3].getbbox())


def sheets(fits):
    """Every frame of the walk and idle sheets with the front head on top, plus the sheet problems."""
    path = 'src/game/frontAtlas.json'
    data = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
    rows, issues = [], []
    for kind in ('idle', 'walk'):
        for outfit, gender in OUTFITS.items():
            entry = data.get(kind, {}).get(outfit)
            if not entry:
                issues.append(f'| {outfit} | {kind} | falta a folha |')
                continue
            atlas = Image.open('public' + entry['path']).convert('RGBA')
            cell, row = entry['cell'], []
            heads = [f['headHeight'] for f in entry['frames']]
            soles = [f['soles'] for f in entry['frames']]
            found = []
            if max(heads) - min(heads) > 12:
                found.append(f'cabeça muda {max(heads) - min(heads)}px entre quadros')
            if max(soles) - min(soles) > 14:
                found.append(f'pés sobem e descem {max(soles) - min(soles)}px')
            issues.append(f"| {outfit} | {kind} | {'; '.join(found) or 'ok'} |")
            h = head(gender, None, None, fits, False)
            for i, fr in enumerate(entry['frames']):
                body = atlas.crop(((i % 3) * cell, (i // 3) * cell, (i % 3 + 1) * cell, (i // 3 + 1) * cell))
                k = fr['headHeight'] / (NECK[1] - CROWN[1])
                hs = h.resize((round(1254 * k), round(1254 * k)), Image.LANCZOS)
                frame = Image.new('RGBA', (cell, cell + 120), (44, 70, 110, 255))
                ImageDraw.Draw(frame).line([(0, 120 + fr['soles']), (cell, 120 + fr['soles'])], fill=(120, 80, 40, 255), width=4)
                frame.alpha_composite(body, (0, 120))
                frame.alpha_composite(hs, (round(fr['neck'][0] - NECK[0] * k), round(120 + fr['neck'][1] - NECK[1] * k)))
                row.append(frame.resize((cell // 2, (cell + 120) // 2)))
            rows.append((f'{outfit} · {kind}', row))
    if rows:
        h = 316
        sheet = Image.new('RGBA', (256 * 6 + 200, h * len(rows)), (30, 40, 60, 255))
        for r, (text, row) in enumerate(rows):
            ImageDraw.Draw(sheet).text((8, r * h + 140), text, fill=(255, 228, 160))
            for i, fr in enumerate(row):
                sheet.alpha_composite(fr, (200 + i * 256, r * h))
        sheet.save(f'{OUT}/sheets.png')
    return issues


def write_template():
    """docs/templates/front-head.png: the front head with the rules drawn on it, attached to every Codex prompt."""
    t = load('face-basic-male')
    g = np.zeros((N, N, 4), np.uint8)
    g[EYES | MOUTH] = (255, 40, 60, 120)
    g[EARS] = (40, 140, 255, 200)
    t.alpha_composite(Image.fromarray(g).resize((1254, 1254), Image.NEAREST))
    d = ImageDraw.Draw(t)
    for x in range(380, 890, 24):
        d.line([(x, 380), (x + 12, 380)], fill=(40, 120, 255, 255), width=4)
    d.ellipse([CROWN[0] - 8, CROWN[1] - 8, CROWN[0] + 8, CROWN[1] + 8], fill=(40, 120, 255, 255))
    out = Image.new('RGBA', t.size, (255, 255, 255, 255))
    out.alpha_composite(t)
    out.save('docs/templates/front-head.png')


def label(img, text, ok=True):
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, img.width, 22], fill=(20, 30, 50, 230))
    d.text((6, 5), text, fill=(184, 255, 214) if ok else (255, 179, 186))


def main():
    strict = '--strict' in sys.argv
    fit_arg = next((a for a in sys.argv if a.startswith('--fit')), None)
    fits = json.load(open(FIT_FILE, encoding='utf-8')) if os.path.exists(FIT_FILE) else {}
    pieces = [(name, 'hair-long' if name in LONG_HAIR else 'hair') for name in HAIRS] + [(name, 'hat') for name in HATS]
    if fit_arg:
        wanted = fit_arg.split('=', 1)[1].split(',') if '=' in fit_arg else [name for name, _ in pieces]
        for name, kind in pieces:
            if name in wanted:
                fits[name] = search(kind, load(name))
                print(f'{name}: encaixe {fits[name]}')
        with open(FIT_FILE, 'w', encoding='utf-8') as f:
            json.dump(fits, f, indent=1)
            f.write('\n')
    os.makedirs(OUT, exist_ok=True)
    write_template()

    rows, failing = [], 0
    cells = []
    for name, kind in pieces:
        if name not in fits:
            rows.append(f'| {name} | — | sem encaixe: rode com --fit={name} |')
            failing += 1
            continue
        im = load(name)
        m = measure(kind, mask_of(np.asarray(im.split()[3].resize((N, N), Image.BILINEAR)), fits[name]))
        issues = problems(kind, m)
        failing += bool(issues)
        rows.append(f"| {name} | {', '.join(f'{k} {v}' for k, v in m.items())} | {'; '.join(issues) or 'ok'} |")
        for gender in (GENDERS if kind == 'hat' else (HAIRS[name],)):
            cell = load(f'face-basic-{gender}')
            if kind == 'hair-long':
                back = Image.new('RGBA', cell.size, (0, 0, 0, 0))
                back.alpha_composite(placed(im, fits[name]))
                back.alpha_composite(cell)
                cell = back
            cell.alpha_composite(placed(im, fits[name]))
            guide = Image.new('RGBA', (N, N), (0, 0, 0, 0))
            g = np.zeros((N, N, 4), np.uint8)
            g[EYES | MOUTH] = (255, 40, 60, 90)
            g[EARS] = (40, 140, 255, 160)
            guide = Image.fromarray(g).resize((1254, 1254), Image.NEAREST)
            cell.alpha_composite(guide)
            d = ImageDraw.Draw(cell)
            d.line([(380, LIMITS['hat']['band'][1]), (890, LIMITS['hat']['band'][1])], fill=(255, 200, 0, 200), width=3)
            bg = Image.new('RGBA', cell.size, (44, 70, 110, 255))
            bg.alpha_composite(cell)
            bg = bg.crop((230, 60, 1030, 860)).resize((360, 360))
            label(bg, f'{name} ({gender})', not issues)
            cells.append(bg)
    sheet = Image.new('RGBA', (370 * max(1, len(cells)), 370), (30, 40, 60, 255))
    for i, c in enumerate(cells):
        sheet.alpha_composite(c, (i * 370 + 5, 5))
    sheet.save(f'{OUT}/pieces.png')

    figs = []
    if all(name in fits for name, _ in pieces):
        for outfit, gender in OUTFITS.items():
            for hat in (False, True):
                f = figure(outfit, gender, fits, hat)
                f.thumbnail((400, 660))
                figs.append((f, f"{outfit}{' + chapéu' if hat else ''}"))
    sheet = Image.new('RGBA', (420 * max(1, len(figs)), 710), (44, 70, 110, 255))
    for i, (f, text) in enumerate(figs):
        sheet.alpha_composite(f, (i * 420 + (420 - f.width) // 2, 700 - f.height))
        ImageDraw.Draw(sheet).text((i * 420 + 8, 8), text, fill=(255, 228, 160))
    sheet.save(f'{OUT}/figures.png')

    sheet_rows = sheets(fits) if all(name in fits for name, _ in pieces) else []
    failing += sum(1 for r in sheet_rows if not r.endswith('| ok |'))
    with open(f'{OUT}/report.md', 'w', encoding='utf-8') as f:
        f.write('# Vista de frente: validação\n\n| Peça | Medidas | Problemas |\n| --- | --- | --- |\n' + '\n'.join(rows) + '\n')
        f.write('\n## Folhas do lobby (andar e parado)\n\n| Roupa | Folha | Problemas |\n| --- | --- | --- |\n' + '\n'.join(sheet_rows) + '\n')
    print(f'Problemas: {failing}. Prévias: {OUT}/pieces.png, {OUT}/figures.png, {OUT}/sheets.png; relatório {OUT}/report.md')
    if strict and failing:
        sys.exit(1)


if __name__ == '__main__':
    main()
