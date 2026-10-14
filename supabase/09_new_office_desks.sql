-- 09_new_office_desks.sql
-- New office (moved Aug 2026). 26 desks replace the old 30.
--
-- The old desks CANNOT be deleted: 512 of 534 bookings carry a desk_id FK to
-- desks(id). So they are archived in place and the new desks take ids 101+.
-- Booking history stays intact and resolvable.
--
-- table_name keeps the existing CHECK values: A = left, B = middle, C = right.
-- The label is never shown in the UI, so no constraint or type churn.
--
-- Desk TYPES are a PROVISIONAL mirror of the old office (5 design, 7 no-screen),
-- preserving the old relative positions: no-screen clustered at the bottom of
-- each table, design mid-table. Per the brief, real allocation is TBD until the
-- screens are unpacked. Change with a plain UPDATE once known.

alter table public.desks
  add column if not exists archived boolean not null default false;

update public.desks set archived = true where id between 1 and 30;

insert into public.desks (id, number, type, table_name, "row", "col", archived) values
  -- TABLE A (8) — ids 101-108, numbers 1-8
  (101,  1, 'regular',   'left',   1, 'left',  false),
  (102,  2, 'regular',   'left',   2, 'left',  false),
  (103,  3, 'regular',   'left',   3, 'left',  false),
  (104,  4, 'no-screen', 'left',   4, 'left',  false),
  (105,  5, 'no-screen', 'left',   4, 'right', false),
  (106,  6, 'design',    'left',   3, 'right', false),
  (107,  7, 'regular',   'left',   2, 'right', false),
  (108,  8, 'regular',   'left',   1, 'right', false),
  -- TABLE B (8) — ids 109-116, numbers 9-16
  (109,  9, 'regular',   'middle', 1, 'left',  false),
  (110, 10, 'design',    'middle', 2, 'left',  false),
  (111, 11, 'regular',   'middle', 3, 'left',  false),
  (112, 12, 'no-screen', 'middle', 4, 'left',  false),
  (113, 13, 'no-screen', 'middle', 4, 'right', false),
  (114, 14, 'design',    'middle', 3, 'right', false),
  (115, 15, 'regular',   'middle', 2, 'right', false),
  (116, 16, 'design',    'middle', 1, 'right', false),
  -- TABLE C (10) — ids 117-126, numbers 17-26
  (117, 17, 'regular',   'right',  1, 'left',  false),
  (118, 18, 'regular',   'right',  2, 'left',  false),
  (119, 19, 'design',    'right',  3, 'left',  false),
  (120, 20, 'no-screen', 'right',  4, 'left',  false),
  (121, 21, 'no-screen', 'right',  5, 'left',  false),
  (122, 22, 'no-screen', 'right',  5, 'right', false),
  (123, 23, 'regular',   'right',  4, 'right', false),
  (124, 24, 'regular',   'right',  3, 'right', false),
  (125, 25, 'regular',   'right',  2, 'right', false),
  (126, 26, 'regular',   'right',  1, 'right', false)
on conflict (id) do nothing;
