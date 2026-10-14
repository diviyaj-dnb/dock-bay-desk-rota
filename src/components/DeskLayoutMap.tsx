import React, { useState } from 'react';
import { Desk, Booking, TeamMember, DayOfWeek } from '../types';
import { ZoomIn, ZoomOut, Copy, RotateCcw, Check, MonitorOff, PenTool, PawPrint } from 'lucide-react';
import floorPlanLandscape from '../assets/floor-plan.webp';
import floorPlanPortrait from '../assets/floor-plan-mobile.webp';
import { useIsMobile } from '../lib/hooks';

type HotspotPos = { x: number; y: number; w: number; h: number };
// Landscape v8: detected against the "final" render (2750x1536), which adds
// the green bucket seats beside the white table. Those are NOT desks.
// Bump the key on EVERY committed recalibration: every browser persists
// positions, so without the bump they would shadow the new defaults.
// Portrait stays v2 (image unchanged, and PORTRAIT_READY is still false).
const STORAGE_KEY_LANDSCAPE = 'desk_hotspot_positions_landscape_v8_final';
const STORAGE_KEY_PORTRAIT = 'desk_hotspot_positions_portrait_v2';

// Portrait render of the NEW office not supplied yet — see the usePortrait
// comment below. Flip to true in the same commit that ships the new image.
const PORTRAIT_READY = false;

interface DeskLayoutMapProps {
  activeDay: DayOfWeek;
  desks: Desk[];
  bookings: Booking[];
  teamMembers: TeamMember[];
  activeMemberId: string | null;
  onDeskClick: (deskId: number) => void;
  searchQuery: string;
  // Admins can edit anyone's booking; members only their own — drives the
  // tooltip wording and pointer cursor on taken desks.
  isAdmin?: boolean;
  // Slot rendered on the right of the card header (desktop only) — used for
  // the announcement banner pill so it sits in the floor plan's white space.
  headerExtra?: React.ReactNode;
}

// Position of each desk as percentage of the image. (x, y) is centre, (w, h) is size.
// Landscape image for desktop (2560x1093), portrait image for mobile.
//
// LANDSCAPE was DETECTED, not hand-dragged: a script masked the green desk mats
// in the render, flood-filled the blobs and emitted these percentages. 26 mats
// found, grouping 4+4 / 4+4 / 5+5 exactly as the new office plan specifies.
// Re-run scripts/detect-desks.py on any future render instead of calibrating.
// NOTE: keys are DESK IDs, not desk numbers. The new-office desks live at
// ids 101-126 (numbers 1-26) because the old 30 are archived, not deleted:
// 512 bookings still FK to desks(id). See supabase/09_new_office_desks.sql.
const LANDSCAPE_HOTSPOTS: Record<number, HotspotPos> = {
  // TABLE A - 8 desks
  101: { x: 29.76, y: 24.48, w: 3.05, h: 6.45 },
  102: { x: 29.76, y: 31.74, w: 3.05, h: 6.51 },
  103: { x: 29.71, y: 39.03, w: 3.02, h: 6.51 },
  104: { x: 29.69, y: 46.22, w: 3.05, h: 6.32 },
  105: { x: 33.58, y: 46.19, w: 3.05, h: 6.38 },
  106: { x: 33.62, y: 39.06, w: 3.05, h: 6.45 },
  107: { x: 33.62, y: 31.74, w: 3.05, h: 6.51 },
  108: { x: 33.64, y: 24.48, w: 3.02, h: 6.45 },

  // TABLE B - 8 desks
  109: { x: 44.36, y: 24.54, w: 3.02, h: 6.45 },
  110: { x: 44.36, y: 31.80, w: 3.02, h: 6.51 },
  111: { x: 44.36, y: 39.10, w: 3.02, h: 6.51 },
  112: { x: 44.36, y: 46.22, w: 3.02, h: 6.32 },
  113: { x: 48.20, y: 46.22, w: 2.98, h: 6.32 },
  114: { x: 48.20, y: 39.10, w: 2.98, h: 6.51 },
  115: { x: 48.18, y: 31.84, w: 3.02, h: 6.45 },
  116: { x: 48.18, y: 24.58, w: 3.02, h: 6.38 },

  // TABLE C - 10 desks
  117: { x: 58.64, y: 24.61, w: 2.91, h: 6.45 },
  118: { x: 58.69, y: 31.84, w: 2.95, h: 6.45 },
  119: { x: 58.69, y: 39.13, w: 2.95, h: 6.45 },
  120: { x: 58.73, y: 46.35, w: 2.95, h: 6.45 },
  121: { x: 58.76, y: 53.58, w: 2.95, h: 6.45 },
  122: { x: 62.51, y: 53.58, w: 3.02, h: 6.32 },
  123: { x: 62.44, y: 46.35, w: 3.02, h: 6.45 },
  124: { x: 62.44, y: 39.13, w: 3.02, h: 6.45 },
  125: { x: 62.38, y: 31.87, w: 2.98, h: 6.51 },
  126: { x: 62.35, y: 24.64, w: 2.98, h: 6.38 },
};

