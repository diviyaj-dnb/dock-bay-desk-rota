import React, { useMemo, useState } from 'react';
import { DeskLayoutMap } from './DeskLayoutMap';
import { RoomsView } from './RoomsView';
import { createStubProvider } from '../lib/rooms';
import { Desk, Booking, TeamMember, DayOfWeek } from '../types';

/**
 * Design harness for the new-office floor plan, reachable at `?preview=floorplan`.
 *
 * Bypasses auth and the database so the layout can be checked in seconds.
 * Renders the real map component on fabricated data — nothing here touches
 * production. Delete once the new office is signed off.
 */

const MOCK_NAMES = [
  'Abi', 'Alex', 'Andy', 'Ben', 'Emma', 'Gabby', 'Jonathan', 'Libby',
  'Maisie', 'Pippy', 'Sarah D', 'Sofia', 'Steph', 'Tom', 'Venessa', 'Zachary',
];

// 26 desks: Table A 1-8, Table B 9-16, Table C 17-26.
const DESIGN_DESKS = new Set([3, 11, 14, 19, 24]);
const NO_SCREEN_DESKS = new Set([4, 5, 12, 13, 20, 21, 22]);

const mockDesks: Desk[] = Array.from({ length: 26 }, (_, i) => {
  const n = i + 1;
  return {
    id: n,
    number: n,
    type: DESIGN_DESKS.has(n) ? 'design' : NO_SCREEN_DESKS.has(n) ? 'no-screen' : 'regular',
    table: n <= 8 ? 'left' : n <= 16 ? 'middle' : 'right',
    row: 1,
    col: 'left',
  };
});

const mockMembers: TeamMember[] = [
  ...MOCK_NAMES.map((name, i) => ({ id: `m${i}`, name, isDesigner: i % 5 === 0 })),
  { id: 'dog1', name: 'Frank', isDog: true },
];

// A believable Wednesday: a bit over half the desks taken.
const TAKEN = [1, 2, 4, 6, 9, 10, 12, 14, 17, 18, 20, 23, 25];
const mockBookings: Booking[] = [
  ...TAKEN.map((n, i) => ({
    memberId: `m${i % MOCK_NAMES.length}`,
    weekId: '2026-10-05',
    day: 'Wednesday' as DayOfWeek,
    deskId: n,
    status: 'booked' as const,
  })),
  // A dog on the pup bed (no desk) so that hotspot is exercised too.
  {
    memberId: 'dog1',
    weekId: '2026-10-05',
    day: 'Wednesday' as DayOfWeek,
    deskId: null,
    status: 'booked' as const,
  },
];

export const FloorPlanPreview: React.FC = () => {
  const [day] = useState<DayOfWeek>('Wednesday');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'map' | 'rooms'>('map');

  // Stub data until the service account exists. Swapping to the live Calendar
  // is one line: createHttpProvider() in place of createStubProvider().
  const provider = useMemo(() => createStubProvider(), []);
  const today = useMemo(() => new Date(), []);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              New office — preview
            </h1>
            <p className="text-sm text-slate-500">
              26 desks (Table A 8 · B 8 · C 10), hotspots detected from the render.
              Rooms on stub data. Nothing here touches the database or Calendar.
            </p>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a name…"
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg shrink-0"
          />
        </div>

        <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg">
          {(['map', 'rooms'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {t === 'map' ? 'Map' : 'Rooms'}
            </button>
          ))}
        </div>

        {tab === 'map' ? (
          <DeskLayoutMap
            activeDay={day}
            desks={mockDesks}
            bookings={mockBookings}
            teamMembers={mockMembers}
            activeMemberId="m0"
            onDeskClick={(id) => console.log('[preview] desk click', id)}
            onPupBedClick={() => console.log('[preview] pup bed click')}
            searchQuery={search}
            isAdmin
          />
        ) : (
          <RoomsView date={today} provider={provider} bookerName="Diviyaj Ayengia" isAdmin />
        )}
      </div>
    </div>
  );
};
