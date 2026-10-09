/**
 * Meeting-room bookings, backed directly by Google Calendar.
 *
 * Google Calendar is the ONLY store. Nothing about room bookings is written to
 * Supabase, so there are no two copies to drift apart.
 *
 * Auth is a service account talking to three ordinary shared calendars. That
 * needs NO domain-wide delegation: each calendar is simply shared with the
 * service account's address, giving it "Make changes to events". Setup:
 *
 *   1. Create a GCP service account, add a JSON key.
 *   2. In Google Calendar, for each of Beach Please / Stripe Studio / Pea in a
 *      Pod: Settings > Share with specific people > add the service account's
 *      client_email > "Make changes to events".
 *   3. Set GOOGLE_SERVICE_ACCOUNT_JSON on Vercel to the whole JSON key.
 *
 * Known limitation of this approach: a service account without domain-wide
 * delegation cannot add guests to an event. So an app-made booking carries the
 * booker's NAME in the title rather than sending invites. Meetings that need
 * invites and a Meet link get booked in Calendar as they always have been, and
 * still show up here.
 *
 * The token is minted per cold start and reused until it expires.
 */
import crypto from 'node:crypto';

const CALENDARS = {
  'beach-please':
    'c_6c3541c8ac791f5fbc4ea7b2940d5e39370661f39b8b354f0e1e6e0641b35393@group.calendar.google.com',
  'stripe-studio': 'c_hpj82ck98elrb9omq64d3tan8k@group.calendar.google.com',
  pod: 'c_d8db35abd3db559c5cc00feb3d512e485cb6b543d772411be0ec85a964f7111a@group.calendar.google.com',
} as const;

type RoomKey = keyof typeof CALENDARS;

const SCOPE = 'https://www.googleapis.com/auth/calendar';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL_API = 'https://www.googleapis.com/calendar/v3/calendars';
/** Marks events this app created, so we know which ones we may cancel. */
const APP_TAG = 'deskrota';

const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let cached: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set');

  let creds: { client_email: string; private_key: string };
  try {
    creds = JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }
  if (!creds.client_email || !creds.private_key) {
    throw new Error('Service account JSON is missing client_email or private_key');
  }

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(
    JSON.stringify({ iss: creds.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp }),
  );
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  // Vercel env vars keep newlines as literal \n — restore them or signing fails.
  const key = creds.private_key.replace(/\\n/g, '\n');
  const assertion = `${header}.${claim}.${b64url(signer.sign(key))}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cached.token;
}

async function cal(path: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${CAL_API}/${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Calendar API ${res.status}: ${body.slice(0, 400)}`);
  }
  return res.status === 204 ? null : res.json();
}

interface GEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  creator?: { email?: string };
  organizer?: { email?: string };
  extendedProperties?: { private?: Record<string, string> };
  status?: string;
}

const toEvent = (roomKey: RoomKey, e: GEvent) => ({
  id: e.id,
  roomKey,
  title: e.summary || 'Busy',
  // All-day events carry `date` not `dateTime`; treat them as covering the day.
  start: e.start?.dateTime ?? `${e.start?.date}T00:00:00`,
  end: e.end?.dateTime ?? `${e.end?.date}T23:59:59`,
  organiser: e.creator?.email,
  ours: e.extendedProperties?.private?.source === APP_TAG,
});

const isRoomKey = (v: unknown): v is RoomKey =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(CALENDARS, v);

export default async function handler(req: { method?: string; url?: string; body?: unknown }, res: {
  status: (n: number) => { json: (b: unknown) => void; end: () => void };
}) {
  const url = new URL(req.url ?? '/', 'http://localhost');

  try {
    if (req.method === 'GET') {
      const date = url.searchParams.get('date');
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
      }
      const timeMin = new Date(`${date}T00:00:00`).toISOString();
      const timeMax = new Date(`${date}T23:59:59`).toISOString();

      const perRoom = await Promise.all(
        (Object.keys(CALENDARS) as RoomKey[]).map(async (roomKey) => {
          const q = new URLSearchParams({
            timeMin,
            timeMax,
            singleEvents: 'true',
            orderBy: 'startTime',
            maxResults: '50',
          });
          const data = (await cal(
            `${encodeURIComponent(CALENDARS[roomKey])}/events?${q}`,
          )) as { items?: GEvent[] };
          return (data.items ?? [])
            .filter((e) => e.status !== 'cancelled')
            .map((e) => toEvent(roomKey, e));
        }),
      );
      return res.status(200).json({ events: perRoom.flat() });
    }

    if (req.method === 'POST') {
      const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as {
        roomKey?: unknown;
        title?: unknown;
        start?: unknown;
        end?: unknown;
      };
      if (!isRoomKey(body.roomKey)) return res.status(400).json({ error: 'unknown roomKey' });
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return res.status(400).json({ error: 'title is required' });
      }
      const start = new Date(String(body.start));
      const end = new Date(String(body.end));
      if (Number.isNaN(+start) || Number.isNaN(+end) || end <= start) {
        return res.status(400).json({ error: 'start and end must be valid, end after start' });
      }

      // Re-check for a clash server-side. The client checks too, but these are
      // ordinary shared calendars, not Workspace room resources, so Google will
      // NOT auto-decline a double booking. Two people clicking at once would
      // otherwise both succeed.
      const q = new URLSearchParams({
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: 'true',
        maxResults: '10',
      });
      const existing = (await cal(
        `${encodeURIComponent(CALENDARS[body.roomKey])}/events?${q}`,
      )) as { items?: GEvent[] };
      const clash = (existing.items ?? []).find((e) => e.status !== 'cancelled');
      if (clash) {
        return res.status(409).json({
          error: `That room is already booked (${clash.summary || 'busy'}).`,
        });
      }

      const created = (await cal(`${encodeURIComponent(CALENDARS[body.roomKey])}/events`, {
        method: 'POST',
        body: JSON.stringify({
          summary: body.title,
          description: 'Booked from Desk Rota.',
          start: { dateTime: start.toISOString(), timeZone: 'Europe/London' },
          end: { dateTime: end.toISOString(), timeZone: 'Europe/London' },
          extendedProperties: { private: { source: APP_TAG } },
        }),
      })) as GEvent;

      return res.status(200).json(toEvent(body.roomKey, created));
    }

    if (req.method === 'DELETE') {
      const roomKey = url.searchParams.get('roomKey');
      const eventId = url.searchParams.get('eventId');
      if (!isRoomKey(roomKey) || !eventId) {
        return res.status(400).json({ error: 'roomKey and eventId are required' });
      }
      await cal(
        `${encodeURIComponent(CALENDARS[roomKey])}/events/${encodeURIComponent(eventId)}`,
        { method: 'DELETE' },
      );
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    // Never leak the service-account key or raw Google payloads to the browser.
    console.error('[api/rooms]', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    const safe = msg.startsWith('GOOGLE_SERVICE_ACCOUNT_JSON')
      ? 'Room booking is not configured yet.'
      : 'Could not reach Google Calendar.';
    return res.status(500).json({ error: safe });
  }
}
