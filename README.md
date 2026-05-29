# Dock & Bay Desk Rota

Interactive desk-booking rota for Dock & Bay HQ. Team members sign in with their
Dock & Bay Google account, see the office floor plan, and book a desk (or the
sofa, or the pup bed) for the week.

**Live:** https://dock-bay-desk-rota.vercel.app

## Stack

- **Frontend**: React 19 · Vite 6 · Tailwind 4 · Fraunces/Inter
- **Backend**: Supabase (Postgres · Row Level Security · Auth)
- **Hosting**: Vercel (auto-deploys from `main`)

## Authentication & roles

- **Sign-in**: Google OAuth, restricted to **@dockandbay.com** accounts. The
  `AuthGate` gates the whole app; non-`@dockandbay.com` accounts are signed out
  with a notice. Uses the Supabase **PKCE** flow (reliable on mobile browsers).
- **Identity**: the signed-in email is matched to a `team_members` row, so the
  app knows who you are automatically — your initials show in the header.
- **Auto-provisioning**: a Postgres trigger (`handle_new_user`) runs on first
  login — it links you to an existing team member by name (filling in your
  email) or creates a fresh row if you're new. New @dockandbay.com staff just
  appear.
- **Admin roles** (`team_members.is_admin` = Diviyaj Ayengia, Sarah Davenport,
  Gabriella Murphy): admins can book / edit / remove on behalf of **anyone**.
  Everyone else is limited to their own bookings. (Enforced in the UI today;
  database-level RLS hardening is a planned follow-up.)

## Booking window

- The **current week** is always bookable.
- The **next week unlocks every Friday at 00:00** and stays open through the
  weekend — so everyone gets an equal shot at the following week's seats. You
  only ever book one week ahead; past weeks aren't reachable.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev                  # http://localhost:3000
npm run lint                 # tsc --noEmit (CI runs this + a build on every PR)
```

For Google sign-in to work locally, `http://localhost:3000` must be in the
Supabase project's **Auth → URL Configuration → Redirect URLs**.

## Environment variables

| Var | Where | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` (dev) + Vercel project settings (prod) | Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | same | Public key; protected by Row Level Security |

## Database

SQL lives in `supabase/`. For a fresh project, run in order in the SQL editor:

1. `schema.sql` — tables, indexes, triggers, base RLS
2. `seed.sql` — desks, team members, sample bookings
3. `02_no_auth_mode.sql` — opens RLS to `anon` (historical: the pre-auth mode)
4. `03_allow_dog_bookings.sql` — relaxes the desk constraint so pups can book
   the pup bed (no desk)

> **Note:** the live database also has an admin-role column + the
> `handle_new_user` auto-provision trigger applied (added via the Supabase
> dashboard during the auth work). Consolidating all of this into a clean,
> versioned migration history — and tightening RLS to authenticated +
> own-row/admin writes — is a tracked follow-up.

## Project structure

```
src/
├── App.tsx                  # top-level layout (desktop + mobile)
├── main.tsx                 # entry — wraps App in AuthGate + ErrorBoundary
├── index.css                # Tailwind theme tokens, fonts, brand stripe
├── types.ts                 # shared types (DayOfWeek, Booking, Desk, TeamMember)
├── assets/
│   ├── dock-and-bay-logo.jpg
│   ├── floor-plan.webp          # landscape (desktop)
│   ├── floor-plan-mobile.webp   # portrait (mobile)
│   └── login-backdrop.webp      # sign-in hero photo
├── components/
│   ├── AuthGate.tsx         # gates the app behind Google sign-in + domain check
│   ├── SignIn.tsx           # split-screen sign-in screen
│   ├── DeskLayoutMap.tsx    # interactive floor plan with hotspots
│   ├── WhoIsIn.tsx          # "who's in today" roster (avatar stack + count)
│   ├── SpreadsheetView.tsx  # table view + CSV export
│   ├── BookingModal.tsx     # book/edit a desk (admin-aware)
│   ├── DaySelector.tsx
│   ├── RulesModal.tsx
│   └── ErrorBoundary.tsx
└── lib/
    ├── supabase.ts          # typed Supabase client (PKCE auth)
    ├── repository.ts        # DB reads/writes
    ├── hooks.ts             # useSession, useTeamMembers, useDesks, useBookingsForWeek, useIsMobile
    └── database.types.ts    # hand-written Database types
```

## Floor-plan hotspot calibration

The map overlays invisible hotspots (30 desks + the pup bed) on the floor-plan
image at precise % coordinates. To re-tune after swapping the image:

1. Append `?calibrate=1` to the URL → a **Hot** button appears in the toolbar
2. Tap **Hot** → desks become draggable + resizable (drag the red corner to size)
3. Tap **Copy** → final coords land in your clipboard as JSON
4. Paste into `LANDSCAPE_HOTSPOTS` / `PORTRAIT_HOTSPOTS` (and `PUP_BED_*`) in
   `src/components/DeskLayoutMap.tsx`

Mobile uses the portrait set; calibrate it by narrowing the window below ~768px
(or device mode) before turning on **Hot**.
