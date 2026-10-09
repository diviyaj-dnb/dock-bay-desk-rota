/**
 * Meeting rooms.
 *
 * Google Calendar is the ONLY store for room bookings. We never keep a copy in
 * Supabase. That is deliberate: if bookings lived in both places they would
 * drift the first time someone edited one in Calendar, and that drift is what
 * rots this kind of integration. Desks live in Supabase; rooms live in Calendar.
 *
 * All Calendar access goes through RoomsProvider so the UI can be built and
 * tested before credentials exist, and so swapping the transport is one file.
 */

export type RoomKey = 'beach-please' | 'stripe-studio' | 'pod';

export interface Room {
  key: RoomKey;
  name: string;
  /** Google Calendar id. Verified present on the account, 9 Oct 2026. */
  calendarId: string;
  /** Door colour from the office plan — the brief says people navigate by these. */
  colour: string;
  capacity: number;
  /** Shown under the name, e.g. what the room is actually good for. */
  blurb: string;
}

export const ROOMS: Room[] = [
  {
    key: 'beach-please',
    name: 'Beach Please',
    calendarId:
      'c_6c3541c8ac791f5fbc4ea7b2940d5e39370661f39b8b354f0e1e6e0641b35393@group.calendar.google.com',
    colour: '#2563eb',
    // Plan says "6 SEATER", the Calendar resource says "(4 people)". Using the
    // Calendar figure until someone settles it — see the 9 Oct work note.
    capacity: 4,
    blurb: 'Meetings and calls',
  },
  {
    key: 'stripe-studio',
    name: 'Stripe Studio',
    calendarId: 'c_hpj82ck98elrb9omq64d3tan8k@group.calendar.google.com',
    colour: '#ec4899',
    capacity: 8,
    blurb: 'Shoots, product wall, TV',
  },
  {
    key: 'pod',
    name: 'Pea in a Pod',
    calendarId:
      'c_d8db35abd3db559c5cc00feb3d512e485cb6b543d772411be0ec85a964f7111a@group.calendar.google.com',
    colour: '#eab308',
    capacity: 1,
    blurb: 'Quick calls, one person',
  },
];

export const roomByKey = (key: RoomKey) => ROOMS.find((r) => r.key === key)!;

export interface RoomEvent {
  /** Google Calendar event id. */
  id: string;
  roomKey: RoomKey;
  title: string;
  start: Date;
  end: Date;
  /** Who booked it, when Calendar tells us. */
  organiser?: string;
  /** True when this app created it — those we offer to cancel. */
  ours?: boolean;
}

export interface CreateRoomBooking {
  roomKey: RoomKey;
  title: string;
  start: Date;
  end: Date;
}

export interface RoomsProvider {
  listDay(date: Date): Promise<RoomEvent[]>;
  create(input: CreateRoomBooking): Promise<RoomEvent>;
  remove(roomKey: RoomKey, eventId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Office hours and slots
// ---------------------------------------------------------------------------

export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 19;
export const SLOT_MINUTES = 30;

export const SLOT_COUNT = ((DAY_END_HOUR - DAY_START_HOUR) * 60) / SLOT_MINUTES;

export function slotToDate(day: Date, slotIndex: number): Date {
  const d = new Date(day);
  d.setHours(DAY_START_HOUR, 0, 0, 0);
  d.setMinutes(d.getMinutes() + slotIndex * SLOT_MINUTES);
  return d;
}

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** Events overlap when each starts before the other ends. Touching is fine. */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Conflict check, run before every create.
 *
 * These are ordinary shared calendars, NOT Google Workspace room resources, so
 * Calendar does NOT auto-decline a double booking the way a real resource would.
 * Nothing upstream stops two people taking the same room at the same time, so
 * this check is the only thing standing in the way.
 */
export function findConflict(
  events: RoomEvent[],
  input: CreateRoomBooking,
): RoomEvent | undefined {
  return events.find(
    (e) => e.roomKey === input.roomKey && overlaps(input.start, input.end, e.start, e.end),
  );
}

// ---------------------------------------------------------------------------
// Stub provider — in-memory, for building the UI before credentials exist.
// ---------------------------------------------------------------------------

function at(day: Date, h: number, m: number): Date {
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}

export function createStubProvider(): RoomsProvider {
  // Seeded from the real recurring meetings on these calendars, so the UI is
  // exercised against a believable day.
  let seeded = false;
  const events: RoomEvent[] = [];

  const seed = (day: Date) => {
    if (seeded) return;
    seeded = true;
    events.push(
      {
        id: 'stub-1',
        roomKey: 'beach-please',
        title: 'Social Squad',
        start: at(day, 11, 30),
        end: at(day, 12, 30),
        organiser: 'alexandria@dockandbay.com',
      },
      {
        id: 'stub-2',
        roomKey: 'beach-please',
        title: 'Valentina CRM meeting',
        start: at(day, 14, 0),
        end: at(day, 15, 0),
        organiser: 'pippy@dockandbay.com',
      },
      {
        id: 'stub-3',
        roomKey: 'stripe-studio',
        title: 'Channel Owners Fortnightly',
        start: at(day, 12, 0),
        end: at(day, 13, 0),
        organiser: 'jonathan@dockandbay.com',
      },
      {
        id: 'stub-4',
        roomKey: 'stripe-studio',
        title: 'Key accounts',
        start: at(day, 15, 0),
        end: at(day, 16, 0),
        organiser: 'alexandria@dockandbay.com',
      },
    );
  };

  let n = 100;
  return {
    async listDay(date) {
      seed(date);
      const dayStart = at(date, 0, 0);
      const dayEnd = at(date, 23, 59);
      return events.filter((e) => overlaps(e.start, e.end, dayStart, dayEnd));
    },
    async create(input) {
      const ev: RoomEvent = { id: `stub-${++n}`, ...input, ours: true };
      events.push(ev);
      return ev;
    },
    async remove(_roomKey, eventId) {
      const i = events.findIndex((e) => e.id === eventId);
      if (i >= 0) events.splice(i, 1);
    },
  };
}

// ---------------------------------------------------------------------------
// HTTP provider — talks to the serverless function that holds the service
// account. Becomes the default once GOOGLE_SERVICE_ACCOUNT_JSON is set and the
// three calendars are shared with the service account's address.
// ---------------------------------------------------------------------------

export function createHttpProvider(base = '/api/rooms'): RoomsProvider {
  const parse = (e: {
    id: string;
    roomKey: RoomKey;
    title: string;
    start: string;
    end: string;
    organiser?: string;
    ours?: boolean;
  }): RoomEvent => ({ ...e, start: new Date(e.start), end: new Date(e.end) });

  const check = async (res: Response) => {
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(body || `Rooms request failed (${res.status})`);
    }
    return res;
  };

  return {
    async listDay(date) {
      const d = date.toISOString().slice(0, 10);
      const res = await check(await fetch(`${base}?date=${d}`));
      const json = await res.json();
      return (json.events ?? []).map(parse);
    },
    async create(input) {
      const res = await check(
        await fetch(base, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomKey: input.roomKey,
            title: input.title,
            start: input.start.toISOString(),
            end: input.end.toISOString(),
          }),
        }),
      );
      return parse(await res.json());
    },
    async remove(roomKey, eventId) {
      await check(
        await fetch(`${base}?roomKey=${roomKey}&eventId=${encodeURIComponent(eventId)}`, {
          method: 'DELETE',
        }),
      );
    },
  };
}
