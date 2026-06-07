import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import {
  fetchBookingsForWeek,
  fetchDesks,
  fetchTeamMembers,
} from './repository';
import type { Booking, Desk, TeamMember } from '../types';

// Returns true when viewport is narrower than the breakpoint (default 768px / Tailwind md).
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < breakpoint;
  });
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return isMobile;
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

export function useTeamMembers(enabled: boolean) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    fetchTeamMembers()
      .then((m) => active && setMembers(m))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [enabled]);

  // reload: refetch after admin-panel changes (add / archive member)
  return { members, loading, error, reload: () => fetchTeamMembers().then(setMembers) };
}

export function useDesks(enabled: boolean) {
  const [desks, setDesks] = useState<Desk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    fetchDesks()
      .then((d) => active && setDesks(d))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [enabled]);

  return { desks, loading, error };
}

// Fetches bookings for a single week and subscribes to realtime changes
// so multiple browsers stay in sync without refresh.
export function useBookingsForWeek(weekId: string, enabled: boolean) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);

    const load = () =>
      fetchBookingsForWeek(weekId)
        .then((b) => {
          if (active) setBookings(b);
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });

    load();

    const channel = supabase
      .channel(`bookings-${weekId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `week_id=eq.${weekId}`,
        },
        () => {
          load();
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [weekId, enabled]);

  return { bookings, loading, error, reload: () => fetchBookingsForWeek(weekId).then(setBookings) };
}
