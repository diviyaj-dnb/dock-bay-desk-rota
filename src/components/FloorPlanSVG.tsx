import React, { useState } from 'react';
import { Desk, Booking, TeamMember, DayOfWeek } from '../types';
import {
  VIEWBOX,
  OUTER_WALL,
  wallPath,
  DESKS,
  ROOMS,
  FEATURES,
  ENTRANCE,
  BANK_SPINES,
  isBaySeat,
  type DeskShape,
  type RoomShape,
} from '../lib/floorplan';

/**
 * Live state of a meeting room, read from Google Calendar.
 *
 * Rooms are NEVER booked in this app — the team has booked them in Calendar
 * since 2022 and that stays the source of truth. We read, draw, and hand off.
 */
export interface RoomStatus {
  key: RoomShape['key'];
  busy: boolean;
  /** What's in there now, e.g. "Social Squad". */
  title?: string;
  /** "until 11:30" when busy, "free till 14:00" when not. */
  detail?: string;
}

interface FloorPlanSVGProps {
  activeDay: DayOfWeek;
  desks: Desk[];
  bookings: Booking[];
  teamMembers: TeamMember[];
  activeMemberId: string | null;
  onDeskClick: (deskId: number) => void;
  onRoomClick: (room: RoomShape) => void;
  searchQuery: string;
  roomStatus?: RoomStatus[];
  isAdmin?: boolean;
  headerExtra?: React.ReactNode;
}

// Traffic lights are Sarah's locked spec: vacant green, taken red. Everything
// else on the plan is deliberately desaturated so the desks carry the signal.
const C = {
  floor: '#F7F0E6',
  floorEdge: '#EDE2D2',
  wall: '#2F3A42',
  wallSoft: '#8A98A3',
  vacant: '#34C77B',
  vacantEdge: '#1E9D5B',
  taken: '#E25563',
  takenEdge: '#B8323F',
  mine: '#1E2A33',
  inert: '#DCD2C4',
  inertEdge: '#C6B9A7',
  ink: '#2F3A42',
  muted: '#8A7F70',
} as const;

