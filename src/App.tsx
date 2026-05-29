import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { DayOfWeek } from './types';
import { DaySelector } from './components/DaySelector';
import { DeskLayoutMap } from './components/DeskLayoutMap';

const SpreadsheetView = lazy(() =>
  import('./components/SpreadsheetView').then((m) => ({ default: m.SpreadsheetView })),
);
const BookingModal = lazy(() =>
  import('./components/BookingModal').then((m) => ({ default: m.BookingModal })),
);
const RulesModal = lazy(() =>
  import('./components/RulesModal').then((m) => ({ default: m.RulesModal })),
);
import {
  Search,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Map,
  LayoutGrid,
  Monitor,
  PenTool,
  Sofa,
  PawPrint,
  Loader2,
  Users,
  RotateCcw,
} from 'lucide-react';
import logoUrl from './assets/dock-and-bay-logo.jpg';
import { useBookingsForWeek, useDesks, useTeamMembers } from './lib/hooks';
import { saveBooking, deleteBooking, copyBookingsBetweenWeeks } from './lib/repository';

const ACTIVE_USER_KEY = 'desk_rota_active_user_v1';

// Helper to get YYYY-MM-DD string representing Monday of the week containing a given date
function getMondayDateString(d: Date): string {
  const dateCopy = new Date(d.getTime());
  const day = dateCopy.getDay();
  const diff = dateCopy.getDate() - (day === 0 ? 6 : day - 1);
  const monday = new Date(dateCopy.setDate(diff));
  
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Convert "YYYY-MM-DD" Monday to "May 18 – May 22, 2026"
function getWeekRangeLabel(mondayStr: string): string {
  const parts = mondayStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  
  const monday = new Date(year, month, day);
  const friday = new Date(monday.getTime());
  friday.setDate(monday.getDate() + 4);
  
  const options1: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const options2: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  
  return `${monday.toLocaleDateString('en-US', options1)} – ${friday.toLocaleDateString('en-US', options2)}`;
}

// Default to today's weekday (Sat/Sun fold to Mon)
function getTodayWeekday(): DayOfWeek {
  const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const dow = new Date().getDay(); // 0=Sun ... 6=Sat
  if (dow === 0 || dow === 6) return 'Monday';
  return days[dow - 1];
}

export default function App() {
  const [activeDay, setActiveDay] = useState<DayOfWeek>(() => getTodayWeekday());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'map' | 'spreadsheet'>('map');

  // Find current real-life Monday
  const today = useMemo(() => new Date(), []);
  const currentMondayStr = useMemo(() => getMondayDateString(today), [today]);

  // Next Monday — used by the "Next week" jump button
  const nextMondayDateStr = useMemo(() => {
    const currentMondayDate = new Date(currentMondayStr + 'T00:00:00');
    currentMondayDate.setDate(currentMondayDate.getDate() + 7);
    return getMondayDateString(currentMondayDate);
  }, [currentMondayStr]);

  // Rolling 1-week window — next week only unlocks from Thursday 00:00 onwards
  // (and on Sat/Sun, since at that point "this week" is functionally already over).
  // Past weeks are never reachable.
  const isNextWeekUnlocked = useMemo(() => {
    const dow = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    return dow >= 4 || dow === 0;
  }, [today]);

  // Always default to THIS week — user can click "Next week" if they want to book ahead.
  const [activeWeek, setActiveWeek] = useState<string>(currentMondayStr);

  // Calendar date number for each weekday of the active week
  // (so the day selector can show "Mon 25", "Tue 26", etc.)
  const datesByDay = useMemo<Record<DayOfWeek, number>>(() => {
    const [y, m, d] = activeWeek.split('-').map(Number);
    const monday = new Date(y, m - 1, d);
    const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    return days.reduce((acc, day, idx) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + idx);
      acc[day] = date.getDate();
      return acc;
    }, {} as Record<DayOfWeek, number>);
  }, [activeWeek]);

  // Real calendar date for the SELECTED day of the SELECTED week — drives the
  // header date label so it reflects "what am I looking at" rather than "today".
  const selectedDateLabel = useMemo(() => {
    const [y, m, d] = activeWeek.split('-').map(Number);
    const monday = new Date(y, m - 1, d);
    const dayIdx = (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as DayOfWeek[]).indexOf(activeDay);
    const selected = new Date(monday);
    selected.setDate(monday.getDate() + dayIdx);
    return selected.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [activeWeek, activeDay]);

  // Rolling 1-week navigation guards — past weeks are never reachable,
  // next week only when isNextWeekUnlocked (Thu+).
  const canGoPrev = activeWeek !== currentMondayStr;
  const canGoNext = isNextWeekUnlocked && activeWeek === currentMondayStr;

  const handlePrevWeek = () => {
    if (!canGoPrev) return;
    setActiveWeek(currentMondayStr);
  };

  const handleNextWeek = () => {
    if (!canGoNext) return;
    setActiveWeek(nextMondayDateStr);
  };

  const handleToThisWeek = () => {
    setActiveWeek(currentMondayStr);
  };

  const handleToNextWeek = () => {
    if (!isNextWeekUnlocked) return;
    setActiveWeek(nextMondayDateStr);
  };

  // Supabase-backed data (loads on auth)
  const { members: teamMembers, loading: membersLoading } = useTeamMembers(true);
  const { desks, loading: desksLoading } = useDesks(true);
  const { bookings: currentWeekBookings, loading: bookingsLoading, reload: reloadBookings } = useBookingsForWeek(activeWeek, true);

  const isLoadingData = membersLoading || desksLoading;

  const handleCopyPreviousWeek = async () => {
    const parts = activeWeek.split('-');
    const prevMonDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    prevMonDate.setDate(prevMonDate.getDate() - 7);
    const prevWeekStr = getMondayDateString(prevMonDate);
    try {
      await copyBookingsBetweenWeeks(prevWeekStr, activeWeek);
      await reloadBookings();
    } catch (e) {
      alert('Could not copy previous week: ' + (e as Error).message);
    }
  };

  // The "active user" — who you've picked from the Team dropdown.
  // Persists in localStorage so refreshes / next visits remember you.
  // Drives both the avatar initials AND the quick-book highlight.
  const [activeMemberId, setActiveMemberId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(ACTIVE_USER_KEY);
  });
  useEffect(() => {
    if (activeMemberId) {
      window.localStorage.setItem(ACTIVE_USER_KEY, activeMemberId);
    } else {
      window.localStorage.removeItem(ACTIVE_USER_KEY);
    }
  }, [activeMemberId]);

  // Modal Control State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [modalMemberId, setModalMemberId] = useState<string | null>(null);
  const [modalDeskId, setModalDeskId] = useState<number | null>(null);
  // When true, the modal is opened from the pup-bed hotspot — picker is filtered
  // to dogs, desk grid is hidden, save is forced to status='booked' / desk_id=null.
  const [isPupBookingMode, setIsPupBookingMode] = useState<boolean>(false);

  // Header dropdowns
  const [teamOpen, setTeamOpen] = useState<boolean>(false);
  const [accountOpen, setAccountOpen] = useState<boolean>(false);
  const teamDropdownRef = React.useRef<HTMLDivElement>(null);
  const accountDropdownRef = React.useRef<HTMLDivElement>(null);
  const mobileTeamSheetRef = React.useRef<HTMLDivElement>(null);
  const mobileAccountDropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click (checks both desktop and mobile DOM nodes)
  React.useEffect(() => {
    if (!teamOpen && !accountOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (teamOpen) {
        const inDesktop = teamDropdownRef.current?.contains(target);
        const inMobile = mobileTeamSheetRef.current?.contains(target);
        if (!inDesktop && !inMobile) setTeamOpen(false);
      }
      if (accountOpen) {
        const inDesktop = accountDropdownRef.current?.contains(target);
        const inMobile = mobileAccountDropdownRef.current?.contains(target);
        if (!inDesktop && !inMobile) setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [teamOpen, accountOpen]);

  // "Me" is whoever is currently selected from the Team dropdown
  const me = useMemo(
    () => teamMembers.find((m) => m.id === activeMemberId) ?? null,
    [teamMembers, activeMemberId],
  );
  const activeMember = me;
  const myInitials = useMemo(() => {
    if (!me) return '?';
    return me.name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [me]);

  // Sorted team list: humans alphabetically, dogs at the bottom
  const sortedMembers = useMemo(() => {
    return [...teamMembers].sort((a, b) => {
      if (!!a.isDog === !!b.isDog) return a.name.localeCompare(b.name);
      return a.isDog ? 1 : -1;
    });
  }, [teamMembers]);

  // Statistics & Calculations for Header and summary cards
  const currentDayBookings = useMemo(() => {
    return currentWeekBookings.filter((b) => b.day === activeDay);
  }, [currentWeekBookings, activeDay]);

  const bookedDesksCount = useMemo(() => {
    return currentDayBookings.filter((b) => b.status === 'booked' && b.deskId !== null).length;
  }, [currentDayBookings]);

  const sofaSurfersCount = useMemo(() => {
    return currentDayBookings.filter((b) => b.status === 'sofa_surf').length;
  }, [currentDayBookings]);

  const dogsInOfficeCount = useMemo(() => {
    const dogIds = teamMembers.filter((m) => m.isDog).map((d) => d.id);
    return currentDayBookings.filter((b) => dogIds.includes(b.memberId) && b.status === 'booked').length;
  }, [currentDayBookings, teamMembers]);

  const totalDesignDesks = useMemo(() => {
    return desks.filter((d) => d.type === 'design').length;
  }, [desks]);

  const designDesksBooked = useMemo(() => {
    const designDeskIds = desks.filter((d) => d.type === 'design').map((d) => d.id);
    return currentDayBookings.filter(
      (b) => b.status === 'booked' && b.deskId !== null && designDeskIds.includes(b.deskId)
    ).length;
  }, [currentDayBookings, desks]);

  // Handler for clicking a desk on the visual floor plan map
  const handleDeskClick = (deskId: number) => {
    const existingBooking = currentDayBookings.find((b) => b.deskId === deskId);

    if (existingBooking) {
      setModalMemberId(existingBooking.memberId);
      setModalDeskId(deskId);
    } else {
      setModalMemberId(activeMemberId);
      setModalDeskId(deskId);
    }
    setIsModalOpen(true);
  };

  // Handler for clicking the pup-bed hotspot — opens modal in dog-only booking mode
  const handlePupBedClick = () => {
    const activeMemberIsDog = teamMembers.find((m) => m.id === activeMemberId)?.isDog;
    setModalMemberId(activeMemberIsDog ? activeMemberId : null);
    setModalDeskId(null);
    setIsPupBookingMode(true);
    setIsModalOpen(true);
  };

  // Handler for clicking a cell on the spreadsheet editor
  const handleSpreadsheetCellClick = (memberId: string, day: DayOfWeek) => {
    setActiveDay(day);
    setModalMemberId(memberId);
    setModalDeskId(null);
    setIsModalOpen(true);
  };

  // Save booking. The active user (selected in the Team dropdown) is recorded
  // as `bookedBy` for activity tracking — separate from `memberId` who the
  // booking is for.
  const handleSaveBooking = async (
    memberId: string,
    day: DayOfWeek,
    deskId: number | null,
    status: 'booked' | 'sofa_surf' | 'wfh',
  ) => {
    try {
      await saveBooking({
        memberId,
        weekId: activeWeek,
        day,
        deskId,
        status,
        bookedBy: activeMemberId,
      });
      // Force-refresh the local bookings cache so the user sees their change
      // immediately, even if the Supabase realtime channel hasn't propagated
      // yet (or isn't enabled on the bookings table).
      await reloadBookings();
    } catch (e) {
      alert('Could not save booking: ' + (e as Error).message);
    }
  };

  // Delete booking
  const handleDeleteBooking = async (memberId: string, day: DayOfWeek) => {
    try {
      await deleteBooking(memberId, activeWeek, day);
      await reloadBookings();
    } catch (e) {
      alert('Could not delete booking: ' + (e as Error).message);
    }
  };

  const handleSwitchUser = () => {
    setActiveMemberId(null);
  };

  return (
    <div
      className="w-screen flex flex-col bg-slate-100/50 overflow-hidden text-slate-800"
      style={{ height: '100dvh' }}
    >
      {/* Header: desktop only — premium minimal, single hairline border */}
      <header className="hidden md:flex bg-white border-b border-slate-200 px-8 py-4 items-center justify-between shrink-0 relative z-20">
        {/* Brand */}
        <div className="flex items-center gap-4 min-w-[280px]">
          <img
            src={logoUrl}
            alt="Dock & Bay"
            className="w-14 h-14 object-contain shrink-0"
          />
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">
              Dock &amp; Bay
            </span>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              Desk Rota
            </h1>
          </div>
        </div>

        {/* Centre: day selector */}
        <div className="flex-1 max-w-md mx-auto px-4 flex justify-center">
          <DaySelector
            activeDay={activeDay}
            onDayChange={setActiveDay}
            datesByDay={datesByDay}
            bookingsByDay={useMemo(() => {
              const counts: Record<DayOfWeek, number> = {
                Monday: 0,
                Tuesday: 0,
                Wednesday: 0,
                Thursday: 0,
                Friday: 0,
              };
              currentWeekBookings.forEach((b) => {
                if (b.status === 'booked' && b.deskId !== null) {
                  counts[b.day]++;
                }
              });
              return counts;
            }, [currentWeekBookings])}
          />
        </div>

        {/* Right: team dropdown + view toggle + help + account menu */}
        <div className="flex items-center gap-2 min-w-[360px] justify-end">
          {/* Team dropdown */}
          <div className="relative" ref={teamDropdownRef}>
            <button
              onClick={() => setTeamOpen((o) => !o)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-150 cursor-pointer active:scale-[0.98] ${
                !me
                  ? 'bg-[#f3705a] text-white border-[#f3705a] hover:bg-[#e05a43] hover:border-[#e05a43] shadow-sm'
                  : teamOpen
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
              title={me ? `Switch user (currently: ${me.name})` : 'Pick yourself from the team'}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="truncate max-w-[120px]">
                {me ? 'Team' : 'Pick yourself'}
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${teamOpen ? 'rotate-180' : ''}`} />
            </button>

            {teamOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[60vh]">
                <div className="p-2 border-b border-slate-100">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search team member"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-md pl-9 pr-3 py-2 text-xs outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-colors"
                    />
                  </div>
                </div>

                <div className="overflow-y-auto flex-1 p-1.5 custom-scrollbar">
                  {sortedMembers
                    .filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((m) => {
                      const isSelected = m.id === activeMemberId;
                      const hasBookingToday = currentDayBookings.find((b) => b.memberId === m.id);
                      const statusLabel = hasBookingToday
                        ? hasBookingToday.status === 'booked'
                          ? m.isDog ? 'Pup bed' : `Desk ${hasBookingToday.deskId}`
                          : hasBookingToday.status === 'sofa_surf'
                            ? m.isDog ? 'Pup bed' : 'Sofa'
                            : 'WFH'
                        : null;
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            setActiveMemberId(m.id === activeMemberId ? null : m.id);
                            setTeamOpen(false);
                          }}
                          className={`w-full px-2.5 py-2 rounded-md text-xs flex items-center justify-between transition-colors text-left ${
                            isSelected
                              ? 'bg-slate-900 text-white'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            {m.isDog && <span className="text-sm leading-none">🐶</span>}
                            <span className="truncate font-medium">{m.name}</span>
                          </span>
                          {statusLabel && (
                            <span
                              className={`text-[10px] font-medium shrink-0 ml-2 ${
                                isSelected ? 'text-slate-300' : 'text-slate-400'
                              }`}
                            >
                              {statusLabel}
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>

                {activeMember && (
                  <div className="p-2 border-t border-slate-100 bg-slate-50/50">
                    <button
                      onClick={() => {
                        setModalMemberId(activeMemberId);
                        setModalDeskId(null);
                        setIsModalOpen(true);
                        setTeamOpen(false);
                      }}
                      className="w-full py-1.5 px-3 bg-[#f3705a] hover:bg-[#e05a43] text-white text-xs font-medium rounded-md transition-colors cursor-pointer"
                    >
                      Book for {activeMember.name.split(' ')[0]}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg">
            <button
              onClick={() => setActiveTab('map')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 flex items-center gap-1.5 cursor-pointer active:scale-[0.97] ${
                activeTab === 'map'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>Map</span>
            </button>
            <button
              onClick={() => setActiveTab('spreadsheet')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 flex items-center gap-1.5 cursor-pointer active:scale-[0.97] ${
                activeTab === 'spreadsheet'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>

          {/* Help */}
          <button
            onClick={() => setIsRulesOpen(true)}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all duration-150 cursor-pointer active:scale-90"
            title="Booking guidelines"
            aria-label="Booking guidelines"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Account avatar */}
          <div className="relative" ref={accountDropdownRef}>
            <button
              onClick={() => setAccountOpen((o) => !o)}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 ${
                !me
                  ? 'bg-slate-100 text-slate-400 border border-dashed border-slate-300'
                  : accountOpen
                    ? 'bg-slate-800 text-white ring-2 ring-slate-900 ring-offset-2 ring-offset-white'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
              title={me ? me.name : 'No user selected'}
              aria-label="Account menu"
            >
              {myInitials}
            </button>
            {accountOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-3 py-2.5 border-b border-slate-100">
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                    Booking as
                  </p>
                  <p className="text-xs font-medium text-slate-900 truncate mt-0.5">
                    {me?.name ?? 'No-one selected'}
                  </p>
                  {me?.isDesigner && (
                    <p className="text-[11px] text-[#f3705a] font-medium mt-0.5">Designer</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setAccountOpen(false);
                    handleSwitchUser();
                    setTeamOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Switch user</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Stats + week navigator: desktop only */}
      <div className="hidden md:flex bg-white border-b border-slate-200 px-8 py-3 items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-1 text-xs text-slate-600">
          <span className="text-slate-700 font-medium tabular-nums px-2 py-1">
            {selectedDateLabel}
          </span>
          <span className="w-px h-4 bg-slate-200 mx-2" />
          <span className="group flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors hover:bg-slate-50">
            <Monitor className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
            <span className="font-semibold text-slate-900 tabular-nums">{bookedDesksCount}</span>
            <span className="text-slate-400 tabular-nums">/ {desks.length}</span>
            <span className="text-slate-500">desks</span>
          </span>
          <span className="group flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors hover:bg-slate-50">
            <PenTool className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
            <span className="font-semibold text-slate-900 tabular-nums">{designDesksBooked}</span>
            <span className="text-slate-400 tabular-nums">/ {totalDesignDesks}</span>
            <span className="text-slate-500">design</span>
          </span>
          <span className="group flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors hover:bg-slate-50">
            <Sofa className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
            <span className="font-semibold text-slate-900 tabular-nums">{sofaSurfersCount}</span>
            <span className="text-slate-500">sofa surfing</span>
          </span>
          <span className="group flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors hover:bg-slate-50">
            <PawPrint className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
            <span className="font-semibold text-slate-900 tabular-nums">{dogsInOfficeCount}</span>
            <span className="text-slate-500">pups</span>
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-0.5">
            <button
              onClick={handlePrevWeek}
              disabled={!canGoPrev}
              className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-900 transition-all duration-150 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-500 enabled:cursor-pointer"
              title={canGoPrev ? 'Back to this week' : 'Past weeks are locked'}
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-slate-900 min-w-[160px] text-center tabular-nums">
              {getWeekRangeLabel(activeWeek)}
            </span>
            <button
              onClick={handleNextWeek}
              disabled={!canGoNext}
              className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-900 transition-all duration-150 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-500 enabled:cursor-pointer"
              title={canGoNext ? 'Next week' : 'Next week unlocks Thursday'}
              aria-label="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-0.5 text-xs">
            <button
              onClick={handleToThisWeek}
              className={`px-2.5 py-1 rounded-md font-medium transition-all duration-150 cursor-pointer active:scale-[0.97] ${
                activeWeek === currentMondayStr
                  ? 'text-slate-900 bg-slate-100'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              This week
            </button>
            <button
              onClick={handleToNextWeek}
              disabled={!isNextWeekUnlocked}
              title={isNextWeekUnlocked ? 'Jump to next week' : 'Next week unlocks Thursday'}
              className={`px-2.5 py-1 rounded-md font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed enabled:cursor-pointer ${
                activeWeek === nextMondayDateStr
                  ? 'text-white bg-[#f3705a] shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 disabled:hover:bg-transparent disabled:hover:text-slate-500'
              }`}
            >
              Next week
            </button>
          </div>
        </div>
      </div>

      {/* Mobile-only header (hidden on md+) */}
      <div
        className="md:hidden bg-white border-b border-slate-200 shrink-0"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Brand row + identity chip */}
        <div className="flex items-center justify-between px-4 py-3 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src={logoUrl} alt="Dock & Bay" className="w-9 h-9 object-contain shrink-0" />
            <div className="min-w-0">
              <span className="block text-[10px] font-semibold tracking-[0.18em] text-slate-500 uppercase leading-none">
                Dock &amp; Bay
              </span>
              <h1 className="text-base font-semibold text-slate-900 tracking-tight leading-tight mt-0.5">
                Desk Rota
              </h1>
            </div>
          </div>

          {/* Identity chip — top-right */}
          <div className="relative shrink-0" ref={mobileAccountDropdownRef}>
            <button
              onClick={() => setAccountOpen((o) => !o)}
              className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer active:scale-[0.97] ${
                !me
                  ? 'bg-[#f3705a] text-white border-[#f3705a]'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                  !me ? 'bg-white/20 text-white' : 'bg-slate-900 text-white'
                }`}
              >
                {myInitials}
              </span>
              <span className="max-w-[80px] truncate">
                {me ? me.name.split(' ')[0] : 'Pick you'}
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
            </button>
            {accountOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-3 py-2.5 border-b border-slate-100">
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                    Booking as
                  </p>
                  <p className="text-xs font-medium text-slate-900 truncate mt-0.5">
                    {me?.name ?? 'No-one selected'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setAccountOpen(false);
                    setActiveMemberId(null);
                    setTeamOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Switch user</span>
                </button>
                <button
                  onClick={() => {
                    setAccountOpen(false);
                    setIsRulesOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer border-t border-slate-100"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                  <span>Booking guidelines</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats + date compact, horizontally scrollable */}
        <div className="px-4 py-2 flex items-center gap-3 text-[11px] text-slate-600 overflow-x-auto border-t border-slate-100 scrollbar-none">
          <span className="text-slate-700 font-medium whitespace-nowrap tabular-nums">{selectedDateLabel}</span>
          <span className="w-px h-3 bg-slate-200 shrink-0" />
          <span className="flex items-center gap-1 whitespace-nowrap">
            <Monitor className="w-3 h-3 text-slate-400" />
            <span className="font-semibold text-slate-900 tabular-nums">{bookedDesksCount}</span>
            <span className="text-slate-400 tabular-nums">/{desks.length}</span>
          </span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            <PenTool className="w-3 h-3 text-slate-400" />
            <span className="font-semibold text-slate-900 tabular-nums">{designDesksBooked}</span>
            <span className="text-slate-400 tabular-nums">/{totalDesignDesks}</span>
          </span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            <Sofa className="w-3 h-3 text-slate-400" />
            <span className="font-semibold text-slate-900 tabular-nums">{sofaSurfersCount}</span>
          </span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            <PawPrint className="w-3 h-3 text-slate-400" />
            <span className="font-semibold text-slate-900 tabular-nums">{dogsInOfficeCount}</span>
          </span>
        </div>

        {/* Day selector */}
        <div className="px-3 py-2 border-t border-slate-100 flex justify-center">
          <DaySelector
            activeDay={activeDay}
            onDayChange={setActiveDay}
            datesByDay={datesByDay}
            bookingsByDay={useMemo(() => {
              const counts: Record<DayOfWeek, number> = {
                Monday: 0,
                Tuesday: 0,
                Wednesday: 0,
                Thursday: 0,
                Friday: 0,
              };
              currentWeekBookings.forEach((b) => {
                if (b.status === 'booked' && b.deskId !== null) {
                  counts[b.day]++;
                }
              });
              return counts;
            }, [currentWeekBookings])}
          />
        </div>

        {/* Week navigator — centred date with prev/next on the sides */}
        <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={handlePrevWeek}
            disabled={!canGoPrev}
            className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 active:scale-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-medium text-slate-900 tabular-nums text-center">
            {getWeekRangeLabel(activeWeek)}
          </span>
          <button
            onClick={handleNextWeek}
            disabled={!canGoNext}
            className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 active:scale-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile team-picker sheet — full-width overlay when teamOpen */}
        {teamOpen && (
          <div className="fixed inset-0 z-50 flex items-end md:hidden" onClick={() => setTeamOpen(false)}>
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <div
              ref={mobileTeamSheetRef}
              className="relative w-full bg-white rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Pick yourself</h3>
                <button
                  onClick={() => setTeamOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
                  aria-label="Close"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 border-b border-slate-100">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search team member"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-colors"
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1 p-2">
                {sortedMembers
                  .filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((m) => {
                    const isSelected = m.id === activeMemberId;
                    const hasBookingToday = currentDayBookings.find((b) => b.memberId === m.id);
                    const statusLabel = hasBookingToday
                      ? hasBookingToday.status === 'booked'
                        ? m.isDog ? 'Pup bed' : `Desk ${hasBookingToday.deskId}`
                        : hasBookingToday.status === 'sofa_surf'
                          ? m.isDog ? 'Pup bed' : 'Sofa'
                          : 'WFH'
                      : null;
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          setActiveMemberId(m.id === activeMemberId ? null : m.id);
                          setTeamOpen(false);
                        }}
                        className={`w-full px-3 py-3 rounded-lg text-sm flex items-center justify-between transition-colors text-left ${
                          isSelected
                            ? 'bg-slate-900 text-white'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          {m.isDog && <span className="leading-none">🐶</span>}
                          <span className="truncate font-medium">{m.name}</span>
                        </span>
                        {statusLabel && (
                          <span className={`text-[11px] font-medium shrink-0 ml-2 ${
                            isSelected ? 'text-slate-300' : 'text-slate-400'
                          }`}>
                            {statusLabel}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Workspace: full-width main viewport (no padding on mobile so floor plan can fill) */}
      <div className="flex-1 w-full overflow-hidden p-0 md:p-3 bg-slate-100/30">
        <div className="h-full w-full relative">
          {isLoadingData ? (
            <div className="h-full w-full flex items-center justify-center bg-white rounded-2xl border border-slate-200">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : activeTab === 'map' ? (
            <DeskLayoutMap
              activeDay={activeDay}
              desks={desks}
              bookings={currentWeekBookings}
              teamMembers={teamMembers}
              activeMemberId={activeMemberId}
              onDeskClick={handleDeskClick}
              onPupBedClick={handlePupBedClick}
              searchQuery={searchQuery}
            />
          ) : (
            <Suspense
              fallback={
                <div className="h-full w-full flex items-center justify-center bg-white rounded-2xl border border-slate-200">
                  <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                </div>
              }
            >
              <SpreadsheetView
                teamMembers={teamMembers}
                bookings={currentWeekBookings}
                desks={desks}
                onCellClick={handleSpreadsheetCellClick}
                day={activeDay}
                activeWeek={activeWeek}
                currentMondayStr={currentMondayStr}
                nextMondayDateStr={nextMondayDateStr}
                isNextWeekUnlocked={isNextWeekUnlocked}
                onWeekChange={setActiveWeek}
              />
            </Suspense>
          )}
        </div>
      </div>

      {/* Booking modal — lazy-loaded on first open */}
      {isModalOpen && (
        <Suspense fallback={null}>
          <BookingModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setModalMemberId(null);
              setModalDeskId(null);
              setIsPupBookingMode(false);
            }}
            day={activeDay}
            weekId={activeWeek}
            memberId={modalMemberId}
            deskId={modalDeskId}
            teamMembers={teamMembers}
            desks={desks}
            bookings={currentWeekBookings}
            onSave={handleSaveBooking}
            onDelete={handleDeleteBooking}
            pupBookingMode={isPupBookingMode}
          />
        </Suspense>
      )}

      {isRulesOpen && (
        <Suspense fallback={null}>
          <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
