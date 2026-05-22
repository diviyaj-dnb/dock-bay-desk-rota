-- Dock & Bay Desk Rota — seed data
-- Run this AFTER schema.sql, in the same SQL editor.
-- Idempotent: re-running it will overwrite the seed rows but leave new bookings alone.

-- ============================================================
-- DESKS (30 desks across 3 tables)
-- ============================================================
insert into public.desks (id, number, type, table_name, "row", "col") values
  -- Table A (left, 10 desks)
  (1, 1, 'regular',   'left',   1, 'left'),
  (2, 2, 'regular',   'left',   2, 'left'),
  (3, 3, 'regular',   'left',   3, 'left'),
  (4, 4, 'regular',   'left',   4, 'left'),
  (5, 5, 'no-screen', 'left',   5, 'left'),
  (6, 6, 'no-screen', 'left',   5, 'right'),
  (7, 7, 'regular',   'left',   4, 'right'),
  (8, 8, 'design',    'left',   3, 'right'),
  (9, 9, 'regular',   'left',   2, 'right'),
  (10, 10, 'regular', 'left',   1, 'right'),
  -- Table B (middle, 8 desks)
  (11, 11, 'regular', 'middle', 1, 'left'),
  (12, 12, 'design',  'middle', 2, 'left'),
  (13, 13, 'regular', 'middle', 3, 'left'),
  (14, 14, 'no-screen','middle',4, 'left'),
  (15, 15, 'no-screen','middle',4, 'right'),
  (16, 16, 'design',  'middle', 3, 'right'),
  (17, 17, 'regular', 'middle', 2, 'right'),
  (18, 18, 'design',  'middle', 1, 'right'),
  -- Table C (right, 12 desks)
  (19, 19, 'regular', 'right',  1, 'left'),
  (20, 20, 'regular', 'right',  2, 'left'),
  (21, 21, 'design',  'right',  3, 'left'),
  (22, 22, 'regular', 'right',  4, 'left'),
  (23, 23, 'no-screen','right', 5, 'left'),
  (24, 24, 'no-screen','right', 6, 'left'),
  (25, 25, 'no-screen','right', 6, 'right'),
  (26, 26, 'regular', 'right',  5, 'right'),
  (27, 27, 'regular', 'right',  4, 'right'),
  (28, 28, 'regular', 'right',  3, 'right'),
  (29, 29, 'regular', 'right',  2, 'right'),
  (30, 30, 'regular', 'right',  1, 'right')
on conflict (id) do update set
  number = excluded.number,
  type = excluded.type,
  table_name = excluded.table_name,
  "row" = excluded."row",
  "col" = excluded."col";

-- ============================================================
-- TEAM MEMBERS (27 people + 3 dogs)
-- ============================================================
insert into public.team_members (id, name, is_designer, is_dog) values
  ('4',  'Abigail Patrick',     false, false),
  ('1',  'Alexandria Pitt',     false, false),
  ('20', 'Alice Catteau',       true,  false),
  ('2',  'Amber Weatherill',    false, false),
  ('3',  'Andy Jefferies',      false, false),
  ('24', 'April Walters',       false, false),
  ('25', 'Avry Eaddyholmes',    false, false),
  ('17', 'Declan Sewell-Sears', false, false),
  ('27', 'Diviyaj Ayengia',     false, false),
  ('23', 'Freelance',           false, false),
  ('12', 'Gabriella Murphy',    false, false),
  ('14', 'Hanna Cartwright',    true,  false),
  ('7',  'Liam Clarke',         true,  false),
  ('22', 'Libby Allen',         true,  false),
  ('8',  'Maisie Lawrence',     true,  false),
  ('19', 'Mikey Fry',           false, false),
  ('26', 'Paige Brockett',      false, false),
  ('10', 'Rita Venus',          false, false),
  ('13', 'Rose Spencer',        false, false),
  ('11', 'Sarah Davenport',     false, false),
  ('5',  'Sarah Wimpenny',      false, false),
  ('16', 'Sofia Jahn',          true,  false),
  ('21', 'Stephanie Smith',     false, false),
  ('18', 'Tom Clare',           true,  false),
  ('15', 'Venessa Meggison',    false, false),
  ('6',  'Zachary Dobos',       false, false),
  -- Dogs
  ('d1', 'Frank',  false, true),
  ('d2', 'Bruno',  false, true),
  ('d3', 'Percy',  false, true)