export const FloorPlanSVG: React.FC<FloorPlanSVGProps> = ({
  activeDay,
  desks,
  bookings,
  teamMembers,
  activeMemberId,
  onDeskClick,
  onRoomClick,
  searchQuery,
  roomStatus = [],
  isAdmin = false,
  headerExtra,
}) => {
  const [hovered, setHovered] = useState<{ kind: 'desk' | 'room'; id: string } | null>(null);

  const dogIds = React.useMemo(
    () => new Set(teamMembers.filter((m) => m.isDog).map((m) => m.id)),
    [teamMembers],
  );

  // Desk number -> Desk row from the DB. The SVG is keyed on the human-facing
  // desk NUMBER; the database id is an implementation detail we look up here.
  const deskByNumber = React.useMemo(() => {
    const map: Record<number, Desk> = {};
    desks.forEach((d) => (map[d.number] = d));
    return map;
  }, [desks]);

  // Human bookings for the active day, by desk id. Dogs share their owner's
  // desk and must never mark it occupied.
  const bookingsByDesk = React.useMemo(() => {
    const map: Record<number, Booking> = {};
    bookings
      .filter((b) => b.day === activeDay && b.deskId !== null && !dogIds.has(b.memberId))
      .forEach((b) => {
        if (b.deskId) map[b.deskId] = b;
      });
    return map;
  }, [bookings, activeDay, dogIds]);

  const dogsByDesk = React.useMemo(() => {
    const map: Record<number, TeamMember[]> = {};
    bookings
      .filter((b) => b.day === activeDay && b.deskId !== null && dogIds.has(b.memberId))
      .forEach((b) => {
        const dog = teamMembers.find((m) => m.id === b.memberId);
        if (dog && b.deskId) (map[b.deskId] ??= []).push(dog);
      });
    return map;
  }, [bookings, activeDay, dogIds, teamMembers]);

  const memberById = (id: string) => teamMembers.find((m) => m.id === id);
  const statusFor = (key: RoomShape['key']) => roomStatus.find((r) => r.key === key);

  const q = searchQuery.trim().toLowerCase();

  // ---------------------------------------------------------------------
  // Desks
  // ---------------------------------------------------------------------
  const renderDesk = (shape: DeskShape) => {
    const desk = deskByNumber[shape.number];
    // A desk drawn on the plan but absent from the DB is a data gap, not a
    // crash — draw it inert so the mismatch is visible rather than silent.
    const booking = desk ? bookingsByDesk[desk.id] : undefined;
    const member = booking ? memberById(booking.memberId) : null;
    const dogs = desk ? (dogsByDesk[desk.id] ?? []) : [];

    const booked = !!booking;
    const isMine = !!activeMemberId && booking?.memberId === activeMemberId;
    const isHovered = hovered?.kind === 'desk' && hovered.id === String(shape.number);
    const matchesSearch = !!q && !!member && member.name.toLowerCase().includes(q);
    const canManage = !booking || isAdmin || booking.memberId === activeMemberId;
    const bay = isBaySeat(shape.number);

    const fill = !desk ? C.inert : booked ? C.taken : C.vacant;
    const stroke = !desk ? C.inertEdge : booked ? C.takenEdge : C.vacantEdge;

    const cx = shape.x + shape.w / 2;
    const cy = shape.y + shape.h / 2;
    const transform = shape.rotate ? `rotate(${shape.rotate} ${cx} ${cy})` : undefined;

    const label = !desk
      ? `Desk ${shape.number} — not in the system`
      : booked
        ? `Desk ${shape.number} — ${member?.name ?? 'taken'}`
        : `Desk ${shape.number} — vacant, click to book`;

    return (
      <g
        key={shape.number}
        transform={transform}
        onMouseEnter={() => setHovered({ kind: 'desk', id: String(shape.number) })}
        onMouseLeave={() => setHovered(null)}
        onClick={() => desk && canManage && onDeskClick(desk.id)}
        role="button"
        tabIndex={desk && canManage ? 0 : -1}
        aria-label={label}
        onKeyDown={(e) => {
          if (desk && canManage && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onDeskClick(desk.id);
          }
        }}
        style={{ cursor: desk && canManage ? 'pointer' : 'default', outline: 'none' }}
      >
        {/* Chair on the bank's outward edge, so a bank reads as two rows of
            people facing each other rather than six loose columns. */}
        {shape.chair === 'left' && (
          <rect
            x={shape.x - 11}
            y={shape.y + 11}
            width={9}
            height={shape.h - 22}
            rx={4}
            fill={C.inertEdge}
            opacity={0.55}
          />
        )}
        {shape.chair === 'right' && (
          <rect
            x={shape.x + shape.w + 2}
            y={shape.y + 11}
            width={9}
            height={shape.h - 22}
            rx={4}
            fill={C.inertEdge}
            opacity={0.55}
          />
        )}
        {shape.chair === 'top' && (
          <rect
            x={shape.x + 12}
            y={shape.y + shape.h + 2}
            width={shape.w - 24}
            height={9}
            rx={4}
            fill={C.inertEdge}
            opacity={0.55}
          />
        )}

        <rect
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          rx={9}
          fill={fill}
          stroke={matchesSearch ? C.ink : stroke}
          strokeWidth={matchesSearch ? 3 : 1.5}
          opacity={booked ? 0.9 : 1}
          style={{ transition: 'fill 180ms ease, opacity 180ms ease' }}
        />

        {/* Hover/selection lift. */}
        {(isHovered || matchesSearch) && (
          <rect
            x={shape.x - 3}
            y={shape.y - 3}
            width={shape.w + 6}
            height={shape.h + 6}
            rx={12}
            fill="none"
            stroke={C.ink}
            strokeWidth={2}
            opacity={0.85}
          />
        )}

        {/* Your own booking gets a solid marker — findable at a glance. */}
        {isMine && (
          <circle cx={shape.x + shape.w - 11} cy={shape.y + 11} r={5} fill={C.mine} />
        )}

        {/* Bay seats carry Product priority for colour approvals. */}
        {bay && (
          <circle
            cx={shape.x + 11}
            cy={shape.y + shape.h - 11}
            r={4.5}
            fill="#F2B23E"
            stroke="#fff"
            strokeWidth={1.2}
          />
        )}

        {dogs.length > 0 && (
          <text
            x={shape.x + shape.w - 8}
            y={shape.y + shape.h - 7}
            fontSize={13}
            textAnchor="end"
          >
            🐾
          </text>
        )}

        {/* Counter-rotate so the number stays upright on the angled bay seats. */}
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fontSize={15}
          fontWeight={600}
          fill={booked ? '#fff' : '#0E5E38'}
          transform={shape.rotate ? `rotate(${-shape.rotate} ${cx} ${cy})` : undefined}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {shape.number}
        </text>
      </g>
    );
  };

  // ---------------------------------------------------------------------
  // Meeting rooms — read-only, click hands off to Google Calendar
  // ---------------------------------------------------------------------
  const renderRoom = (room: RoomShape) => {
    const st = statusFor(room.key);
    const busy = st?.busy ?? false;
    const isHovered = hovered?.kind === 'room' && hovered.id === room.key;

    // Door, drawn on the edge the plan puts it on and tinted its real colour —
    // the brief says people will navigate by the door colours.
    const door = (() => {
      const t = 7;
      const len = 46;
      switch (room.door) {
        case 'left':
          return { x: room.x - t / 2, y: room.y + room.h / 2 - len / 2, w: t, h: len };
        case 'right':
          return { x: room.x + room.w - t / 2, y: room.y + room.h / 2 - len / 2, w: t, h: len };
        case 'top':
          return { x: room.x + room.w / 2 - len / 2, y: room.y - t / 2, w: len, h: t };
        default:
          return { x: room.x + room.w / 2 - len / 2, y: room.y + room.h - t / 2, w: len, h: t };
      }
    })();

    return (
      <g
        key={room.key}
        onMouseEnter={() => setHovered({ kind: 'room', id: room.key })}
        onMouseLeave={() => setHovered(null)}
        onClick={() => onRoomClick(room)}
        role="button"
        tabIndex={0}
        aria-label={`${room.name}, ${busy ? 'in use' : 'free'} — opens Google Calendar`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onRoomClick(room);
          }
        }}
        style={{ cursor: 'pointer', outline: 'none' }}
      >
        <rect
          x={room.x}
          y={room.y}
          width={room.w}
          height={room.h}
          rx={10}
          fill={busy ? room.colour : '#FFFFFF'}
          fillOpacity={busy ? 0.14 : 0.72}
          stroke={room.colour}
          strokeWidth={isHovered ? 3 : 2}
          style={{ transition: 'fill-opacity 180ms ease' }}
        />

        {/* Busy rooms get a hatch so the state survives greyscale and colour
            blindness — never colour alone. */}
        {busy && (
          <rect
            x={room.x}
            y={room.y}
            width={room.w}
            height={room.h}
            rx={10}
            fill={`url(#hatch-${room.key})`}
            style={{ pointerEvents: 'none' }}
          />
        )}

        <rect {...door} rx={3} fill={room.colour} />

        <text
          x={room.x + room.w / 2}
          y={room.y + room.h / 2 - 6}
          textAnchor="middle"
          fontSize={16}
          fontWeight={700}
          fill={C.ink}
          style={{ pointerEvents: 'none' }}
        >
          {room.name}
        </text>
        <text
          x={room.x + room.w / 2}
          y={room.y + room.h / 2 + 14}
          textAnchor="middle"
          fontSize={12}
          fill={busy ? room.colour : C.muted}
          fontWeight={busy ? 700 : 500}
          style={{ pointerEvents: 'none' }}
        >
          {busy ? (st?.detail ?? 'In use') : 'Free'} · {room.capacity}
        </text>
      </g>
    );
  };

  // ---------------------------------------------------------------------
  // Context: furniture, storage, the communal table
  // ---------------------------------------------------------------------
  const renderFeature = (f: (typeof FEATURES)[number]) => {
    const isTable = f.kind === 'table';
    const isBlocked = f.kind === 'blocked';
    return (
      <g key={f.key} style={{ pointerEvents: 'none' }}>
        <rect
          x={f.x}
          y={f.y}
          width={f.w}
          height={f.h}
          rx={f.kind === 'wall' ? 2 : 8}
          fill={f.kind === 'wall' ? C.wallSoft : isTable ? '#FFFFFF' : C.inert}
          fillOpacity={f.kind === 'wall' ? 0.9 : isTable ? 0.9 : 0.75}
          stroke={isTable ? C.inertEdge : 'none'}
          strokeWidth={isTable ? 1.5 : 0}
          strokeDasharray={isTable ? '6 4' : undefined}
        />
        {isBlocked && (
          <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={8} fill="url(#hatch-blocked)" />
        )}
        {f.label && (
          <text
            x={f.x + f.w / 2}
            y={f.y + f.h / 2 + (f.sublabel ? -3 : 4)}
            textAnchor="middle"
            fontSize={f.kind === 'wall' ? 0 : 12}
            fontWeight={600}
            fill={C.muted}
          >
            {f.label}
          </text>
        )}
        {f.sublabel && (
          <text
            x={f.x + f.w / 2}
            y={f.y + f.h / 2 + 13}
            textAnchor="middle"
            fontSize={10}
            fill={C.muted}
          >
            {f.sublabel}
          </text>
        )}
      </g>
    );
  };

  // Tooltip content for whatever is hovered.
  const tip = (() => {
    if (!hovered) return null;
    if (hovered.kind === 'room') {
      const room = ROOMS.find((r) => r.key === hovered.id);
      const st = room && statusFor(room.key);
      if (!room) return null;
      return {
        x: room.x + room.w / 2,
        y: room.y,
        title: room.name,
        body: st?.busy
          ? `${st.title ?? 'In use'} · ${st.detail ?? ''}`
          : 'Free · click to book in Calendar',
      };
    }
    const shape = DESKS.find((d) => String(d.number) === hovered.id);
    if (!shape) return null;
    const desk = deskByNumber[shape.number];
    const booking = desk ? bookingsByDesk[desk.id] : undefined;
    const member = booking ? memberById(booking.memberId) : null;
    const dogs = desk ? (dogsByDesk[desk.id] ?? []) : [];
    const canManage = !booking || isAdmin || booking.memberId === activeMemberId;
    return {
      x: shape.x + shape.w / 2,
      y: shape.y,
      title: member ? member.name : `Desk ${shape.number}`,
      body: !desk
        ? 'Not in the system yet'
        : member
          ? `${canManage ? 'Click to edit' : 'Taken'}${dogs.length ? ` · ${dogs.map((d) => d.name).join(', ')} 🐾` : ''}`
          : isBaySeat(shape.number)
            ? 'Bay window · Product priority for colour approvals'
            : 'Vacant · click to book',
    };
  })();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/70 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Floor plan</h2>
          <p className="text-[11px] text-slate-500">{activeDay}</p>
        </div>
        {headerExtra}
      </div>

      <div className="relative bg-[#FBF7F1]">
        <svg
          viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
          className="w-full h-auto block"
          role="img"
          aria-label={`Office floor plan for ${activeDay}`}
        >
          <defs>
            <pattern id="hatch-blocked" patternUnits="userSpaceOnUse" width={8} height={8}>
              <path d="M0 8 L8 0" stroke={C.inertEdge} strokeWidth={1.5} />
            </pattern>
            {ROOMS.map((r) => (
              <pattern
                key={r.key}
                id={`hatch-${r.key}`}
                patternUnits="userSpaceOnUse"
                width={9}
                height={9}
              >
                <path d="M0 9 L9 0" stroke={r.colour} strokeWidth={1.4} opacity={0.35} />
              </pattern>
            ))}
            <filter id="floor-shadow" x="-5%" y="-5%" width="110%" height="110%">
              <feDropShadow dx="0" dy="3" stdDeviation="6" floodOpacity="0.1" />
            </filter>
          </defs>

          {/* Floor slab */}
          <path
            d={wallPath(OUTER_WALL)}
            fill={C.floor}
            stroke={C.wall}
            strokeWidth={5}
            strokeLinejoin="round"
            filter="url(#floor-shadow)"
          />

          {/* Bay glazing — the light that makes this corner worth booking, and
              the reason Product gets priority on it for colour approvals. */}
          <g stroke="#6FC2E6" strokeWidth={7} strokeLinecap="round" fill="none">
            <path d="M 620 140 L 690 66" />
            <path d="M 690 66 L 872 66" />
            <path d="M 872 66 L 942 140" />
          </g>

          {/* Entrance: gap in the wall plus a swing arc. */}
          <rect
            x={ENTRANCE.x}
            y={ENTRANCE.y - 3}
            width={ENTRANCE.w}
            height={6}
            fill={C.floor}
          />
          <path
            d={`M ${ENTRANCE.x} ${ENTRANCE.y} a ${ENTRANCE.w} ${ENTRANCE.w} 0 0 0 ${ENTRANCE.w} ${-ENTRANCE.w}`}
            fill="none"
            stroke={C.wallSoft}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          <text
            x={ENTRANCE.x + ENTRANCE.w / 2}
            y={ENTRANCE.y + 20}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill={C.muted}
            letterSpacing={1}
          >
            DOOR
          </text>

          {FEATURES.map(renderFeature)}

          {/* Cable spine running down the middle of each bank, where the two
              facing columns meet. Pure context — never interactive. */}
          {BANK_SPINES.map((s) => (
            <line
              key={s.key}
              x1={s.x}
              y1={s.y1}
              x2={s.x}
              y2={s.y2}
              stroke={C.inertEdge}
              strokeWidth={2}
              opacity={0.6}
            />
          ))}

          {ROOMS.map(renderRoom)}
          {DESKS.map(renderDesk)}
        </svg>

        {/* Tooltip rides above the SVG in HTML — far easier to style than
            SVG text, and the SVG scales uniformly so percentages line up. */}
        {tip && (
          <div
            className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full"
            style={{ left: `${(tip.x / VIEWBOX.w) * 100}%`, top: `${(tip.y / VIEWBOX.h) * 100}%` }}
          >
            <div className="mb-2 bg-slate-900 text-white rounded-lg shadow-xl px-2.5 py-1.5 whitespace-nowrap">
              <p className="text-[11px] font-semibold leading-tight">{tip.title}</p>
              <p className="text-[9px] text-slate-300 leading-tight mt-0.5">{tip.body}</p>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 border-t border-slate-100 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-[3px]"
            style={{ background: C.vacant, outline: `1px solid ${C.vacantEdge}` }}
          />
          Vacant
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-[3px]"
            style={{ background: C.taken, outline: `1px solid ${C.takenEdge}` }}
          />
          Taken
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#F2B23E' }} />
          Bay · Product priority
        </span>
        {ROOMS.map((r) => (
          <span key={r.key} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: r.colour }} />
            {r.name}
          </span>
        ))}
        <span className="text-slate-400">Communal table · no booking needed</span>
      </div>
    </div>
  );
};
