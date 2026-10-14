// New-office floor plan geometry (October 2026 move).
//
// Everything about where things are lives HERE, as numbers. The map component
// renders this and nothing else. When the office changes again, edit this file:
// there is no image to regenerate and no hotspot to drag. That is the whole
// point of moving off the rendered-image + calibrated-overlay approach.
//
// Coordinate space is the SVG viewBox below. It is not millimetres — it is a
// faithful schematic of the architect's plan, proportioned so the room reads
// correctly at a glance.

export const VIEWBOX = { w: 1200, h: 880 };

/**
 * Outer wall, clockwise from the top-left corner.
 *
 * The notable features, in order: the top wall rises slightly to the right;
 * the bay window juts north as a three-faceted alcove; the right wall steps
 * in and out around the built-in storage; the floor drops into an extension
 * bottom-left that holds Beach Please, the stairs and the fire cupboard.
 */
export const OUTER_WALL = [
  [40, 168], // top-left
  [620, 140], // top wall, rising slightly to the right
  [690, 66], // bay — left angled facet
  [872, 66], // bay — centre facet
  [942, 140], // bay — right angled facet
  [1160, 158], // top wall continues right
  [1160, 600], // right wall down
  [700, 600], // main-room bottom wall, heading left (door sits in this run)
  [700, 830], // drop into the bottom-left extension
  [120, 830],
  [120, 600],
  [40, 600], // back to the main room's bottom-left
] as const;

export const wallPath = (pts: ReadonlyArray<readonly [number, number] | number[]>) =>
  pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ') + ' Z';

// ---------------------------------------------------------------------------
// Desks
// ---------------------------------------------------------------------------

export type DeskZone = 'bank-a' | 'bank-b' | 'bank-c' | 'bay';

export interface DeskShape {
  /** Desk number shown to people. Stable; this is what they say out loud. */
  number: number;
  zone: DeskZone;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees, about the rect's own centre. Only the bay seats are angled. */
  rotate?: number;
  /** Which side the chair is drawn on — always the bank's outward edge. */
  chair?: 'left' | 'right' | 'top';
}

const DESK_W = 60;
const DESK_H = 52;
const ROW_PITCH = 60;
const ROW_TOP = 200;

/**
 * Left-column x for each bank. The two columns BUTT TOGETHER — desks face each
 * other across a shared spine, as they do in the room — so the right column
 * starts at x + DESK_W. Banks are separated by a walkway.
 */
const BANK_X: Record<'bank-a' | 'bank-b' | 'bank-c', number> = {
  'bank-a': 322,
  'bank-b': 482,
  'bank-c': 642,
};


/**
 * Desks per bank, read off the architect's plan: 8 + 8 + 10 = 26.
 * Bank C carries the extra pair that hangs below the other two banks.
 *
 * NB this count is pending Diviyaj's confirmation against the real space.
 * Changing it is a one-line edit here — numbering and layout follow.
 */
const BANK_ROWS: Record<'bank-a' | 'bank-b' | 'bank-c', number> = {
  'bank-a': 4,
  'bank-b': 4,
  'bank-c': 5,
};

/**
 * Centre spine of each bank, for the cable tray drawn between facing desks.
 * Each spine runs only as far as its own bank: bank C is one row deeper.
 */
export const BANK_SPINES = (['bank-a', 'bank-b', 'bank-c'] as const).map((k) => ({
  key: k,
  x: BANK_X[k] + DESK_W,
  y1: ROW_TOP - 6,
  y2: ROW_TOP + (BANK_ROWS[k] - 1) * ROW_PITCH + DESK_H + 6,
}));

function buildBank(zone: 'bank-a' | 'bank-b' | 'bank-c', startNumber: number): DeskShape[] {
  const left = BANK_X[zone];
  const rows = BANK_ROWS[zone];
  const desks: DeskShape[] = [];
  let n = startNumber;

  // Left column top-to-bottom, then right column top-to-bottom. Numbering runs
  // the way someone walking the bank would count them. Chairs sit on each
  // column's outward edge, so a bank reads as two rows of people facing in.
  for (const [x, chair] of [
    [left, 'left'],
    [left + DESK_W, 'right'],
  ] as const) {
    for (let r = 0; r < rows; r++) {
      desks.push({
        number: n++,
        zone,
        x,
        y: ROW_TOP + r * ROW_PITCH,
        w: DESK_W,
        h: DESK_H,
        chair,
      });
    }
  }
  return desks;
}

/**
 * Bay window — three seats, one on each angled facet, per the brief.
 * Bookable like any other desk, but badged: Product gets priority here for
 * colour approvals, because the natural light is what makes the call accurate.
 *
 * Positioned inside the alcove the outer wall carves out between y=66 and the
 * top wall, each seat squared to the facet it sits against.
 */
