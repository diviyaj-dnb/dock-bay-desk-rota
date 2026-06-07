import { supabase } from './supabase';
import type { Booking, DayOfWeek, Desk, TeamMember } from '../types';
import type { Database } from './database.types';

type BookingInsert = Database['public']['Tables']['bookings']['Insert'];

type DbTeamMember = {
  id: string;
  name: string;
  email: string | null;
  is_designer: boolean;
  is_dog: boolean;
  is_admin: boolean;
  archived: boolean;
};

type DbDesk = {
  id: number;
  number: number;
  type: 'regular' | 'design' | 'no-screen';
  table_name: 'left' | 'middle' | 'right';
  row: number;
  col: 'left' | 'right';
};

type DbBooking = {
  id: string;
  member_id: string;
  week_id: string;
  day: DayOfWeek;
  desk_id: number | null;
  status: 'booked' | 'sofa_surf' | 'wfh';
};

const toTeamMember = (r: DbTeamMember): TeamMember => ({
  id: r.id,
  name: r.name,
  email: r.email,
  isDesigner: r.is_designer || undefined,
  isDog: r.is_dog || undefined,
  isAdmin: r.is_admin || undefined,
});

const toDesk = (r: DbDesk): Desk => ({
  id: r.id,
  number: r.number,
  type: r.type,
  table: r.table_name,
  row: r.row,
  col: r.col,
});

const toBooking = (r: DbBooking): Booking => ({
  memberId: r.member_id,
  weekId: r.week_id,
  day: r.day,
  deskId: r.desk_id,
  status: r.status,
});

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('archived', false)
    .order('name');
  if (error) throw error;
  return (data as DbTeamMember[]).map(toTeamMember);
}

// Admin panel: every member including archived ones, with the archived
// flag mapped so the panel can offer restore.
export async function fetchAllTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data as DbTeamMember[]).map((r) => ({
    ...toTeamMember(r),
    archived: r.archived,
  }));
}

// Admin panel: add a team member (or office pup). Email-matched to the
// Google login by the handle_new_user trigger when the person first signs in.
export async function addTeamMember(args: {
  name: string;
  email: string | null;
  isDesigner: boolean;
  isDog: boolean;
}): Promise<void> {
  const { error } = await supabase.from('team_members').insert({
    id: crypto.randomUUID(),
    name: args.name,
    email: args.email,
    is_designer: args.isDesigner,
    is_dog: args.isDog,
  });
  if (error) throw error;
}

// Admin panel: archive (soft-remove) or restore a member. Never deletes —
// booking history stays intact.
export async function setMemberArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .update({ archived })
    .eq('id', id);
  if (error) throw error;
}

export async function fetchDesks(): Promise<Desk[]> {
  const { data, error } = await supabase.from('desks').select('*').order('id');
  if (error) throw error;
  return (data as DbDesk[]).map(toDesk);
}

export async function fetchBookingsForWeek(weekId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('week_id', weekId);
  if (error) throw error;
  return (data as DbBooking[]).map(toBooking);
}

// Save a booking. If a HUMAN books a specific desk, evicts any existing human
// occupant of that desk on the same week+day first. Dogs share desks with
// humans (is_dog rows are exempt from the unique index), so dog bookings
// never evict anyone and humans never evict a dog.
// `bookedBy` records WHO performed the save (the active team member from the
// dropdown). It can differ from `memberId` if e.g. Sarah books on behalf of Diviyaj.
export async function saveBooking(args: {
  memberId: string;
  weekId: string;
  day: DayOfWeek;
  deskId: number | null;
  status: 'booked' | 'sofa_surf' | 'wfh';
  bookedBy: string | null;
  isDog?: boolean;
}): Promise<void> {
  if (args.status === 'booked' && args.deskId !== null && !args.isDog) {
    const { error: evictErr } = await supabase
      .from('bookings')
      .delete()
      .eq('week_id', args.weekId)
      .eq('day', args.day)
      .eq('desk_id', args.deskId)
      .eq('is_dog', false)
      .neq('member_id', args.memberId);
    if (evictErr) throw evictErr;
  }

  const payload: BookingInsert = {
    member_id: args.memberId,
    week_id: args.weekId,
    day: args.day,
    desk_id: args.deskId,
    status: args.status,
    booked_by: args.bookedBy,
  };
  const { error } = await supabase
    .from('bookings')
    .upsert(payload, { onConflict: 'member_id,week_id,day' });
  if (error) throw error;
}

export async function deleteBooking(
  memberId: string,
  weekId: string,
  day: DayOfWeek,
): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .delete()
    .eq('member_id', memberId)
    .eq('week_id', weekId)
    .eq('day', day);
  if (error) throw error;
}

// Announcement banner — single row (id=1). Empty message means the app
// shows its default attendance reminder.
export async function fetchAnnouncement(): Promise<string> {
  const { data, error } = await supabase
    .from('announcements')
    .select('message')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  return data?.message ?? '';
}

export async function saveAnnouncement(
  message: string,
  updatedBy: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('announcements')
    .update({ message, updated_by: updatedBy })
    .eq('id', 1);
  if (error) throw error;
}

// Wipes all bookings for `weekId`, then clones the bookings from `sourceWeekId` into it.
export async function copyBookingsBetweenWeeks(
  sourceWeekId: string,
  targetWeekId: string,
): Promise<number> {
  const source = await fetchBookingsForWeek(sourceWeekId);
  if (source.length === 0) return 0;

  const { error: delErr } = await supabase
    .from('bookings')
    .delete()
    .eq('week_id', targetWeekId);
  if (delErr) throw delErr;

  const rows: BookingInsert[] = source.map((b) => ({
    member_id: b.memberId,
    week_id: targetWeekId,
    day: b.day,
    desk_id: b.deskId,
    status: b.status,
  }));
  const { error: insErr } = await supabase.from('bookings').insert(rows);
  if (insErr) throw insErr;
  return rows.length;
}