on conflict (id) do update set
  name = excluded.name,
  is_designer = excluded.is_designer,
  is_dog = excluded.is_dog;

-- ============================================================
-- INITIAL BOOKINGS (week of 2026-05-18)
-- ============================================================
-- Wipe any existing bookings for this seed week before re-seeding
delete from public.bookings where week_id = '2026-05-18';

insert into public.bookings (member_id, week_id, day, desk_id, status) values
  -- Monday
  ('12', '2026-05-18', 'Monday',    1,    'booked'),
  ('1',  '2026-05-18', 'Monday',    10,   'booked'),
  ('27', '2026-05-18', 'Monday',    8,    'booked'),
  -- Tuesday
  ('4',  '2026-05-18', 'Tuesday',   30,   'booked'),
  ('5',  '2026-05-18', 'Tuesday',   20,   'booked'),
  ('6',  '2026-05-18', 'Tuesday',   27,   'booked'),
  ('12', '2026-05-18', 'Tuesday',   1,    'booked'),
  ('14', '2026-05-18', 'Tuesday',   11,   'booked'),
  ('17', '2026-05-18', 'Tuesday',   17,   'booked'),
  ('20', '2026-05-18', 'Tuesday',   12,   'booked'),
  ('25', '2026-05-18', 'Tuesday',   18,   'booked'),
  ('26', '2026-05-18', 'Tuesday',   19,   'booked'),
  ('27', '2026-05-18', 'Tuesday',   10,   'booked'),
  -- Wednesday
  ('1',  '2026-05-18', 'Wednesday', 19,   'booked'),
  ('2',  '2026-05-18', 'Wednesday', 29,   'booked'),
  ('7',  '2026-05-18', 'Wednesday', 3,    'booked'),
  ('8',  '2026-05-18', 'Wednesday', 12,   'booked'),
  ('11', '2026-05-18', 'Wednesday', 11,   'booked'),
  ('12', '2026-05-18', 'Wednesday', 30,   'booked'),
  ('13', '2026-05-18', 'Wednesday', 17,   'booked'),
  ('16', '2026-05-18', 'Wednesday', 18,   'booked'),
  ('18', '2026-05-18', 'Wednesday', 16,   'booked'),
  ('22', '2026-05-18', 'Wednesday', 13,   'booked'),
  ('24', '2026-05-18', 'Wednesday', 22,   'booked'),
  ('27', '2026-05-18', 'Wednesday', 10,   'booked'),
  ('3',  '2026-05-18', 'Wednesday', null, 'sofa_surf'),
  -- Thursday
  ('1',  '2026-05-18', 'Thursday',  29,   'booked'),
  ('2',  '2026-05-18', 'Thursday',  20,   'booked'),
  ('4',  '2026-05-18', 'Thursday',  3,    'booked'),
  ('5',  '2026-05-18', 'Thursday',  2,    'booked'),
  ('6',  '2026-05-18', 'Thursday',  9,    'booked'),
  ('7',  '2026-05-18', 'Thursday',  21,   'booked'),
  ('8',  '2026-05-18', 'Thursday',  12,   'booked'),
  ('10', '2026-05-18', 'Thursday',  1,    'booked'),
  ('11', '2026-05-18', 'Thursday',  11,   'booked'),
  ('12', '2026-05-18', 'Thursday',  30,   'booked'),
  ('13', '2026-05-18', 'Thursday',  19,   'booked'),
  ('14', '2026-05-18', 'Thursday',  10,   'booked'),
  ('17', '2026-05-18', 'Thursday',  17,   'booked'),
  ('18', '2026-05-18', 'Thursday',  16,   'booked'),
  ('20', '2026-05-18', 'Thursday',  18,   'booked'),
  ('22', '2026-05-18', 'Thursday',  13,   'booked'),
  ('24', '2026-05-18', 'Thursday',  22,   'booked'),
  ('26', '2026-05-18', 'Thursday',  28,   'booked'),
  ('27', '2026-05-18', 'Thursday',  27,   'booked'),
  ('15', '2026-05-18', 'Thursday',  null, 'sofa_surf');

-- NOTE: The original seed had Sofia Jahn on Wed (desk 18) AND Avry on Wed (also 18) — a conflict.
-- It also had Maisie + Sofia both on Thu desk 12, and Hanna + Diviyaj both on Thu desk 10.
-- I've removed those duplicates so the new unique-desk-per-day constraint is satisfied.
-- If you want the *original* (conflicted) snapshot preserved verbatim, let me know.
