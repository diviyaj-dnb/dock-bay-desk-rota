import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Users, ChevronDown, Monitor, Sofa, PawPrint } from 'lucide-react';
import type { TeamMember, Booking, Desk, DayOfWeek } from '../types';

interface WhoIsInProps {
  teamMembers: TeamMember[];
  bookings: Booking[]; // already the active week's bookings
  desks: Desk[];
  activeDay: DayOfWeek;
  activeMemberId: string | null;
}

const initialsOf = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

// "Who's in today" — replaces the old Team dropdown. Shows an overlapping
// avatar stack + a live headcount; clicking opens a grouped roster
// (At a desk / Sofa surfing / Pups) for the selected day.
export const WhoIsIn: React.FC<WhoIsInProps> = ({
  teamMembers,
  bookings,
  desks,
  activeDay,
  activeMemberId,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const memberById = useMemo(() => {
    const map: Record<string, TeamMember> = {};
    teamMembers.forEach((m) => (map[m.id] = m));
    return map;
  }, [teamMembers]);

  const deskNumberById = useMemo(() => {
    const map: Record<number, number> = {};
    desks.forEach((d) => (map[d.id] = d.number));
    return map;
  }, [desks]);

  // Everyone physically in today (a desk or the sofa). WFH excluded.
  const todays = useMemo(
    () => bookings.filter((b) => b.day === activeDay && b.status !== 'wfh'),
    [bookings, activeDay],
  );

  const atDesk = todays
    .filter((b) => b.status === 'booked' && b.deskId !== null && !memberById[b.memberId]?.isDog)
    .map((b) => ({ b, m: memberById[b.memberId] }))
    .filter((x) => x.m)
    .sort((a, b) => a.m.name.localeCompare(b.m.name));

  const sofa = todays
    .filter((b) => b.status === 'sofa_surf')
    .map((b) => ({ b, m: memberById[b.memberId] }))
    .filter((x) => x.m)
    .sort((a, b) => a.m.name.localeCompare(b.m.name));

  const pups = todays
    .filter((b) => b.status === 'booked' && memberById[b.memberId]?.isDog)
    .map((b) => ({ b, m: memberById[b.memberId] }))
    .filter((x) => x.m)
    .sort((a, b) => a.m.name.localeCompare(b.m.name));

  const peopleCount = atDesk.length + sofa.length;
  const stackForAvatars = [...atDesk, ...sofa].slice(0, 5);
  const overflow = peopleCount - stackForAvatars.length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border transition-all duration-150 cursor-pointer active:scale-[0.98] ${
          open
            ? 'bg-slate-900 text-white border-slate-900'
            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
        }`}
        title="See who's in today"
      >
        {/* Avatar stack */}
        {peopleCount > 0 ? (
          <span className="flex -space-x-2">
            {stackForAvatars.map(({ m }) => (
              <span
                key={m.id}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ring-2 ring-white ${
                  m.id === activeMemberId ? 'bg-[#f3705a] text-white' : 'bg-slate-800 text-white'
                }`}
                title={m.name}
              >
                {initialsOf(m.name)}
              </span>
            ))}
            {overflow > 0 && (
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ring-2 ring-white bg-slate-200 text-slate-600">
                +{overflow}
              </span>
            )}
          </span>
        ) : (
          <span className="w-6 h-6 rounded-full flex items-center justify-center bg-slate-100 text-slate-400">
            <Users className="w-3.5 h-3.5" />
          </span>
        )}
        <span className="text-xs font-semibold tabular-nums">{peopleCount} in today</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[70vh]">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">In the office today</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{activeDay}</p>
            </div>
            <span className="text-lg font-bold text-slate-900 tabular-nums">{peopleCount}</span>
          </div>

          <div className="overflow-y-auto p-2 custom-scrollbar">
            {peopleCount === 0 && pups.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">No-one booked in yet.</p>
            )}

            {atDesk.length > 0 && (
              <Group icon={<Monitor className="w-3 h-3" />} label="At a desk" count={atDesk.length}>
                {atDesk.map(({ b, m }) => (
                  <Row
                    key={m.id}
                    name={m.name}
                    initials={initialsOf(m.name)}
                    me={m.id === activeMemberId}
                    chip={b.deskId !== null ? `Desk ${deskNumberById[b.deskId] ?? b.deskId}` : ''}
                  />
                ))}
              </Group>
            )}

            {sofa.length > 0 && (
              <Group icon={<Sofa className="w-3 h-3" />} label="Sofa surfing" count={sofa.length}>
                {sofa.map(({ m }) => (
                  <Row key={m.id} name={m.name} initials={initialsOf(m.name)} me={m.id === activeMemberId} chip="Sofa" />
                ))}
              </Group>
            )}

            {pups.length > 0 && (
              <Group icon={<PawPrint className="w-3 h-3" />} label="Pups" count={pups.length}>
                {pups.map(({ m }) => (
                  <Row key={m.id} name={m.name} initials="🐶" me={false} chip="Pup bed" isDog />
                ))}
              </Group>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Group: React.FC<{ icon: React.ReactNode; label: string; count: number; children: React.ReactNode }> = ({
  icon,
  label,
  count,
  children,
}) => (
  <div className="mb-1.5 last:mb-0">
    <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
      {icon}
      <span>{label}</span>
      <span className="tabular-nums">· {count}</span>
    </div>
    <div className="space-y-0.5">{children}</div>
  </div>
);

const Row: React.FC<{ name: string; initials: string; me: boolean; chip: string; isDog?: boolean }> = ({
  name,
  initials,
  me,
  chip,
  isDog = false,
}) => (
  <div className="w-full px-2 py-1.5 rounded-lg flex items-center justify-between hover:bg-slate-50">
    <span className="flex items-center gap-2 truncate">
      <span
        className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
          isDog ? 'bg-amber-100' : me ? 'bg-[#f3705a] text-white' : 'bg-slate-800 text-white'
        }`}
      >
        {initials}
      </span>
      <span className="truncate text-xs font-medium text-slate-700">
        {name}
        {me && <span className="text-slate-400 font-normal"> · you</span>}
      </span>
    </span>
    <span className="text-[10px] font-medium text-slate-400 shrink-0 ml-2 tabular-nums">{chip}</span>
  </div>
);
