-- Dock & Bay Desk Rota — dogs can share their owner's desk (Sarah's feedback, 01 Jun)
-- Run in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/jnzihbbzfusdocuqvknm/sql/new
--
-- Until now the unique index on (week_id, day, desk_id) allowed exactly ONE
-- booking per desk per day — which correctly blocks human double-booking but
-- also blocks a dog accompanying its owner at the same desk.
--
-- Fix: denormalise is_dog onto bookings (kept correct by trigger), then
-- rebuild the index as humans-only. Result:
--   * two HUMANS on one desk  -> still blocked (guarantee unchanged)
--   * human + dog on one desk -> allowed
--   * dogs with no desk       -> pup bed, exactly as before

-- 1) Denormalised dog flag, backfilled from team_members
alter table public.bookings
  add column if not exists is_dog boolean not null default false;

update public.bookings b
  set is_dog = tm.is_dog
  from public.team_members tm
  where tm.id = b.member_id and b.is_dog <> tm.is_dog;

-- 2) Trigger keeps the flag correct on every insert/update — clients never
--    need to (and can't reliably) set it themselves.
create or replace function public.set_booking_is_dog()
returns trigger
language plpgsql
as $$
begin
  select tm.is_dog into new.is_dog
    from public.team_members tm where tm.id = new.member_id;
  new.is_dog := coalesce(new.is_dog, false);
  return new;
end;
$$;

drop trigger if exists trg_bookings_is_dog on public.bookings;
create trigger trg_bookings_is_dog
  before insert or update of member_id on public.bookings
  for each row execute function public.set_booking_is_dog();

-- 3) Rebuild the anti-double-booking index: humans only
drop index if exists public.uniq_desk_per_week_day;
create unique index uniq_desk_per_week_day
  on public.bookings (week_id, day, desk_id)
  where desk_id is not null and is_dog = false;
