import React, { useState } from 'react';
import { Desk, Booking, TeamMember, DayOfWeek } from '../types';
import { ZoomIn, ZoomOut, Copy, RotateCcw, Check, MonitorOff, PenTool, PawPrint } from 'lucide-react';
import floorPlanLandscape from '../assets/floor-plan.webp';
import floorPlanPortrait from '../assets/floor-plan-mobile.webp';
import { useIsMobile } from '../lib/hooks';

type HotspotPos = { x: number; y: number; w: number; h: number };
// Landscape v5: Diviyaj's final calibration pass on the 2026-06-07 image
// (pup bed + desks 14–17 refined). Bump the key on EVERY committed
// recalibration — all browsers persist positions, so without the bump
// they'd shadow the new defaults. Portrait stays v2 (image unchanged).
const STORAGE_KEY_LANDSCAPE = 'desk_hotspot_positions_landscape_v5';
const STORAGE_KEY_PORTRAIT = 'desk_hotspot_positions_portrait_v2';

interface DeskLayoutMapProps {
  activeDay: DayOfWeek;
  desks: Desk[];
  bookings: Booking[];
  teamMembers: TeamMember[];
  activeMemberId: string | null;
  onDeskClick: (deskId: number) => void;
  onPupBedClick: () => void;
  searchQuery: string;
  // Admins can edit anyone's booking; members only their own — drives the
  // tooltip wording and pointer cursor on taken desks.
  isAdmin?: boolean;
  // Slot rendered on the right of the card header (desktop only) — used for
  // the announcement banner pill so it sits in the floor plan's white space.
  headerExtra?: React.ReactNode;
}

// Position of each desk as percentage of the image. (x, y) is centre, (w, h) is size.
// Two sets: landscape image for desktop (1916×821), portrait image for mobile (941×1672).
// Both are calibrated visually with the in-app Hot/drag/resize tool when Hot is on.
const LANDSCAPE_HOTSPOTS: Record<number, HotspotPos> = {
  // Calibrated by Diviyaj 2026-06-07 (second pass) against the door+windows
  // floor plan.
  // TABLE A (left, 10 desks, 5 rows × 2 cols)
  5:  { x: 18.39, y: 22.77, w: 5.27, h: 10.04 }, // no-screen top
  6:  { x: 25.95, y: 22.72, w: 5.18, h: 10.35 }, // no-screen top
  4:  { x: 18.38, y: 34.37, w: 5.23, h: 10.05 },
  7:  { x: 25.87, y: 34.39, w: 5.19, h: 10.15 },
  3:  { x: 18.27, y: 45.85, w: 5.25, h: 10.25 },
  8:  { x: 25.82, y: 45.82, w: 5.22, h: 10.15 }, // design
  2:  { x: 18.24, y: 57.20, w: 5.18, h: 9.89 },
  9:  { x: 25.78, y: 57.17, w: 5.29, h: 9.97 },
  1:  { x: 18.19, y: 68.67, w: 5.25, h: 10.23 },
  10: { x: 25.72, y: 68.68, w: 5.25, h: 10.28 },

  // TABLE B (middle, 8 desks, 4 rows × 2 cols)
  14: { x: 46.67, y: 26.07, w: 5.04, h: 10.92 }, // no-screen top
  15: { x: 54.26, y: 26.17, w: 5.39, h: 11.03 }, // no-screen top
  13: { x: 46.65, y: 38.02, w: 5.30, h: 10.59 },
  16: { x: 54.31, y: 37.99, w: 5.45, h: 9.96 }, // design
  12: { x: 46.73, y: 49.72, w: 5.36, h: 11.02 }, // design
  17: { x: 54.18, y: 49.63, w: 5.34, h: 10.79 },
  11: { x: 46.70, y: 61.99, w: 5.30, h: 11.27 },
  18: { x: 54.27, y: 61.94, w: 5.49, h: 10.90 }, // design

  // TABLE C (right, 12 desks, 6 rows × 2 cols)
  24: { x: 76.48, y: 18.47, w: 5.22, h: 10.41 }, // no-screen top
  25: { x: 83.93, y: 18.40, w: 5.23, h: 10.29 }, // no-screen top
  23: { x: 76.54, y: 29.57, w: 5.16, h: 9.98 }, // no-screen
  26: { x: 84.07, y: 29.69, w: 5.19, h: 10.06 },
  22: { x: 76.58, y: 41.17, w: 5.42, h: 10.70 },
  27: { x: 84.12, y: 41.17, w: 5.37, h: 9.82 },
  21: { x: 76.65, y: 52.66, w: 5.26, h: 10.01 }, // design
  28: { x: 84.28, y: 53.03, w: 5.36, h: 9.97 },
  20: { x: 76.65, y: 64.44, w: 5.28, h: 10.42 },
  29: { x: 84.30, y: 64.32, w: 5.43, h: 10.43 },
  19: { x: 76.67, y: 76.41, w: 5.49, h: 11.17 },
  30: { x: 84.49, y: 76.56, w: 5.53, h: 11.27 },
};

