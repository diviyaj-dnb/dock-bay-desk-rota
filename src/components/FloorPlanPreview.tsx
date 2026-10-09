import React, { useState } from 'react';
import { FloorPlanSVG, type RoomStatus } from './FloorPlanSVG';
import { DESKS } from '../lib/floorplan';
import { Desk, Booking, TeamMember, DayOfWeek } from '../types';

/**
 * Design harness for the new-office floor plan, reachable at `?preview=floorplan`.
 *
 * It bypasses auth and the database so the geometry can be iterated on in
 * seconds. It renders the real component with fabricated data — nothing here
 * touches production. Delete once the office layout is signed off.
 */

const MOCK_NAMES = [
  'Abi', 'Alex', 'Andy', 'Ben', 'Emma', 'Gabby', 'Jonathan', 'Libby',
  'Maisie', 'Pippy', 'Sarah D', 'Sofia', 'Steph', 'Tom', 'Venessa', 'Zachary',
];

const mockDesks: Desk[] = DESKS.map((d, i) => ({
  id: 100 + d.number,
  number: d.number,
  type: d.zone === 'bay' ? 'regular' : i % 7 === 3 ? 'design' : i % 5 === 2 ? 'no-screen' : 'regular',
  table: 'left',
  row: 1,
  col: 'left',
}));

const mockMembers: TeamMember[] = [
  ...MOCK_NAMES.map((name, i) => ({ id: `m${i}`, name })),
  { id: 'dog1', name: 'Frank', isDog: true },
];

// A believable Wednesday: a bit over half the desks taken.
const TAKEN_NUMBERS = [1, 2, 4, 6, 9, 10, 12, 14, 17, 18, 20, 23, 25, 27];
const mockBookings: Booking[] = TAKEN_NUMBERS.map((n, i) => ({
  memberId: `m${i % MOCK_NAMES.length}`,
  weekId: '2026-10-05',
  day: 'Wednesday' as DayOfWeek,
  deskId: 100 + n,
  status: 'booked' as const,
})).concat([
  { memberId: 'dog1', weekId: '2026-10-05', day: 'Wednesday', deskId: 101, status: 'booked' },
]);

const mockRoomStatus: RoomStatus[] = [
  { key: 'beach-please', busy: true, title: 'Social Squad', detail: 'until 12:30' },
  { key: 'stripe-studio', busy: false },
  { key: 'pod', busy: false },
];

export const FloorPlanPreview: React.FC = () => {
  const [day] = useState<DayOfWeek>('Wednesday');
  const [search, setSearch] = useState('');

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              New office floor plan — preview
            </h1>
            <p className="text-sm text-slate-500">
              Mock data. {DESKS.length} desks drawn. Not connected to the database.
            </p>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a name…"
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
          />
        </div>

        <FloorPlanSVG
          activeDay={day}
          desks={mockDesks}
          bookings={mockBookings}
          teamMembers={mockMembers}
          activeMemberId="m0"
          onDeskClick={(id) => console.log('[preview] desk click', id)}
          onRoomClick={(r) => console.log('[preview] room click', r.name)}
          searchQuery={search}
          roomStatus={mockRoomStatus}
          isAdmin
        />
      </div>
    </div>
  );
};