const BAY_SEATS: DeskShape[] = [
  { number: 27, zone: 'bay', x: 666, y: 84, w: 54, h: 34, rotate: -46, chair: 'top' },
  { number: 28, zone: 'bay', x: 754, y: 78, w: 54, h: 34, chair: 'top' },
  { number: 29, zone: 'bay', x: 842, y: 84, w: 54, h: 34, rotate: 46, chair: 'top' },
];

export const DESKS: DeskShape[] = [
  ...buildBank('bank-a', 1),
  ...buildBank('bank-b', 9),
  ...buildBank('bank-c', 17),
  ...BAY_SEATS,
];

export const BAY_NUMBERS = BAY_SEATS.map((d) => d.number);
export const isBaySeat = (n: number) => BAY_NUMBERS.includes(n);

// ---------------------------------------------------------------------------
// Meeting rooms — booked in Google Calendar, never here.
// ---------------------------------------------------------------------------

export interface RoomShape {
  key: 'beach-please' | 'stripe-studio' | 'pod';
  /** What the team calls it. */
  name: string;
  /** Google Calendar resource id — the source of truth for whether it's free. */
  calendarId: string;
  /** Door colour from the plan. The brief says people will navigate by these. */
  colour: string;
  capacity: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Which edge the door sits on, so we can draw it in the right place. */
  door: 'top' | 'right' | 'bottom' | 'left';
}

export const ROOMS: RoomShape[] = [
  {
    key: 'beach-please',
    name: 'Beach Please',
    calendarId:
      'c_6c3541c8ac791f5fbc4ea7b2940d5e39370661f39b8b354f0e1e6e0641b35393@group.calendar.google.com',
    colour: '#2563eb', // blue door
    capacity: '4–6', // plan says 6 seater, Calendar resource says 4 — unresolved
    x: 150,
    y: 640,
    w: 200,
    h: 160,
    door: 'right',
  },
  {
    key: 'stripe-studio',
    name: 'Stripe Studio',
    calendarId: 'c_hpj82ck98elrb9omq64d3tan8k@group.calendar.google.com',
    colour: '#ec4899', // pink door
    capacity: '8',
    x: 940,
    y: 390,
    w: 212,
    h: 210,
    door: 'left',
  },
  {
    key: 'pod',
    name: 'Pea in a Pod',
    calendarId:
      'c_d8db35abd3db559c5cc00feb3d512e485cb6b543d772411be0ec85a964f7111a@group.calendar.google.com',
    colour: '#eab308', // yellow door
    capacity: '1',
    x: 446,
    y: 536,
    w: 78,
    h: 64,
    door: 'top',
  },
];

// ---------------------------------------------------------------------------
// Everything else on the floor: context, not interaction.
// ---------------------------------------------------------------------------

export interface FeatureShape {
  key: string;
  label?: string;
  sublabel?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'soft' | 'storage' | 'table' | 'stairs' | 'blocked' | 'wall';
}

export const FEATURES: FeatureShape[] = [
  // Top-left: the sofas and the wall they project onto for all-hands.
  { key: 'lunch', label: 'Full team / Lunch', x: 70, y: 175, w: 215, h: 215, kind: 'soft' },
  { key: 'project-wall', label: 'Projection wall', x: 44, y: 410, w: 10, h: 150, kind: 'wall' },

  // Communal table — six seats, deliberately NOT bookable. Just sit down.
  {
    key: 'communal',
    label: 'Communal table',
    sublabel: 'No booking — just sit down',
    x: 792,
    y: 196,
    w: 84,
    h: 250,
    kind: 'table',
  },

  // Right-hand storage run, sitting against the east wall.
  { key: 'racks', label: 'Racks / TikTok rack', x: 952, y: 196, w: 150, h: 44, kind: 'storage' },
  { key: 'built-in', label: 'Built-in', x: 1110, y: 196, w: 44, h: 44, kind: 'storage' },
  { key: 'deep-storage', label: 'Deep storage', x: 952, y: 252, w: 202, h: 48, kind: 'storage' },
  { key: 'product-wall', label: 'Product wall', x: 952, y: 316, w: 202, h: 14, kind: 'wall' },

  // Bottom-left extension.
  { key: 'stairs', label: 'Stairs', x: 400, y: 648, w: 90, h: 165, kind: 'stairs' },
  { key: 'cupboards', label: 'Cupboards', x: 364, y: 648, w: 28, h: 165, kind: 'storage' },
  {
    key: 'fire',
    label: 'Fire cupboard',
    sublabel: 'No entry',
    x: 528,
    y: 648,
    w: 150,
    h: 165,
    kind: 'blocked',
  },
];

/** The way in. Drawn as a gap in the bottom wall with a swing arc. */
export const ENTRANCE = { x: 762, y: 600, w: 82 };

/** Bay window glazing, drawn along the three outer facets. */
export const BAY_GLAZING = [
  [674, 54],
  [862, 54],
] as const;
