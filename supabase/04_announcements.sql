-- Dock & Bay Desk Rota — admin-editable announcement banner (Sarah's feedback, 01 Jun)
-- Run in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/jnzihbbzfusdocuqvknm/sql/new
--
-- Single-row table: id is locked to 1 so there is exactly one banner message.
-- When `message` is empty the app falls back to the default attendance
-- reminder, so the banner is never blank. Admin-only editing is UI-enforced
-- (same posture as the rest of the app); RLS allows select + update only —
-- no insert/delete policies, so clients can never remove or duplicate the row.

create table if not exists public.announcements (
  id integer primary key default 1 check (id = 1),
  message text not null default '',
  updated_by text references public.team_members(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Seed the single row
insert into public.announcements (id, message)
values (1, '')
on conflict (id) do nothing;

-- Reuse the shared updated_at trigger function from schema.sql
drop trigger if exists trg_announcements_updated_at on public.announcements;
create trigger trg_announcements_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

-- RLS — read for everyone, update for everyone (internal app posture,
-- consistent with 02_no_auth_mode.sql). No insert/delete policies.
alter table public.announcements enable row level security;

drop policy if exists "announcements read" on public.announcements;
create policy "announcements read" on public.announcements
  for select to anon, authenticated using (true);

drop policy if exists "announcements update" on public.announcements;
create policy "announcements update" on public.announcements
  for update to anon, authenticated using (true) with check (true);
