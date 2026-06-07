-- Dock & Bay Desk Rota — harden new-user auto-linking (2026-06-07)
-- Run in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/jnzihbbzfusdocuqvknm/sql/new
--
-- Problem: handle_new_user linked a Google login to a seeded team_members row
-- only by EXACT full-name match, else it created a brand-new row. Any display-
-- name drift ("Mais" vs "Maisie", nicknames, maiden names) produced a duplicate.
-- With ~22 staff about to log in for the first time, that would mean a wave of
-- duplicate rows.
--
-- Fix: add a third match strategy BEFORE creating a new row — match the email
-- local-part to a team member's first name (D&B uses firstname@dockandbay.com),
-- but ONLY when exactly one active, email-less, non-dog row matches (so genuine
-- first-name clashes, e.g. two Sarahs, never link to the wrong person).
--
-- Match order: (a) existing email link → (b) exact full-name → (c) NEW: unique
-- first-name = email prefix → (d) create fresh row.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email  text := new.email;
  v_local  text := lower(split_part(new.email, '@', 1));  -- e.g. "maisie"
  v_name   text := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    initcap(replace(split_part(new.email, '@', 1), '.', ' '))
  );
  v_match  text;
  v_count  int;
begin
  -- (a) already linked by email?
  select id into v_match from public.team_members
    where lower(email) = lower(v_email) limit 1;
  if v_match is not null then
    return new;
  end if;

  -- (b) link to an existing email-less row by exact name?
  select id into v_match from public.team_members
    where lower(name) = lower(v_name) and email is null and is_dog = false
    limit 1;
  if v_match is not null then
    update public.team_members set email = v_email where id = v_match;
    return new;
  end if;

  -- (c) link by email prefix = first name, only when UNAMBIGUOUS.
  --     Handles display-name drift on the firstname@dockandbay.com convention.
  select count(*), min(id) into v_count, v_match
    from public.team_members
    where email is null and is_dog = false and archived = false
      and lower(split_part(name, ' ', 1)) = v_local;
  if v_count = 1 then
    update public.team_members set email = v_email where id = v_match;
    return new;
  end if;

  -- (d) no safe match — create a fresh team member from the Google identity
  insert into public.team_members (id, name, email, is_designer, is_dog, archived)
  values (new.id::text, v_name, v_email, false, false, false)
  on conflict (id) do nothing;

  return new;
end;
$function$;
