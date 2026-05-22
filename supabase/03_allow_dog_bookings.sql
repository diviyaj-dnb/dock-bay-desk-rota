-- Dog bookings have status='booked' but desk_id IS NULL (they go to the pup room,
-- not a desk). The original CHECK constraint required `status='booked' => desk_id NOT NULL`,
-- which blocked dog bookings.
--
-- This migration relaxes the constraint:
--   - status='booked' is allowed with OR without a desk_id (humans get a desk, dogs don't)
--   - status='sofa_surf' or 'wfh' must still have a NULL desk_id
--
-- The unique partial index on (week_id, day, desk_id) WHERE desk_id IS NOT NULL
-- still prevents double-booking a single desk on the same day.

-- 1) Drop any existing anonymous CHECK constraint on bookings
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.bookings'::regclass and contype = 'c'
  loop
    execute format('alter table public.bookings drop constraint %I', r.conname);
  end loop;
end $$;

-- 2) Re-add status enum check (we still want only the three valid status values)
alter table public.bookings
  add constraint bookings_status_values_check
  check (status in ('booked', 'sofa_surf', 'wfh'));

-- 3) Add the relaxed booking/desk consistency check
alter table public.bookings
  add constraint bookings_status_desk_check
  check (
    status = 'booked'
    or (status in ('sofa_surf', 'wfh') and desk_id is null)
  );
