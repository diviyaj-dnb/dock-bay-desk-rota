-- Dock & Bay Desk Rota — team_members write access for the admin panel
-- Run in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/jnzihbbzfusdocuqvknm/sql/new
--
-- The admin settings panel (add member / archive member) needs insert +
-- update on team_members; until now the table only had a select policy.
-- Admin-only is UI-enforced, consistent with the rest of the app's
-- internal-trust posture (02_no_auth_mode.sql). No delete policy — members
-- are archived, never deleted, so booking history stays intact.

drop policy if exists "team_members insert" on public.team_members;
create policy "team_members insert" on public.team_members
  for insert to anon, authenticated with check (true);

drop policy if exists "team_members update" on public.team_members;
create policy "team_members update" on public.team_members
  for update to anon, authenticated using (true) with check (true);
