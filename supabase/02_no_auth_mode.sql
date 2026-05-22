-- Dock & Bay Desk Rota — switch to "pick yourself from the dropdown" mode (no login).
-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/jnzihbbzfusdocuqvknm/sql/new
--
-- What this does:
-- 1. Opens RLS so anyone with the anon key can read team_members + desks and
--    create/update/delete bookings. This is suitable for an INTERNAL app where
--    the URL is shared with trusted staff only.
-- 2. Replaces the auth-based `created_by` column with `booked_by`, a text FK
--    to team_members(id) — so we can still record who booked what without auth.

-- ------------------------------------------------------------
-- 1. Open RLS policies (drop authenticated-only, recreate for anon + authenticated)
-- ------------------------------------------------------------

drop policy if exists "team_members read all (authed)" on public.team_members;
drop policy if exists "desks read all (authed)" on public.desks;
drop policy if exists "bookings read all (authed)" on public.bookings;
drop policy if exists "bookings insert (authed)" on public.bookings;
drop policy if exists "bookings update (authed)" on public.bookings;
drop policy if exists "bookings delete (authed)" on public.bookings;

create policy "team_members read" on public.team_members
  for select to anon, authenticated using (true);

create policy "desks read" on public.desks
  for select to anon, authenticated using (true);

create policy "bookings read" on public.bookings
  for select to anon, authenticated using (true);

create policy "bookings insert" on public.bookings
  for insert to anon, authenticated with check (true);

create policy "bookings update" on public.bookings
  for update to anon, authenticated using (true) with check (true);

create policy "bookings delete" on public.bookings
  for delete to anon, authenticated using (true);

-- ------------------------------------------------------------
-- 2. Replace auth-based created_by with team-based booked_by
-- ------------------------------------------------------------

alter table public.bookings drop column if exists created_by;
alter table public.bookings
  add column if not exists booked_by text
  references public.team_members(id) on delete set null;

-- Index for "show me everything I've booked" queries
create index if not exists idx_bookings_booked_by on public.bookings (booked_by);
