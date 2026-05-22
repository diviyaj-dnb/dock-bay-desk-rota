-- Dock & Bay Desk Rota — Supabase schema
-- Run this whole file in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/jnzihbbzfusdocuqvknm/sql/new

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.team_members (
  id text primary key,
  name text not null,
  email text unique,
  is_designer boolean not null default false,
  is_dog boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.desks (
  id integer primary key,
  number integer not null,
  type text not null check (type in ('regular', 'design', 'no-screen')),
  table_name text not null check (table_name in ('left', 'middle', 'right')),
  "row" integer not null,
  "col" text not null check ("col" in ('left', 'right'))
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references public.team_members(id) on delete cascade,
  week_id date not null,
  day text not null check (day in ('Monday','Tuesday','Wednesday','Thursday','Friday')),
  desk_id integer references public.desks(id),
  status text not null check (status in ('booked','sofa_surf','wfh')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One booking record per person per (week, day)
  unique (member_id, week_id, day),
  -- A booked desk requires a desk_id; sofa_surf/wfh must be null
  check (
    (status = 'booked' and desk_id is not null) or
    (status in ('sofa_surf','wfh') and desk_id is null)
  )
);

-- Prevent double-booking the same desk on the same week/day (when desk_id is set)
create unique index if not exists uniq_desk_per_week_day
  on public.bookings (week_id, day, desk_id)
  where desk_id is not null;

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bookings_updated_at on public.bookings;
create trigger trg_bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- All authenticated users can read everything and manage bookings.
-- (Tighten later if we want "only edit your own".)
-- ============================================================

alter table public.team_members enable row level security;
alter table public.desks enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "team_members read all (authed)" on public.team_members;
create policy "team_members read all (authed)" on public.team_members
  for select to authenticated using (true);

drop policy if exists "desks read all (authed)" on public.desks;
create policy "desks read all (authed)" on public.desks
  for select to authenticated using (true);

drop policy if exists "bookings read all (authed)" on public.bookings;
create policy "bookings read all (authed)" on public.bookings
  for select to authenticated using (true);

drop policy if exists "bookings insert (authed)" on public.bookings;
create policy "bookings insert (authed)" on public.bookings
  for insert to authenticated with check (true);

drop policy if exists "bookings update (authed)" on public.bookings;
create policy "bookings update (authed)" on public.bookings
  for update to authenticated using (true) with check (true);

drop policy if exists "bookings delete (authed)" on public.bookings;
create policy "bookings delete (authed)" on public.bookings
  for delete to authenticated using (true);