// The pup bed is GONE as of the D&B Floor Plan render (Diviyaj, 14 Oct 2026):
// the new office has no bed, and the old hotspot sat squarely on the DOOR.
// Dogs are unaffected. They have shared their owner's desk since v2.4.0, and
// admins can still clear an orphaned dog by clicking its desk (App.tsx ~312).
// What goes with it is the dedicated "book a dog with no desk" entry point.

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
  searchQuery,
  isAdmin = false,
  headerExtra,
}) => {
  const [hoveredDesk, setHoveredDesk] = useState<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const imageWrapperRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [autoFit, setAutoFit] = useState<boolean>(true);

  // Mobile vs desktop. Desktop keeps the landscape image untouched; mobile uses
  // the portrait one — but ONLY once a portrait render of the NEW office exists.
  //
  // PORTRAIT_READY is false: floor-plan-mobile.webp is still the OLD office and
  // PORTRAIT_HOTSPOTS are keyed to the archived desks (ids 1-30), so using them
  // now would show the wrong room with no clickable desks. Until the portrait
  // render lands, phones get the landscape image scaled down — correct layout,
  // just smaller. To re-enable: drop in the new portrait render, re-run
  // scripts/detect-desks.py on it, paste the result into PORTRAIT_HOTSPOTS with
  // ids 101-126, bump STORAGE_KEY_PORTRAIT, and flip this to true.
  const isMobile = useIsMobile();
  const usePortrait = isMobile && PORTRAIT_READY;
  const orientation: 'portrait' | 'landscape' = usePortrait ? 'portrait' : 'landscape';
  const imgSrc = usePortrait ? floorPlanPortrait : floorPlanLandscape;
  const imgWidth = usePortrait ? 897 : 2750;
  const imgHeight = usePortrait ? 1754 : 1536;
  const defaultHotspots = React.useMemo(
    () => (usePortrait ? PORTRAIT_HOTSPOTS : LANDSCAPE_HOTSPOTS),
    [usePortrait],
  );
  const storageKey = usePortrait ? STORAGE_KEY_PORTRAIT : STORAGE_KEY_LANDSCAPE;

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

  // Land the view on the desk banks without trapping the top of the plan.
  //
  // The plan is width-anchored at its true aspect ratio, so at 100% it is
  // taller than the card. `align-items: center` centred it but made the top
  // UNREACHABLE: flex centring pushes half the overflow above the scroll
  // origin and scrollTop cannot go negative, so you could scroll down to the
  // door but never up to the sign without zooming out to 80% first.
  //
  // Top-aligning and setting scrollTop to the midpoint gives the same centred
  // landing with the whole plan reachable in both directions.
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const overflow = el.scrollHeight - el.clientHeight;
    if (overflow > 0) el.scrollTop = overflow / 2;
  }, [zoom, imgSrc, isMobile, imgWidth, imgHeight]);

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
        {/* Scrollable image wrapper. The plan is width-anchored and keeps its
            true aspect ratio, so it runs taller than the card: the card shows
            a band of it and you scroll up/down for the rest. Top-aligned on
            purpose, with the scroll position centred in the effect above. */}
        <div
          ref={scrollRef}
          className="w-full h-full overflow-auto flex items-start justify-center"
        >
          <div
            ref={imageWrapperRef}
            className="relative shrink-0 max-w-full"
            style={{
              // Width-anchored on every breakpoint, with NO max-height.
              //
              // There used to be a `max-h-full` here and it was a silent bug.
              // CSS drops `aspect-ratio` the moment `max-height` clamps the
              // box, and the <img> inside is w-full/h-full with no object-fit,
              // so it stretched to fill the clamped box: the plan rendered at
              // 2.38 against the image's true 1.79, squashing it vertically by
              // about 25%. Hotspots still lined up, because they are
              // percentages of the same squashed box, so it LOOKED aligned
              // while every desk mat was visibly wider than tall.
              //
              // Anchoring on height instead would keep the ratio but letterbox
              // the plan with ~240px of dead gutter either side. So: stay
              // width-anchored and drop the max-height, which lets
              // `aspect-ratio` survive and set a box taller than the card. The
              // parent scrolls it (see the centring effect above). Full width,
              // true proportions, whole plan reachable. Hotspots stay correct
              // because the box is still the image's real geometry, which is
              // exactly what object-cover would have broken.
              width: `${zoom * 100}%`,
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
