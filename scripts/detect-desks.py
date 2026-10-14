"""
Detect the green desk mats in the floor-plan render and emit hotspot
percentages, so nobody has to hand-drag 26 rectangles.

Pure numpy + PIL: mask the mat green, close small holes, label connected
components with an iterative flood fill, filter by area and fill ratio, then
sort into tables and rows.

Usage:  python3 scripts/detect-desks.py <render>

MASK CALIBRATION (re-measure if a future render changes the mat colour).
Measured on the 2026-10-14 "D&B Floor Plan" render:
    mats  G-R mean +12..+24,  G-B mean +63..+75,  G mean 115..131
    floor G-R -32.7,          G-B +24.7
    wall  G-R -23.7,          G-B +23.5
G-B is the real separator. The original rule here was `G > R + 25`, tuned to
the brighter mats of the June render; on the October one it threw away three
quarters of every mat and the grouping collapsed. Keep G-R permissive.
"""
import sys
import numpy as np
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else 'floor-plan.webp'

# Desks live at ids 101-126, NOT numbers 1-26: the old 30 desks are archived,
# not deleted, because 512 bookings still FK to desks(id). Emitting 1-26 here
# once nearly shipped a map bound to the archived desks and an empty floor.
ID_OFFSET = 100

# Close radius in px: bridges JPEG-fragmented mat edges and the clutter
# (laptops, mugs) sitting on each mat, so one mat yields exactly one blob.
# It MUST scale with the render: a fixed 3 was right for a 2752px-wide image
# but on a 1280px one it is wider than the gap between neighbouring mats, and
# welds a whole column of desks into a single blob that the aspect filter then
# throws away. Roughly 1px per 900px of width.
def _close_radius(width):
    return max(1, round(width / 900))
# A mat is a solid rectangle. Plants and props are sparse, so they fill far
# less of their bounding box: real mats measured 78-87%, the one impostor 50%.
MIN_FILL = 0.65

# Warmth (mean R-B over a blob's own green pixels) separates the olive desk
# mats from the other greens in the room. Measured on the "final" render:
#     desk mats            R-B  51..55
#     green bucket seats   R-B  23..29   <- these grouped into a phantom
#                                           4th table of 10 and made the
#                                           detector report 36 desks
# The sofa is olive too but fails the G > R test, so it never gets this far.
MIN_WARMTH = 40

im = Image.open(SRC).convert('RGB')
W, H = im.size
a = np.asarray(im).astype(np.int16)
R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]

mask = (G > R + 5) & (G > B + 45) & (G > 60) & (G < 210)
print(f'image {W}x{H}, green pixels: {mask.sum()} ({100*mask.sum()/mask.size:.2f}%)')
if mask.sum() < 0.02 * mask.size:
    print('WARNING: under 2% green. The mask is probably mis-tuned for this '
          'render. Re-measure the mat colours before trusting the output.')


def _dilate(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(m, dy, axis=0), dx, axis=1)
    return out


def _erode(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out &= np.roll(np.roll(m, dy, axis=0), dx, axis=1)
    return out


CLOSE = _close_radius(W)
if CLOSE:
    mask = _erode(_dilate(mask, CLOSE), CLOSE)
    print(f'after close r={CLOSE} (for width {W}): {mask.sum()} '
          f'({100*mask.sum()/mask.size:.2f}%)')

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
        warm = 0
        while stack:
            y, x = stack.pop()
            n += 1
            warm += int(R[y, x]) - int(B[y, x])
            if y < miny: miny = y
            if y > maxy: maxy = y
            if x < minx: minx = x
            if x > maxx: maxx = x
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < H_ and 0 <= nx < W_ and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = cur
                    stack.append((ny, nx))
        boxes.append((n, minx, miny, maxx, maxy, warm / n))

# Desk mats are the big blobs. Everything else (plants, props) is small.
boxes.sort(reverse=True)
print('top 40 blob areas:', [b[0] for b in boxes[:40]])

if not boxes:
    sys.exit('no green found')
biggest = boxes[0][0]
mats = [b for b in boxes if b[0] >= biggest * 0.25]
print(f'\nkept {len(mats)} mats (threshold {biggest*0.25:.0f}px)')

rects = []
for n, x0, y0, x1, y1, warmth in mats:
    w, h = x1 - x0 + 1, y1 - y0 + 1
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    # Desk mats are roughly square-ish; drop anything wildly elongated.
    if not (0.5 < w / h < 2.0):
        continue
    # ...and solid. This is what rejects potted plants of mat-like area.
    if n / (w * h) < MIN_FILL:
        print(f'  dropped sparse blob at ({cx},{cy}) '
              f'fill {100*n/(w*h):.0f}%: prop, not a mat')
        continue
    # ...and olive, not a pure green. This is what rejects the bucket seats.
    if warmth < MIN_WARMTH:
        print(f'  dropped cool-green blob at ({cx},{cy}) '
              f'R-B {warmth:.0f} < {MIN_WARMTH}: seat or prop, not a mat')
        continue
    rects.append((x0, y0, x1, y1, w, h))

print(f'{len(rects)} after aspect + fill + warmth filter')

# Group into COLUMNS by x-gap. Each table is two columns of desks facing each
# other, so six columns means three tables.
#
# The gap threshold scales to DESK WIDTH, not image width. A fixed W * 0.04 put
# Table C's two columns 109px apart against a 110px threshold and merged them
# into a single block of 10. Desks in one column share an x0 to within a few px,
# while facing columns sit more than half a desk apart, so half the median width
# separates them with a wide margin at any render size or zoom level.
med_w = float(np.median([r[4] for r in rects]))
gap_thresh = med_w * 0.5
print(f'\nmedian desk width {med_w:.0f}px, column gap threshold {gap_thresh:.0f}px')

rects.sort(key=lambda r: r[0])
cols, cur_c = [], [rects[0]]
for r in rects[1:]:
    if r[0] - cur_c[-1][0] > gap_thresh:
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

total = sum(len(l) + len(r) for _, l, r in out)
print(f'\ntotal desks detected: {total}')

# Number the desks the way the old office did: down the left column of a table,
# then back UP the right column, so facing pairs sit next to each other.
print(f'\n--- LANDSCAPE_HOTSPOTS (ids, offset {ID_OFFSET}) ---')
n = 0
for name, left, right in out:
    print(f'\n  // TABLE {name} - {len(left)+len(right)} desks')
    seq = [(i + 1, r) for i, r in enumerate(left)] + [
        (len(left) + i + 1, r) for i, r in enumerate(reversed(right))
    ]
    for _, (x0, y0, x1, y1, w, h) in seq:
        n += 1
        cx = (x0 + x1) / 2 / W * 100
        cy = (y0 + y1) / 2 / H * 100
        pw = w / W * 100
        ph = h / H * 100
        print(f'  {n + ID_OFFSET}: {{ x: {cx:.2f}, y: {cy:.2f}, w: {pw:.2f}, h: {ph:.2f} }},')
