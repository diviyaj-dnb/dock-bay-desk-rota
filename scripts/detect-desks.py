"""
Detect the green desk mats in the floor-plan render and emit hotspot
percentages, so nobody has to hand-drag 26 rectangles.

Pure numpy + PIL: mask the mat green, label connected components with an
iterative flood fill, filter by area, then sort into tables and rows.
"""
import sys
import numpy as np
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else 'floor-plan.webp'

im = Image.open(SRC).convert('RGB')
W, H = im.size
a = np.asarray(im).astype(np.int16)
R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]

# Mat green: green clearly dominant over both other channels, mid brightness.
mask = (G > R + 25) & (G > B + 25) & (G > 70) & (G < 200)

print(f'image {W}x{H}, green pixels: {mask.sum()} ({100*mask.sum()/mask.size:.1f}%)')

# Iterative flood fill (no recursion, no scipy).
labels = np.zeros(mask.shape, dtype=np.int32)
cur = 0
boxes = []
H_, W_ = mask.shape

for y0 in range(H_):
    row = mask[y0]
    for x0 in range(W_):
        if not row[x0] or labels[y0, x0]:
            continue
        cur += 1
        stack = [(y0, x0)]
        labels[y0, x0] = cur
        miny = maxy = y0
        minx = maxx = x0
        n = 0
        while stack:
            y, x = stack.pop()
            n += 1
            if y < miny: miny = y
            if y > maxy: maxy = y
            if x < minx: minx = x
            if x > maxx: maxx = x
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < H_ and 0 <= nx < W_ and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = cur
                    stack.append((ny, nx))
        boxes.append((n, minx, miny, maxx, maxy))

# Desk mats are the big blobs. Everything else (plants, props) is small.
boxes.sort(reverse=True)
areas = [b[0] for b in boxes[:40]]
print('top 40 blob areas:', areas)

# Keep blobs at least 25% the size of the largest — the mats are uniform.
if not boxes:
    sys.exit('no green found')
biggest = boxes[0][0]
mats = [b for b in boxes if b[0] >= biggest * 0.25]
print(f'\nkept {len(mats)} mats (threshold {biggest*0.25:.0f}px)')

rects = []
for n, x0, y0, x1, y1 in mats:
    w, h = x1 - x0 + 1, y1 - y0 + 1
    # Desk mats are roughly square-ish; drop anything wildly elongated.
    if not (0.5 < w / h < 2.0):
        continue
    rects.append((x0, y0, x1, y1, w, h))

print(f'{len(rects)} after aspect filter')

# Group into COLUMNS by x-gap. Each table is two columns of desks facing each
# other, so six columns means three tables.
rects.sort(key=lambda r: r[0])
cols, cur_c = [], [rects[0]]
for r in rects[1:]:
    if r[0] - cur_c[-1][0] > W * 0.04:
        cols.append(cur_c)
        cur_c = [r]
    else:
        cur_c.append(r)
cols.append(cur_c)

print(f'\n{len(cols)} columns: sizes {[len(c) for c in cols]}')
if len(cols) % 2:
    sys.exit(f'expected an even number of columns, got {len(cols)}')

names = ['A', 'B', 'C', 'D']
out = []
for ti in range(len(cols) // 2):
    left = sorted(cols[ti * 2], key=lambda r: r[1])
    right = sorted(cols[ti * 2 + 1], key=lambda r: r[1])
    print(f'  Table {names[ti]}: {len(left)} left + {len(right)} right = {len(left)+len(right)}')
    out.append((names[ti], left, right))

# Number the desks the way the old office did: down the left column of a table,
# then back UP the right column, so facing pairs sit next to each other.
print('\n--- LANDSCAPE_HOTSPOTS for the new 26-desk render ---')
n = 0
for name, left, right in out:
    print(f'\n  // TABLE {name} — {len(left)+len(right)} desks')
    seq = [(i + 1, r) for i, r in enumerate(left)] + [
        (len(left) + i + 1, r) for i, r in enumerate(reversed(right))
    ]
    for _, (x0, y0, x1, y1, w, h) in seq:
        n += 1
        cx = (x0 + x1) / 2 / W * 100
        cy = (y0 + y1) / 2 / H * 100
        pw = w / W * 100
        ph = h / H * 100
        print(f'  {n}: {{ x: {cx:.2f}, y: {cy:.2f}, w: {pw:.2f}, h: {ph:.2f} }},')
