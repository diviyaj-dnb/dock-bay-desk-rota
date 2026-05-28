import React, { useState } from 'react';
import { Desk, Booking, TeamMember, DayOfWeek } from '../types';
import { ZoomIn, ZoomOut, Copy, RotateCcw, Check } from 'lucide-react';
import floorPlanLandscape from '../assets/floor-plan.webp';
import floorPlanPortrait from '../assets/floor-plan-mobile.webp';
import { useIsMobile } from '../lib/hooks';

type HotspotPos = { x: number; y: number; w: number; h: number };
const STORAGE_KEY_LANDSCAPE = 'desk_hotspot_positions_landscape_v1';
const STORAGE_KEY_PORTRAIT = 'desk_hotspot_positions_portrait_v1';

interface DeskLayoutMapProps {
  activeDay: DayOfWeek;
  desks: Desk[];
  bookings: Booking[];
  teamMembers: TeamMember[];
  activeMemberId: string | null;
  onDeskClick: (deskId: number) => void;
  onPupBedClick: () => void;
  searchQuery: string;
}

// Position of each desk as percentage of the image. (x, y) is centre, (w, h) is size.
// Two sets: landscape image for desktop (1916×821), portrait image for mobile (941×1672).
// Both are calibrated visually with the in-app Hot/drag/resize tool when Hot is on.
const LANDSCAPE_HOTSPOTS: Record<number, HotspotPos> = {
  // TABLE A (left, 10 desks, 5 rows × 2 cols)
  5:  { x: 17.85, y: 23.56, w: 5.33, h: 10.85 }, // no-screen top
  6:  { x: 25.48, y: 23.69, w: 5.29, h: 11.02 }, // no-screen top
  4:  { x: 17.80, y: 35.98, w: 5.39, h: 10.13 },
  7:  { x: 25.47, y: 36.04, w: 5.37, h: 10.79 },
  3:  { x: 17.74, y: 47.94, w: 5.47, h: 10.61 },
  8:  { x: 25.40, y: 47.97, w: 5.25, h: 10.52 }, // design
  2:  { x: 17.67, y: 59.73, w: 5.42, h: 10.42 },
  9:  { x: 25.33, y: 59.78, w: 5.49, h: 10.37 },
  1:  { x: 17.63, y: 71.71, w: 5.18, h: 10.72 },
  10: { x: 25.41, y: 71.75, w: 5.27, h: 10.81 },

  // TABLE B (middle, 8 desks, 4 rows × 2 cols)
  14: { x: 46.72, y: 27.25, w: 5.23, h: 11.64 }, // no-screen top
  15: { x: 54.43, y: 27.23, w: 5.49, h: 11.41 }, // no-screen top
  13: { x: 46.73, y: 39.69, w: 5.32, h: 10.76 },
  16: { x: 54.47, y: 39.69, w: 5.51, h: 10.78 }, // design
  12: { x: 46.81, y: 51.88, w: 5.31, h: 11.33 }, // design
  17: { x: 54.43, y: 52.07, w: 5.55, h: 11.27 },
  11: { x: 46.73, y: 64.86, w: 5.32, h: 11.28 },
  18: { x: 54.50, y: 64.88, w: 5.50, h: 11.29 }, // design

  // TABLE C (right, 12 desks, 6 rows × 2 cols)
  24: { x: 76.92, y: 19.11, w: 5.44, h: 10.94 }, // no-screen top
  25: { x: 84.51, y: 19.25, w: 5.53, h: 11.09 }, // no-screen top
  23: { x: 76.94, y: 31.12, w: 5.43, h: 10.69 }, // no-screen
  26: { x: 84.58, y: 31.19, w: 5.48, h: 10.57 },
  22: { x: 77.04, y: 42.94, w: 5.46, h: 10.90 },
  27: { x: 84.71, y: 43.26, w: 5.56, h: 10.71 },
  21: { x: 77.03, y: 55.15, w: 5.41, h: 10.52 }, // design
  28: { x: 84.78, y: 55.32, w: 5.56, h: 10.72 },
  20: { x: 77.12, y: 67.35, w: 5.43, h: 10.57 },
  29: { x: 84.97, y: 67.30, w: 5.59, h: 10.86 },
  19: { x: 77.20, y: 79.86, w: 5.50, h: 11.68 },
  30: { x: 85.07, y: 80.00, w: 5.57, h: 11.39 },
};

