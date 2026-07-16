-- Dock & Bay Desk Rota — harden RLS + booking ownership (2026-07-16)
-- Run in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/jnzihbbzfusdocuqvknm/sql/new
--
-- WHY: until now every rule (login, @dockandbay.com, the Friday week-lock, and
-- who-can-edit) was enforced ONLY in the browser. RLS granted the public `anon`
-- key full read/write/delete on every table, so anyone with the link — logged
-- in or not — could read all staff details and change or delete ANY booking.
-- Libby's "someone moved my seat" was this gap in practice.
--
-- DECISIONS (Diviyaj, 2026-07-16):
--   1. Move enforcement into the database (not client-only).
--   2. A booking can be changed only by the person it is FOR, plus the 4 admins.
--   3. Admins may also book on behalf of anyone.
--   4. The Friday week-lock is enforced in the database, not just the UI.
--
-- BLAST RADIUS: internal app, ~33 active staff + 3 dogs. Ships together with the
-- app change that stops a normal user trying to grab a taken desk (which RLS now
-- blocks). Apply after a branch test + short parallel watch. Not on a Friday.

begin;

-- ============================================================
-- 1. Identity helpers — resolve the signed-in Google user to a team member
-- ============================================================
-- current_member_id(): the team member whose email matches the signed-in user.
-- Humans only (dogs have no login). NULL if the caller isn't linked yet.
-- SECURITY INVOKER: it reads team_members, which every authenticated user can
-- already SELECT, and the RLS policies below CALL this function as the caller —
-- so it MUST stay executable by `authenticated`. (Invoker also avoids the
-- "SECURITY DEFINER executable" linter warning.)
create or replace function public.current_member_id()
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select id
  from public.team_members
  where lower(email) = lower(auth.email())
    and is_dog = false
  limit 1;
$$;

-- is_admin(): true when the signed-in user maps to an admin team member.
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members
    where lower(email) = lower(auth.email())
      and is_admin = true
  );
$$;

-- anon has no policies after this migration, so it never evaluates these —
-- drop its needless execute grant. `authenticated` KEEPS execute (the policies
-- depend on it).
revoke execute on function public.current_member_id() from anon;
revoke execute on function public.is_admin() from anon;

-- ============================================================
-- 2. Capture WHO makes each booking (audit + future-proofing)
-- ============================================================
-- created_by was never populated (0 of 370 rows). Default it to the signed-in
-- user so new bookings record their author. Ownership below keys on member_id
-- (the person the desk is for) per Libby's request; created_by is for audit.
alter table public.bookings
  alter column created_by set default auth.uid();

-- ============================================================
-- 3. Tighten RLS — authenticated only, ownership-aware
-- ============================================================
-- Ownership rule for bookings (reused across insert/update/delete):
--   • admins can touch anything (override + book on behalf), OR
--   • the booking is for the caller (member_id = current_member_id()), OR
--   • it's a dog's booking — dogs can't log in, so any signed-in human may
--     manage the shared-desk dog bookings (feature: "dogs share owner's desk").

-- ---- team_members: everyone reads; only admins write (admin panel) ----
drop policy if exists "team_members read"   on public.team_members;
drop policy if exists "team_members insert" on public.team_members;
drop policy if exists "team_members update" on public.team_members;

create policy "team_members read" on public.team_members
  for select to authenticated using (true);

create policy "team_members admin insert" on public.team_members
  for insert to authenticated with check (public.is_admin());

create policy "team_members admin update" on public.team_members
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- NOTE: handle_new_user() runs SECURITY DEFINER (owner: postgres) and so bypasses
-- RLS — first-login auto-linking still works.

-- ---- desks: read-only reference data ----
drop policy if exists "desks read" on public.desks;
create policy "desks read" on public.desks
  for select to authenticated using (true);

-- ---- announcements: everyone reads the banner; only admins edit it ----
drop policy if exists "announcements read"   on public.announcements;
drop policy if exists "announcements update" on public.announcements;

create policy "announcements read" on public.announcements
  for select to authenticated using (true);

create policy "announcements admin update" on public.announcements
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- bookings: read-all; write only your own (or admin, or a dog) ----
drop policy if exists "bookings read"   on public.bookings;
drop policy if exists "bookings insert" on public.bookings;
drop policy if exists "bookings update" on public.bookings;
drop policy if exists "bookings delete" on public.bookings;

create policy "bookings read" on public.bookings
  for select to authenticated using (true);

create policy "bookings insert" on public.bookings
  for insert to authenticated
  with check (
    public.is_admin()
    or member_id = public.current_member_id()
    or is_dog = true
  );

create policy "bookings update" on public.bookings
  for update to authenticated
  using (
    public.is_admin()
    or member_id = public.current_member_id()
    or is_dog = true
  )
  with check (
    public.is_admin()
    or member_id = public.current_member_id()
    or is_dog = true
  );

create policy "bookings delete" on public.bookings
  for delete to authenticated
  using (
    public.is_admin()
    or member_id = public.current_member_id()
    or is_dog = true
  );

-- ============================================================
-- 4. Enforce the Friday week-lock in the database
-- ============================================================
-- Non-admins may only write bookings for the current week, plus next week once
-- it unlocks on Friday 00:00 (Europe/London). Past weeks are never writable.
-- Admins bypass (they have unlocked navigation + the copy-week tool).
create or replace function public.enforce_bookable_week()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today         date    := (timezone('Europe/London', now()))::date;
  v_dow           int     := extract(isodow from v_today);      -- 1=Mon .. 7=Sun
  v_current_monday date   := v_today - (v_dow - 1);
  v_next_monday   date    := v_current_monday + 7;
  v_next_unlocked boolean := v_dow >= 5;                        -- Fri/Sat/Sun
begin
  if public.is_admin() then
    return new;
  end if;
  if new.week_id = v_current_monday then
    return new;
  end if;
  if new.week_id = v_next_monday and v_next_unlocked then
    return new;
  end if;
  raise exception
    'Bookings for the week of % are not open yet (current week always; next week from Friday).',
    new.week_id
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists trg_enforce_bookable_week on public.bookings;
create trigger trg_enforce_bookable_week
  before insert or update on public.bookings
  for each row execute function public.enforce_bookable_week();

-- ============================================================
-- 5. Close the Supabase security-linter warnings
-- ============================================================
-- Pin search_path on the two flagged trigger functions.
alter function public.set_updated_at()     set search_path = public;
alter function public.set_booking_is_dog() set search_path = public;

-- handle_new_user + enforce_bookable_week are triggers, not API endpoints — they
-- still fire on DML regardless of grants, so don't let clients call them via
-- /rest/v1/rpc. Must revoke from PUBLIC too — anon/authenticated inherit execute
-- via the default PUBLIC grant, so revoking from them alone isn't enough.
revoke execute on function public.handle_new_user()      from public, anon, authenticated;
revoke execute on function public.enforce_bookable_week() from public, anon, authenticated;

commit;