// Pup-bed clickable hotspot — same HotspotPos shape as desks so it can be
// calibrated with the in-app Hot tool (sentinel id 0 in livePositions below).
// Click opens the booking modal in "pup-booking" mode (dogs only, no desk).
const PUP_BED_LANDSCAPE: HotspotPos = { x: 50.33, y: 84.44, w: 7.09, h: 7.92 };
const PUP_BED_PORTRAIT: HotspotPos = { x: 5.81, y: 72.78, w: 8.89, h: 4.98 };

// Portrait hotspots — calibrated visually with the in-app Hot tool against the
// new green-mat mobile floor plan (897×1754).
const PORTRAIT_HOTSPOTS: Record<number, HotspotPos> = {
  // TABLE A (top, 10 desks, 5 rows × 2 cols)
  5:  { x: 38.69, y: 9.44,  w: 12.80, h: 4.68 },
  6:  { x: 56.39, y: 9.46,  w: 12.06, h: 4.56 },
  4:  { x: 38.70, y: 14.62, w: 12.78, h: 4.40 },
  8:  { x: 56.36, y: 14.66, w: 12.19, h: 4.42 },
  3:  { x: 38.77, y: 19.63, w: 12.53, h: 4.38 },
  7:  { x: 56.33, y: 19.63, w: 11.91, h: 4.36 },
  2:  { x: 38.81, y: 24.64, w: 12.47, h: 4.43 },
  9:  { x: 56.34, y: 24.56, w: 12.24, h: 4.32 },
  1:  { x: 38.81, y: 29.64, w: 12.64, h: 4.37 },
  10: { x: 56.45, y: 29.76, w: 12.16, h: 4.36 },

  // TABLE B (middle, 8 desks, 4 rows × 2 cols)
  14: { x: 38.67, y: 40.76, w: 12.59, h: 4.90 },
  15: { x: 56.38, y: 40.66, w: 12.18, h: 4.82 },
  13: { x: 38.76, y: 46.09, w: 12.51, h: 4.70 },
  16: { x: 56.39, y: 46.13, w: 12.19, h: 4.55 },
  12: { x: 38.79, y: 51.49, w: 12.37, h: 4.55 },
  17: { x: 56.30, y: 51.51, w: 12.31, h: 4.90 },
  11: { x: 38.75, y: 56.90, w: 12.73, h: 4.76 },
  18: { x: 56.36, y: 56.90, w: 12.08, h: 4.91 },

  // TABLE C (bottom, 12 desks, 6 rows × 2 cols)
  24: { x: 38.64, y: 67.60, w: 12.60, h: 4.55 },
  25: { x: 56.30, y: 67.63, w: 12.27, h: 4.65 },
  23: { x: 38.63, y: 72.74, w: 12.37, h: 4.60 },
  26: { x: 56.27, y: 72.77, w: 12.37, h: 4.50 },
  22: { x: 38.67, y: 77.72, w: 12.70, h: 4.44 },
  27: { x: 56.45, y: 77.73, w: 12.40, h: 4.40 },
  21: { x: 38.83, y: 82.49, w: 12.66, h: 4.09 },
  28: { x: 56.37, y: 82.52, w: 12.54, h: 4.12 },
  20: { x: 38.74, y: 87.30, w: 12.80, h: 4.31 },
  29: { x: 56.30, y: 87.30, w: 12.53, h: 4.47 },
  19: { x: 38.64, y: 92.56, w: 12.89, h: 4.82 },
  30: { x: 56.39, y: 92.46, w: 12.22, h: 4.82 },
};