// Pup-bed clickable hotspot — same HotspotPos shape as desks so it can be
// calibrated with the in-app Hot tool (sentinel id 0 in livePositions below).
// Click opens the booking modal in "pup-booking" mode (dogs only, no desk).
const PUP_BED_LANDSCAPE: HotspotPos = { x: 50.43, y: 88.02, w: 7.81, h: 7.81 };
const PUP_BED_PORTRAIT: HotspotPos = { x: 82.0, y: 49.0, w: 14.0, h: 10.0 };

// Portrait hotspots — calibrated visually with the in-app Hot tool against floor-plan-mobile.png.
const PORTRAIT_HOTSPOTS: Record<number, HotspotPos> = {
  // TABLE A (top, 10 desks, 5 rows × 2 cols)
  1:  { x: 43.01, y: 29.18, w: 9.63,  h: 4.60 },
  2:  { x: 43.24, y: 23.70, w: 10.52, h: 4.72 },
  3:  { x: 43.11, y: 18.48, w: 10.27, h: 4.80 },
  4:  { x: 43.31, y: 13.11, w: 10.64, h: 4.66 },
  5:  { x: 43.47, y: 7.61,  w: 9.78,  h: 4.80 },
  6:  { x: 57.47, y: 7.55,  w: 10.44, h: 5.16 },
  7:  { x: 57.63, y: 13.20, w: 9.60,  h: 4.73 },
  8:  { x: 57.38, y: 18.47, w: 9.63,  h: 4.86 },
  9:  { x: 57.53, y: 23.87, w: 9.38,  h: 4.43 },
  10: { x: 57.70, y: 29.30, w: 9.98,  h: 4.78 },

  // TABLE B (middle, 8 desks, 4 rows × 2 cols)
  11: { x: 44.44, y: 54.80, w: 8.96,  h: 3.94 },
  12: { x: 44.07, y: 49.88, w: 8.97,  h: 4.12 },
  13: { x: 43.83, y: 44.91, w: 8.28,  h: 3.99 },
  14: { x: 43.67, y: 39.77, w: 8.83,  h: 3.93 },
  15: { x: 56.41, y: 39.85, w: 8.45,  h: 4.33 },
  16: { x: 56.41, y: 44.88, w: 8.18,  h: 3.93 },
  17: { x: 56.85, y: 49.80, w: 8.18,  h: 4.09 },
  18: { x: 56.75, y: 54.86, w: 7.98,  h: 4.16 },

  // TABLE C (bottom, 12 desks, 6 rows × 2 cols)
  19: { x: 43.84, y: 91.59, w: 8.77,  h: 5.23 },
  20: { x: 44.03, y: 85.79, w: 9.19,  h: 4.22 },
  21: { x: 44.35, y: 80.66, w: 8.99,  h: 4.10 },
  22: { x: 43.73, y: 75.39, w: 8.17,  h: 4.22 },
  23: { x: 43.83, y: 70.35, w: 8.62,  h: 4.27 },
  24: { x: 43.89, y: 65.25, w: 9.28,  h: 3.72 },
  25: { x: 56.65, y: 65.34, w: 8.28,  h: 3.85 },
  26: { x: 56.82, y: 70.49, w: 8.86,  h: 4.08 },
  27: { x: 56.66, y: 75.53, w: 8.58,  h: 4.38 },
  28: { x: 56.76, y: 80.68, w: 8.61,  h: 4.28 },
  29: { x: 56.71, y: 85.81, w: 8.38,  h: 4.00 },
  30: { x: 56.53, y: 90.99, w: 8.28,  h: 4.36 },
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
  const imgWidth = isMobile ? 941 : 1916;
  const imgHeight = isMobile ? 1672 : 821;
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

  // Bookings indexed by deskId for activeDay
  const bookingsByDesk = React.useMemo(() => {
    const map: Record<number, Booking> = {};
    bookings
      .filter((b) => b.day === activeDay && b.deskId !== null)
      .forEach((b) => {
        if (b.deskId) map[b.deskId] = b;
      });
    return map;
  }, [bookings, activeDay]);

  const getMemberById = (id: string) => teamMembers.find((m) => m.id === id);

  // Dogs booked in office today
  const bookedDogs = React.useMemo(() => {
    return bookings
      .filter((b) => b.day === activeDay && b.status === 'booked')
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
        className={`absolute group ${isEditing ? 'cursor-move' : 'cursor-pointer'}`}
        style={{
          left: `${pos.x - pos.w / 2}%`,
          top: `${pos.y - pos.h / 2}%`,
          width: `${pos.w}%`,
          height: `${pos.h}%`,
          touchAction: isEditing ? 'none' : 'auto',
        }}
      >
        {/* Hotspot ring (visible on hover, search, active user, or calibration mode) */}
        <div
          className={`absolute inset-0 rounded-md transition-all duration-200 ease-out ${
            isSearched
              ? 'ring-2 ring-[#f3705a] ring-offset-1 ring-offset-transparent shadow-[0_0_0_4px_rgba(243,112,90,0.25)] scale-105'
              : isActiveUserHere
                ? 'ring-2 ring-slate-900 scale-[1.03]'
                : isHovered
                  ? 'ring-2 ring-slate-900/70 bg-white/15 scale-[1.04] shadow-md'
                  : isEditing
                    ? 'ring-1 ring-dashed ring-red-500/70 bg-red-500/10'
                    : isBooked
                      ? 'bg-slate-900/45 ring-1 ring-slate-900/20'
                      : ''
          }`}
          style={{ transformOrigin: 'center' }}
        />

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
            <span className="text-[11px] font-semibold text-slate-900/50 leading-none tabular-nums">
              {desk.number}
            </span>
          </div>
        )}

        {/* Tooltip on hover (suppressed during calibration) — compact 2-line pill */}
        {isHovered && !isEditing && (
          <div className="absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full bg-slate-900 text-white rounded-lg shadow-xl z-50 pointer-events-none whitespace-nowrap px-2.5 py-1.5">
            {booking ? (
              <>
                <p className="text-[11px] font-semibold leading-tight">{member?.name}</p>
                <p className="text-[9px] text-slate-400 leading-tight mt-0.5">
                  Desk {desk.number} · click to edit
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
      {/* Header strip with title + legend — desktop only (mobile maximises vertical space) */}
      <div className="hidden md:flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
            Office floor plan
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any desk to manage the booking, or select a teammate to quick-book.
          </p>
        </div>

        <div className="flex flex-wrap gap-1 text-[11px] font-medium text-slate-600">
          <div className="flex items-center gap-1.5 px-2 py-1">
            <div className="w-2 h-2 rounded-sm bg-[#a3dbf5] border border-[#7bbada]" />
            <span>Regular</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1">
            <div className="w-2 h-2 rounded-sm bg-[#fbb9ad] border border-[#e48f82]" />
            <span>Design</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1">
            <div className="w-2 h-2 rounded-sm bg-white border border-slate-300" />
            <span>No screen</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1">
            <div className="w-2 h-2 rounded-sm bg-emerald-100 border border-emerald-400" />
            <span>Pup</span>
          </div>
        </div>
      </div>

      {/* Floor plan image with hotspot overlays */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 w-full overflow-hidden bg-transparent md:bg-slate-50 md:border md:border-slate-200 md:rounded-xl flex items-center justify-center"
      >
        {/* Scrollable image wrapper */}
        <div className="w-full h-full overflow-auto flex items-center justify-center">
          <div
            ref={imageWrapperRef}
            className="relative shrink-0 max-w-full max-h-full"
            style={{
              // On mobile (portrait image), height-anchor so the floor plan fills vertical space.
              // On desktop (landscape image), width-anchor — preserves the existing desktop behaviour.
              ...(isMobile
                ? { height: `${zoom * 100}%`, width: 'auto' }
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
          so it never sits on top of the floor plan (and never covers the pup bed). */}
      <div className="flex justify-center pt-2 pb-1 shrink-0">
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
