# Dock & Bay Desk Rota

Interactive desk booking rota for Dock & Bay HQ. Map view shows the office floor plan with live booking pills; team members pick themselves from the dropdown, tap a desk, done.

## Stack

- **Frontend**: React 19 · Vite · Tailwind 4
- **Backend**: Supabase (Postgres + Row Level Security + Realtime)
- **Hosting**: Vercel
- **Auth model**: no login — every user picks themselves from the Team dropdown; identity persists in `localStorage` and is recorded against each booking via `booked_by`.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev
```

The dev server runs at `http://localhost:3000` (falls back to 3001 if 3000 is taken).

## Environment variables

| Var | Where | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` (dev) and Vercel project settings (prod) | From Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | same | Safe to expose; protected by Row Level Security |

## Database

SQL migrations live in `supabase/`. Run in order, top to bottom, in the Supabase SQL editor:

1. `schema.sql` — tables, indexes, triggers, base RLS
2. `seed.sql` — 30 desks, 30 team members, week-of-18-May seed bookings
3. `02_no_auth_mode.sql` — opens RLS to `anon` so the app works without sign-in

## Project structure

```
src/
├── App.tsx                # top-level layout (desktop + mobile)
├── main.tsx               # entry
├── index.css              # Tailwind theme tokens + a few globals
├── types.ts               # shared TS types (DayOfWeek, Booking, Desk, TeamMember)
├── assets/
│   ├── dock-and-bay-logo.jpg
│   ├── floor-plan.png         # landscape (desktop)
│   └── floor-plan-mobile.png  # portrait (mobile)
├── components/
│   ├── DeskLayoutMap.tsx  # the interactive floor plan with hotspots
│   ├── SpreadsheetView.tsx
│   ├── BookingModal.tsx
│   ├── DaySelector.tsx
│   └── RulesModal.tsx
└── lib/
    ├── supabase.ts        # typed Supabase client
    ├── repository.ts      # all DB reads/writes (saveBooking, fetchBookings, etc.)
    ├── hooks.ts           # useTeamMembers, useDesks, useBookingsForWeek, useIsMobile
    └── database.types.ts  # hand-written Database types
```

## Floor plan hotspot calibration

The map overlays 30 invisible hotspots on the floor-plan image at precise % coordinates. To re-tune them after swapping the image:

1. Append `?calibrate=1` to the URL → the **Hot** button appears in the zoom toolbar
2. Tap **Hot** → desks become draggable + resizable
3. Drag desks into position; drag the red corner to resize
4. Tap **Copy** → final coords land in your clipboard as JSON
5. Paste into `LANDSCAPE_HOTSPOTS` or `PORTRAIT_HOTSPOTS` in `src/components/DeskLayoutMap.tsx`