export const DeskLayoutMap: React.FC<DeskLayoutMapProps> = ({
  activeDay,
  desks,
  bookings,
  teamMembers,
  activeMemberId,
  onDeskClick,
  onPupBedClick,
  searchQuery,
  isAdmin = false,
  headerExtra,
}) => {
  const [hoveredDesk, setHoveredDesk] = useState<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const imageWrapperRef = React.useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [autoFit, setAutoFit] = useState<boolean>(true);

  // Mobile vs desktop. Desktop keeps the landscape image untouched; mobile uses the portrait one.
  const isMobile = useIsMobile();
  const orientation: 'portrait' | 'landscape' = isMobile ? 'portrait' : 'landscape';
  const imgSrc = isMobile ? floorPlanPortrait : floorPlanLandscape;
  const imgWidth = isMobile ? 897 : 1918;
  const imgHeight = isMobile ? 1754 : 820;
  // Pup-bed hotspot lives in livePositions under sentinel id 0 so it participates
  // in the same drag/resize/persist/export pipeline as the desks.
  const defaultPupBed = isMobile ? PUP_BED_PORTRAIT : PUP_BED_LANDSCAPE;
  const defaultHotspots = React.useMemo(
    () => ({ ...(isMobile ? PORTRAIT_HOTSPOTS : LANDSCAPE_HOTSPOTS), 0: defaultPupBed }),
    [isMobile, defaultPupBed],
  );
  const storageKey = isMobile ? STORAGE_KEY_PORTRAIT : STORAGE_KEY_LANDSCAPE;

  // Calibration mode is gated by `?calibrate=1` in the URL. End users never see it.
  // Append `?calibrate=1` to any URL to re-enable the Hot drag/resize toolbar
  // (useful when swapping the floor-plan image and needing to re-calibrate hotspots).
  const isCalibrateMode = React.useMemo(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('calibrate') === '1',
    [],
  );
  const [showHotspots, setShowHotspots] = useState<boolean>(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [exportText, setExportText] = useState<string | null>(null);

  // Live hotspot positions — start from current orientation's defaults, override from localStorage
  const [livePositions, setLivePositions] = useState<Record<number, HotspotPos>>(() => {
    if (typeof window === 'undefined') return defaultHotspots;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) return { ...defaultHotspots, ...JSON.parse(saved) };
    } catch {}
    return defaultHotspots;
  });

  // Re-load when orientation flips (window resize crossing the breakpoint)
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      setLivePositions(saved ? { ...defaultHotspots, ...JSON.parse(saved) } : defaultHotspots);
    } catch {
      setLivePositions(defaultHotspots);
    }
    // defaultHotspots intentionally not in deps — it's a stable per-orientation constant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist on every change
  React.useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(livePositions));
    } catch {}
  }, [livePositions, storageKey]);

  const resetPositions = () => {
    if (window.confirm(`Reset ${orientation} desk positions to defaults?`)) {
      setLivePositions(defaultHotspots);
    }
  };

  const copyPositions = async () => {
    const lines = (Object.entries(livePositions) as [string, HotspotPos][])
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(
        ([id, p]) =>
          `  ${id}: { x: ${p.x.toFixed(2)}, y: ${p.y.toFixed(2)}, w: ${p.w.toFixed(2)}, h: ${p.h.toFixed(2)} },`,
      )
      .join('\n');
    const text = `// ${orientation.toUpperCase()} hotspots\n{\n${lines}\n}`;
    // Try the native clipboard API (works on localhost + HTTPS, fails silently on http LAN IPs)
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {}
    // Always also show the textarea dialog as a reliable fallback
    setExportText(text);
  };

  const startDrag = (e: React.PointerEvent, deskId: number, mode: 'move' | 'resize') => {
    if (!showHotspots) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = livePositions[deskId];
    if (!orig) return;

    const onMove = (ev: PointerEvent) => {
      const rect = imageWrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const pctDx = (dx / rect.width) * 100;
      const pctDy = (dy / rect.height) * 100;
      if (mode === 'move') {
        setLivePositions((prev) => ({
          ...prev,
          [deskId]: { ...orig, x: orig.x + pctDx, y: orig.y + pctDy },
        }));
      } else {
        const newW = Math.max(1.5, orig.w + pctDx);
        const newH = Math.max(1.5, orig.h + pctDy);
        setLivePositions((prev) => ({
          ...prev,
          [deskId]: {
            x: orig.x + (newW - orig.w) / 2,
            y: orig.y + (newH - orig.h) / 2,
            w: newW,
            h: newH,
          },
        }));
      }
    };
    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  };

  // Auto-fit (currently a no-op multiplier of 1, kept for resize observer hookup)
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const recalc = () => {
      if (!autoFit) return;
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      const imgAspect = imgWidth / imgHeight;
      const containerAspect = width / height;
      const scale = containerAspect > imgAspect ? 1 : 1;
      setZoom(Math.max(0.5, Math.min(1.5, scale)));
    };

    const resizeObserver = new ResizeObserver(recalc);
    resizeObserver.observe(container);
    recalc();

    return () => resizeObserver.disconnect();
  }, [autoFit, imgWidth, imgHeight]);

  const dogIds = React.useMemo(
    () => new Set(teamMembers.filter((m) => m.isDog).map((m) => m.id)),
    [teamMembers],
  );

  // HUMAN bookings indexed by deskId for activeDay — dogs share desks and
  // must not mark a desk as occupied.
  const bookingsByDesk = React.useMemo(() => {
    const map: Record<number, Booking> = {};
    bookings
      .filter((b) => b.day === activeDay && b.deskId !== null && !dogIds.has(b.memberId))
      .forEach((b) => {
        if (b.deskId) map[b.deskId] = b;
      });
    return map;
  }, [bookings, activeDay, dogIds]);

  // Dogs sitting AT a desk (with their owner) — drives the paw badge.
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

  const getMemberById = (id: string) => teamMembers.find((m) => m.id === id);

  // Dogs on the PUP BED today (desk-sitting dogs show on their desk instead)
  const bookedDogs = React.useMemo(() => {
    return bookings
      .filter((b) => b.day === activeDay && b.status === 'booked' && b.deskId === null)
      .map((b) => teamMembers.find((m) => m.id === b.memberId))
      .filter((m): m is TeamMember => !!m && !!m.isDog);
  }, [bookings, activeDay, teamMembers]);

  const doesDeskMatchSearch = (deskId: number) => {
    if (!searchQuery) return false;
    const booking = bookingsByDesk[deskId];
    if (!booking) return false;
    const member = getMemberById(booking.memberId);
    return !!member && member.name.toLowerCase().includes(searchQuery.toLowerCase());
  };

  // Render a single desk hotspot
  const renderDesk = (desk: Desk) => {
    const pos = livePositions[desk.id];
    if (!pos) return null;

    const booking = bookingsByDesk[desk.id];
    const member = booking ? getMemberById(booking.memberId) : null;
    const deskDogs = dogsByDesk[desk.id] ?? [];
    // Members can only manage their own booking — on someone else's taken
    // desk the click is a no-op, so don't advertise editing.
    const canManage = !booking || isAdmin || booking.memberId === activeMemberId;
    const isHovered = hoveredDesk === desk.id;
    const isSearched = doesDeskMatchSearch(desk.id);
    const isActiveUserHere = !!activeMemberId && !!booking && booking.memberId === activeMemberId;
    const isEditing = showHotspots;
    // Booked-but-not-currently-interactive: render a soft grey overlay so booked
    // desks visually recede and vacant desks (full-colour desk mat) pop.
    const isBooked = !!booking;

    return (
      <div
        key={desk.id}
        id={`desk-${desk.id}`}
        onMouseEnter={() => setHoveredDesk(desk.id)}
        onMouseLeave={() => setHoveredDesk(null)}
        onPointerDown={(e) => isEditing && startDrag(e, desk.id, 'move')}
        onClick={(e) => {
          if (isEditing) {
            e.stopPropagation();
            return;
          }
          onDeskClick(desk.id);
        }}
        className={`absolute group ${
          isEditing ? 'cursor-move' : canManage ? 'cursor-pointer' : 'cursor-default'
        }`}
        style={{
          left: `${pos.x - pos.w / 2}%`,
          top: `${pos.y - pos.h / 2}%`,
          width: `${pos.w}%`,
          height: `${pos.h}%`,
          touchAction: isEditing ? 'none' : 'auto',
        }}
      >
        {/* Hotspot ring + fill. Traffic-light model: vacant desks show the
            green mat through (no fill), booked desks get a red overlay —
            green = go, red = taken. */}
        <div
          className={`absolute inset-0 rounded-md transition-all duration-200 ease-out ${
            isSearched
              ? 'ring-2 ring-[#f3705a] ring-offset-1 ring-offset-transparent shadow-[0_0_0_4px_rgba(243,112,90,0.25)] scale-105'
              : isActiveUserHere
                ? 'ring-2 ring-slate-900 scale-[1.03] bg-red-600/45'
                : isHovered
                  // Booked desks KEEP their red fill on hover — only the ring
                  // and scale change, so red never flashes green mid-hover.
                  ? `ring-2 ring-slate-900/70 scale-[1.04] shadow-md ${
                      isBooked ? 'bg-red-600/50' : 'bg-white/15'
                    }`
                  : isEditing
                    ? 'ring-1 ring-dashed ring-red-500/70 bg-red-500/10'
                    : isBooked
                      ? 'bg-red-600/50 ring-1 ring-red-800/30'
                      : ''
          }`}
          style={{ transformOrigin: 'center' }}
        />

        {/* Paw badge — a dog is sitting at this desk with its owner */}
        {!isEditing && deskDogs.length > 0 && (
          <div className="absolute bottom-0.5 right-0.5 pointer-events-none z-10">
            <span
              className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-400 text-white shadow-sm ring-1 ring-white/80"
              title={deskDogs.map((d) => d.name).join(', ')}
            >
              <PawPrint className="w-2 h-2" />
            </span>
          </div>
        )}

        {/* Desk-type badge — persistent corner chip so design / no-screen desks
            read at a glance without hover (mobile has no hover at all).
            Hidden in calibration mode so it never blocks drag handles. */}
        {!isEditing && desk.type !== 'regular' && (
          <div className="absolute top-0.5 left-0.5 pointer-events-none z-10">
            <span
              className={`flex items-center justify-center w-3.5 h-3.5 rounded-full shadow-sm ring-1 ${
                desk.type === 'design'
                  ? 'bg-[#f3705a] text-white ring-white/80'
                  : 'bg-white/95 text-slate-500 ring-slate-300'
              }`}
            >
              {desk.type === 'design' ? (
                <PenTool className="w-2 h-2" />
              ) : (
                <MonitorOff className="w-2 h-2" />
              )}
            </span>
          </div>
        )}

        {/* Resize handle — calibration mode only */}
        {isEditing && (
          <div
            onPointerDown={(e) => startDrag(e, desk.id, 'resize')}
            onClick={(e) => e.stopPropagation()}
            className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-red-500 border border-white rounded-sm shadow z-20"
            style={{ cursor: 'nwse-resize', touchAction: 'none' }}
            title="Drag to resize"
          />
        )}

        {/* Centered slot: avatar when booked, desk number when vacant.
            Seat-map pattern — each desk is self-describing without floating UI stickers. */}
        {!isEditing && member && !member.isDog ? (() => {
          const initials = member.name
            .split(' ')
            .map((p) => p[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          return (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold leading-none shadow-md ring-2 ring-white ${
                isActiveUserHere ? 'bg-[#f3705a] text-white' : 'bg-slate-900 text-white'
              }`}>
                {initials}
              </div>
            </div>
          );
        })() : (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Bare numeral in Space Grotesk — a soft text-shadow keeps it
                legible on the green mat without any backing chip. */}
            <span
              className="text-[10px] font-semibold text-white leading-none tabular-nums"
              style={{
                fontFamily: 'var(--font-display)',
                textShadow: '0 1px 1.5px rgba(0,0,0,0.35)',
              }}
            >
              {desk.number}
            </span>
          </div>
        )}

        {/* Tooltip on hover (suppressed during calibration) — compact 2-line pill */}
        {isHovered && !isEditing && (
          <div className="absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full bg-slate-900 text-white rounded-lg shadow-xl z-50 pointer-events-none whitespace-nowrap px-2.5 py-1.5">
            {booking ? (
              <>
                <p className="text-[11px] font-semibold leading-tight">
                  {member?.name}
                  {deskDogs.length > 0 && (
                    <span className="text-amber-300">
                      {' '}· 🐾 {deskDogs.map((d) => d.name).join(', ')}
                    </span>
                  )}
                </p>
                <p className="text-[9px] text-slate-400 leading-tight mt-0.5">
                  Desk {desk.number} · {canManage ? 'click to edit' : 'taken'}
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-semibold leading-tight">Desk {desk.number}</p>
                <p className="text-[9px] text-slate-400 leading-tight mt-0.5">
                  <span className="text-emerald-400">Vacant</span>
                  {desk.type !== 'regular' && (
                    <> · {desk.type === 'design' ? 'Design' : 'No screen'}</>
                  )}
                  {' · click to book'}
                </p>
              </>
            )}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-slate-900 rotate-45" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-transparent md:bg-white md:rounded-2xl md:border md:border-slate-200 md:shadow-sm p-0 md:p-5 h-full flex flex-col overflow-hidden">
      {/* Header strip with title — desktop only (mobile maximises vertical space) */}
      <div className="hidden md:flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 shrink-0">
        {/* Equal flex flanks keep the banner pill truly centred in the card */}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
            Office floor plan
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any desk to manage the booking.
          </p>
        </div>
        {headerExtra && (
          <>
            <div className="flex justify-center min-w-0 px-2">{headerExtra}</div>
            <div className="flex-1 hidden lg:block" />
          </>
        )}
      </div>

      {/* Floor plan image with hotspot overlays */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 w-full overflow-hidden bg-transparent md:bg-slate-50 md:border md:border-slate-200 md:rounded-xl flex items-center justify-center"
      >
        {/* Scrollable image wrapper */}
        <div className="w-full h-full overflow-auto flex items-start md:items-center justify-center">
          <div
            ref={imageWrapperRef}
            className={`relative shrink-0 max-w-full ${isMobile ? '' : 'max-h-full'}`}
            style={{
              // On mobile (portrait image), width-anchor so the floor plan fills
              // the full screen width (crops the decorative top/bottom margin a
              // touch). On desktop (landscape), width-anchor as before.
              ...(isMobile
                ? { width: `${zoom * 100}%` }
                : { width: `${zoom * 100}%`, maxWidth: `${zoom * 100}%` }),
              aspectRatio: `${imgWidth} / ${imgHeight}`,
              transition: 'width 0.15s ease-out, height 0.15s ease-out',
            }}
          >
            <img
              src={imgSrc}
              alt="Office floor plan"
              width={imgWidth}
              height={imgHeight}
              fetchPriority="high"
              decoding="async"
              className="w-full h-full block select-none"
              draggable={false}
            />

            {/* Desk hotspots */}
            {desks.map((desk) => renderDesk(desk))}

            {/* Pup-bed clickable hotspot — sentinel id 0 in livePositions */}
            {(() => {
              const pos = livePositions[0];
              if (!pos) return null;
              const isEditing = showHotspots;
              const isHovered = hoveredDesk === 0;
              return (
                <div
                  key="pup-bed"
                  id="desk-0"
                  onMouseEnter={() => setHoveredDesk(0)}
                  onMouseLeave={() => setHoveredDesk(null)}
                  onPointerDown={(e) => isEditing && startDrag(e, 0, 'move')}
                  onClick={(e) => {
                    if (isEditing) {
                      e.stopPropagation();
                      return;
                    }
                    onPupBedClick();
                  }}
                  className={`absolute group ${isEditing ? 'cursor-move' : 'cursor-pointer'}`}
                  style={{
                    left: `${pos.x - pos.w / 2}%`,
                    top: `${pos.y - pos.h / 2}%`,
                    width: `${pos.w}%`,
                    height: `${pos.h}%`,
                    touchAction: isEditing ? 'none' : 'auto',
                  }}
                  title="Book the pup bed"
                  aria-label="Book the pup bed"
                >
                  <div
                    className={`absolute inset-0 rounded-2xl transition-all duration-200 ease-out ${
                      isHovered && !isEditing
                        ? 'ring-2 ring-amber-400 bg-amber-200/25 scale-[1.04] shadow-md'
                        : isEditing
                          ? 'ring-1 ring-dashed ring-red-500/70 bg-red-500/10'
                          : ''
                    }`}
                  />
                  {isEditing && (
                    <div
                      onPointerDown={(e) => startDrag(e, 0, 'resize')}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-red-500 border border-white rounded-sm shadow z-20"
                      style={{ cursor: 'nwse-resize', touchAction: 'none' }}
                      title="Drag to resize"
                    />
                  )}
                  <div className="absolute top-0.5 left-0.5 pointer-events-none">
                    <span className="inline-flex items-center justify-center text-[11px] leading-none bg-white/85 backdrop-blur-sm rounded px-1 py-0.5 shadow-sm">
                      🐾
                    </span>
                  </div>
                  {isHovered && !isEditing && (
                    <div className="absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full bg-slate-900 text-white rounded-lg shadow-xl z-50 pointer-events-none whitespace-nowrap px-2.5 py-1.5">
                      {bookedDogs.length > 0 ? (
                        <>
                          <p className="text-[11px] font-semibold leading-tight">
                            {bookedDogs.map((d) => d.name).join(', ')}
                          </p>
                          <p className="text-[9px] text-slate-400 leading-tight mt-0.5">
                            Pup bed · click to manage
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-[11px] font-semibold leading-tight">Pup bed</p>
                          <p className="text-[9px] text-slate-400 leading-tight mt-0.5">
                            <span className="text-emerald-400">Vacant</span> · click to book a pup
                          </p>
                        </>
                      )}
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-slate-900 rotate-45" />
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Export dialog — fallback for when clipboard API isn't available (mobile non-HTTPS) */}
            {exportText && (
              <div
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                onClick={() => setExportText(null)}
              >
                <div
                  className="bg-white rounded-2xl shadow-xl p-4 max-w-lg w-full flex flex-col gap-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Hotspot positions ({orientation})</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Tap into the box → Select All → Copy. Then paste back into chat.
                    </p>
                  </div>
                  <textarea
                    readOnly
                    value={exportText}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full h-64 p-2 text-[10px] font-mono bg-slate-50 border border-slate-200 rounded resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(exportText);
                          setCopyState('copied');
                          setTimeout(() => setCopyState('idle'), 1500);
                        } catch {}
                      }}
                      className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg cursor-pointer"
                    >
                      {copyState === 'copied' ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={() => setExportText(null)}
                      className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Pup-bed live indicator — names floating on the bed.
                Hidden by default (would block the dog photo); appears on hover only.
                The pup-bed hotspot tooltip also shows the names. */}
            {bookedDogs.length > 0 && livePositions[0] && hoveredDesk === 0 && (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: `${livePositions[0].x}%`, top: `${livePositions[0].y}%` }}
              >
                <div className="flex items-center gap-1 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-full shadow-sm border border-amber-200">
                  {bookedDogs.map((dog) => {
                    const isSelected = activeMemberId === dog.id;
                    return (
                      <span
                        key={dog.id}
                        className={`text-[10px] font-semibold leading-none px-1 ${
                          isSelected ? 'text-amber-700' : 'text-slate-700'
                        }`}
                        title={dog.name}
                      >
                        {dog.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Zoom + calibration toolbar — lives in the white-space band below the image,
          so it never sits on top of the floor plan (and never covers the pup bed).
          The legend pill sits alongside so new starters can decode the map. */}
      <div className="flex justify-center items-center gap-2 pt-2 pb-1 shrink-0 flex-wrap">
        <div className="bg-white border border-slate-200 shadow-sm rounded-md px-2.5 py-1 flex items-center gap-2.5 text-[9px] font-medium text-slate-600">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-[3px] bg-emerald-500/70 ring-1 ring-emerald-700/30" />
            Free
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-[3px] bg-red-600/60 ring-1 ring-red-800/30" />
            Taken
          </span>
          <span className="flex items-center gap-1">
            <span className="flex items-center justify-center w-3 h-3 rounded-full bg-[#f3705a] text-white">
              <PenTool className="w-1.5 h-1.5" />
            </span>
            Design
          </span>
          <span className="flex items-center gap-1">
            <span className="flex items-center justify-center w-3 h-3 rounded-full bg-white ring-1 ring-slate-300 text-slate-500">
              <MonitorOff className="w-1.5 h-1.5" />
            </span>
            No monitor
          </span>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm rounded-md px-0.5 py-0.5 flex items-center gap-0.5">
          <button
            onClick={() => {
              setAutoFit(false);
              setZoom((p) => Math.max(0.5, p - 0.1));
            }}
            className="p-0.5 hover:bg-slate-100 rounded text-slate-600 transition-colors"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3 h-3" />
          </button>
          <span className="text-[9px] font-medium w-7 text-center text-slate-700 tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => {
              setAutoFit(false);
              setZoom((p) => Math.min(1.5, p + 0.1));
            }}
            className="p-0.5 hover:bg-slate-100 rounded text-slate-600 transition-colors"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3 h-3" />
          </button>
          <button
            onClick={() => {
              setAutoFit(true);
              setZoom(1);
            }}
            className={`px-1.5 py-0 rounded text-[9px] font-medium transition-colors border-l border-slate-200 ml-0.5 ${
              autoFit ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
            title="Fit to view"
          >
            Fit
          </button>
          {isCalibrateMode && (
            <>
              <button
                onClick={() => setShowHotspots((p) => !p)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors border-l border-slate-200 ${
                  showHotspots ? 'bg-red-500 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
                title={`Calibrate ${orientation} hotspots`}
              >
                Hot
              </button>
              {showHotspots && (
                <>
                  <button
                    onClick={resetPositions}
                    className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors border-l border-slate-200"
                    title="Reset to source defaults"
                    aria-label="Reset positions"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={copyPositions}
                    className={`p-1 rounded transition-colors flex items-center gap-1 px-2 ${
                      copyState === 'copied'
                        ? 'bg-emerald-500 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Copy positions JSON"
                  >
                    {copyState === 'copied' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-medium">Copy</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
