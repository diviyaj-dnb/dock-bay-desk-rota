import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  ShieldCheck,
  UserPlus,
  Archive,
  ArchiveRestore,
  PawPrint,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash,
  CalendarRange,
  Users,
} from 'lucide-react';
import { Booking, DayOfWeek, Desk, TeamMember } from '../types';
import { fetchAllTeamMembers, addTeamMember, setMemberArchived } from '../lib/repository';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // Called after any team change so the host app can refresh its member list.
  onMembersChanged: () => void;
  // --- Bookings tab (all state lives in App so the map stays in sync) ---
  weekLabel: string;
  initialDay: DayOfWeek;
  bookings: Booking[];
  desks: Desk[];
  liveMembers: TeamMember[];
  onShiftWeek: (days: number) => void;
  onSaveBooking: (
    memberId: string,
    day: DayOfWeek,
    deskId: number | null,
    status: 'booked' | 'sofa_surf' | 'wfh',
  ) => Promise<void>;
  onDeleteBooking: (memberId: string, day: DayOfWeek) => Promise<void>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  onMembersChanged,
  weekLabel,
  initialDay,
  bookings,
  desks,
  liveMembers,
  onShiftWeek,
  onSaveBooking,
  onDeleteBooking,
}) => {
  const [tab, setTab] = useState<'bookings' | 'team'>('bookings');

  // ---------- Bookings tab state ----------
  const [day, setDay] = useState<DayOfWeek>(initialDay);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [addMemberId, setAddMemberId] = useState('');
  const [addAssign, setAddAssign] = useState('');

  // ---------- Team tab state ----------
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newIsDesigner, setNewIsDesigner] = useState(false);
  const [newIsDog, setNewIsDog] = useState(false);
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = async () => {
    try {
      setMembers(await fetchAllTeamMembers());
    } catch (e) {
      alert('Could not load team members: ' + (e as Error).message);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setDay(initialDay);
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const { active, archived } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (members ?? []).filter(
      (m) =>
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q),
    );
    return {
      active: list.filter((m) => !m.archived),
      archived: list.filter((m) => m.archived),
    };
  }, [members, search]);

  // ---------- Bookings tab derived data ----------
  const dayBookings = useMemo(
    () => bookings.filter((b) => b.day === day),
    [bookings, day],
  );
  const memberById = useMemo(() => {
    const map: Record<string, TeamMember> = {};
    liveMembers.forEach((m) => (map[m.id] = m));
    return map;
  }, [liveMembers]);
  // HUMAN desk occupancy for the selected day (to disable taken desks in
  // selects) — dogs share desks, so they never count as occupants.
  const occupantByDesk = useMemo(() => {
    const map: Record<number, string> = {};
    dayBookings.forEach((b) => {
      if (b.deskId !== null && !memberById[b.memberId]?.isDog) map[b.deskId] = b.memberId;
    });
    return map;
  }, [dayBookings, memberById]);
  // Rows: desk bookings by desk number, then sofa, then wfh, then pups
  const sortedRows = useMemo(() => {
    const rank = (b: Booking) => {
      const m = memberById[b.memberId];
      if (m?.isDog) return 3;
      if (b.status === 'booked') return 0;
      if (b.status === 'sofa_surf') return 1;
      return 2;
    };
    return [...dayBookings].sort(
      (a, b) => rank(a) - rank(b) || (a.deskId ?? 99) - (b.deskId ?? 99),
    );
  }, [dayBookings, memberById]);
  const unbookedMembers = useMemo(
    () =>
      liveMembers
        .filter((m) => !dayBookings.some((b) => b.memberId === m.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [liveMembers, dayBookings],
  );

  if (!isOpen) return null;

  // Apply a `desk-N` / `sofa_surf` / `wfh` assignment value for a member.
  const applyAssignment = async (memberId: string, value: string) => {
    setRowBusyId(memberId);
    try {
      if (value === 'sofa_surf' || value === 'wfh') {
        await onSaveBooking(memberId, day, null, value);
      } else if (value === 'pup') {
        await onSaveBooking(memberId, day, null, 'booked');
      } else if (value.startsWith('desk-')) {
        await onSaveBooking(memberId, day, Number(value.slice(5)), 'booked');
      }
    } finally {
      setRowBusyId(null);
    }
  };

  const handleAddBooking = async () => {
    if (!addMemberId || !addAssign) return;
    await applyAssignment(addMemberId, addAssign);
    setAddMemberId('');
    setAddAssign('');
  };

  const handleRemoveBooking = async (memberId: string) => {
    setRowBusyId(memberId);
    try {
      await onDeleteBooking(memberId, day);
    } finally {
      setRowBusyId(null);
    }
  };

  const assignValue = (b: Booking) =>
    b.status === 'booked'
      ? memberById[b.memberId]?.isDog
        ? b.deskId !== null
          ? `desk-${b.deskId}`
          : 'pup'
        : `desk-${b.deskId}`
      : b.status;

  // Select listing every assignment option; taken desks disabled (except the
  // member's own current desk).
  const assignmentSelect = (memberId: string, current: string, isDog: boolean) => (
    <select
      value={current}
      onChange={(e) => applyAssignment(memberId, e.target.value)}
      disabled={rowBusyId === memberId}
      className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:ring-2 focus:ring-dock-navy cursor-pointer disabled:opacity-50 min-w-0"
    >
      {current === '' && <option value="">— assign —</option>}
      {isDog ? (
        <>
          <option value="pup">Pup bed</option>
          {/* Dogs share desks — nothing is disabled; occupant shown so
              "next to their owner" is one glance. */}
          <optgroup label="At a desk">
            {desks.map((d) => {
              const occupant = occupantByDesk[d.id];
              return (
                <option key={d.id} value={`desk-${d.id}`}>
                  Desk {d.number}
                  {occupant
                    ? ` — with ${memberById[occupant]?.name.split(' ')[0] ?? '?'}`
                    : ''}
                </option>
              );
            })}
          </optgroup>
        </>
      ) : (
        <>
          <optgroup label="Desks">
            {desks.map((d) => {
              const occupant = occupantByDesk[d.id];
              const takenByOther = !!occupant && occupant !== memberId;
              return (
                <option key={d.id} value={`desk-${d.id}`} disabled={takenByOther}>
                  Desk {d.number}
                  {takenByOther
                    ? ` — ${memberById[occupant]?.name.split(' ')[0] ?? 'taken'}`
                    : ''}
                </option>
              );
            })}
          </optgroup>
          <optgroup label="No desk">
            <option value="sofa_surf">Sofa surfing</option>
            <option value="wfh">Working from home</option>
          </optgroup>
        </>
      )}
    </select>
  );

  const initialsOf = (name: string) =>
    name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  const memberRow = (m: TeamMember) => (
    <div
      key={m.id}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${
        m.archived ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white border-slate-200'
      }`}
    >
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
          m.isDog ? 'bg-amber-100 text-amber-700' : 'bg-slate-900 text-white'
        }`}
      >
        {m.isDog ? <PawPrint className="w-3.5 h-3.5" /> : initialsOf(m.name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-900 truncate flex items-center gap-1.5">
          {m.name}
          {m.isAdmin && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 py-px">
              <ShieldCheck className="w-2.5 h-2.5" />
              Admin
            </span>
          )}
        </p>
        <p className="text-[10px] text-slate-500 truncate">
          {m.email ?? (m.isDog ? 'Office pup' : 'No email — links on first login')}
        </p>
      </div>
      {/* Admins can't be archived from the UI — change the flag in the DB first. */}
      {!m.isAdmin && (
        <button
          type="button"
          onClick={() => handleArchiveToggle(m)}
          disabled={busyId === m.id}
          className={`p-1.5 rounded-md transition-colors cursor-pointer shrink-0 disabled:opacity-50 ${
            m.archived
              ? 'text-emerald-700 hover:bg-emerald-50'
              : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
          }`}
          title={m.archived ? 'Restore member' : 'Archive member'}
          aria-label={m.archived ? `Restore ${m.name}` : `Archive ${m.name}`}
        >
          {busyId === m.id ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : m.archived ? (
            <ArchiveRestore className="w-3.5 h-3.5" />
          ) : (
            <Archive className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </div>
  );

  const handleAdd = async () => {
    const name = newName.trim();
    const email = newEmail.trim().toLowerCase();
    if (!name) {
      setFormError('Name is required.');
      return;
    }
    if (email && !email.endsWith('@dockandbay.com')) {
      setFormError('Email must be a @dockandbay.com address (or leave blank for pups).');
      return;
    }
    if (email && (members ?? []).some((m) => (m.email ?? '').toLowerCase() === email)) {
      setFormError('That email is already on the team list.');
      return;
    }
    setFormError(null);
    setAdding(true);
    try {
      await addTeamMember({
        name,
        email: email || null,
        isDesigner: newIsDesigner,
        isDog: newIsDog,
      });
      setNewName('');
      setNewEmail('');
      setNewIsDesigner(false);
      setNewIsDog(false);
      await reload();
      onMembersChanged();
    } catch (e) {
      setFormError('Could not add: ' + (e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const handleArchiveToggle = async (member: TeamMember) => {
    const verb = member.archived ? 'Restore' : 'Archive';
    if (!member.archived && !window.confirm(`Archive ${member.name}? Their bookings stay, but they disappear from pickers and the roster. You can restore them any time.`)) {
      return;
    }
    setBusyId(member.id);
    try {
      await setMemberArchived(member.id, !member.archived);
      await reload();
      onMembersChanged();
    } catch (e) {
      alert(`${verb} failed: ` + (e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        {/* Header with tabs */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
              Admin settings
            </h3>
          </div>
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg">
            <button
              onClick={() => setTab('bookings')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                tab === 'bookings'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              Bookings
            </button>
            <button
              onClick={() => setTab('team')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                tab === 'team'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Team
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-md transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {tab === 'bookings' ? (
          <>
            {/* Week + day controls — fixed while the list scrolls */}
            <div className="px-4 pt-3 pb-3 space-y-2.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center justify-center gap-1">
                <button
                  onClick={() => onShiftWeek(-7)}
                  className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-900 transition-all cursor-pointer active:scale-90"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-medium text-slate-900 min-w-[150px] text-center tabular-nums">
                  {weekLabel}
                </span>
                <button
                  onClick={() => onShiftWeek(7)}
                  className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-900 transition-all cursor-pointer active:scale-90"
                  aria-label="Next week"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="flex justify-center gap-1">
                {DAYS.map((d) => {
                  const count = bookings.filter((b) => b.day === d).length;
                  return (
                    <button
                      key={d}
                      onClick={() => setDay(d)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer tabular-nums ${
                        day === d
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {d.slice(0, 3)}
                      {count > 0 && <span className="ml-1 opacity-60">{count}</span>}
                    </button>
                  );
                })}
              </div>
              {/* Add a booking */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2">
                <UserPlus className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                <select
                  value={addMemberId}
                  onChange={(e) => setAddMemberId(e.target.value)}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:ring-2 focus:ring-dock-navy cursor-pointer min-w-0"
                >
                  <option value="">— who's coming in? —</option>
                  {unbookedMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.isDog ? `🐶 ${m.name}` : m.name}
                    </option>
                  ))}
                </select>
                {addMemberId ? (
                  <>
                    <select
                      value={addAssign}
                      onChange={(e) => setAddAssign(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:ring-2 focus:ring-dock-navy cursor-pointer min-w-0"
                    >
                      <option value="">— assign —</option>
                      {memberById[addMemberId]?.isDog ? (
                        <>
                          <option value="pup">Pup bed</option>
                          <optgroup label="At a desk">
                            {desks.map((d) => {
                              const occupant = occupantByDesk[d.id];
                              return (
                                <option key={d.id} value={`desk-${d.id}`}>
                                  Desk {d.number}
                                  {occupant
                                    ? ` — with ${memberById[occupant]?.name.split(' ')[0] ?? '?'}`
                                    : ''}
                                </option>
                              );
                            })}
                          </optgroup>
                        </>
                      ) : (
                        <>
                          <optgroup label="Desks">
                            {desks.map((d) => {
                              const occupant = occupantByDesk[d.id];
                              return (
                                <option key={d.id} value={`desk-${d.id}`} disabled={!!occupant}>
                                  Desk {d.number}
                                  {occupant
                                    ? ` — ${memberById[occupant]?.name.split(' ')[0] ?? 'taken'}`
                                    : ''}
                                </option>
                              );
                            })}
                          </optgroup>
                          <optgroup label="No desk">
                            <option value="sofa_surf">Sofa surfing</option>
                            <option value="wfh">Working from home</option>
                          </optgroup>
                        </>
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddBooking}
                      disabled={!addAssign}
                      className="py-1.5 px-3 rounded-lg bg-dock-navy text-white text-[11px] font-bold cursor-pointer hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed shrink-0"
                    >
                      Book
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            {/* Day's bookings — scrolls */}
            <div className="p-4 overflow-y-auto">
              {sortedRows.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  No bookings on {day} yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {sortedRows.map((b) => {
                    const m = memberById[b.memberId];
                    if (!m) return null;
                    return (
                      <div
                        key={b.memberId}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border bg-white border-slate-200"
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                            m.isDog ? 'bg-amber-100 text-amber-700' : 'bg-slate-900 text-white'
                          }`}
                        >
                          {m.isDog ? <PawPrint className="w-3 h-3" /> : initialsOf(m.name)}
                        </div>
                        <p className="text-[11px] font-semibold text-slate-900 truncate flex-1 min-w-0">
                          {m.name}
                        </p>
                        {assignmentSelect(b.memberId, assignValue(b), !!m.isDog)}
                        <button
                          type="button"
                          onClick={() => handleRemoveBooking(b.memberId)}
                          disabled={rowBusyId === b.memberId}
                          className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                          title="Remove booking"
                          aria-label={`Remove ${m.name}'s booking`}
                        >
                          {rowBusyId === b.memberId ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Team tab: fixed add form + search; only the member grid scrolls */}
            <div className="px-4 pt-3 pb-3 space-y-3 border-b border-slate-100 shrink-0">
              {/* Add member — one inline row */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-slate-500 shrink-0">
                    <UserPlus className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Full name"
                    className="flex-1 min-w-[120px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-dock-navy"
                  />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="name@dockandbay.com"
                    className="flex-1 min-w-[160px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-dock-navy"
                  />
                  <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={newIsDesigner}
                      onChange={(e) => setNewIsDesigner(e.target.checked)}
                      className="accent-[#f3705a]"
                    />
                    Designer
                  </label>
                  <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={newIsDog}
                      onChange={(e) => setNewIsDog(e.target.checked)}
                      className="accent-amber-500"
                    />
                    Pup
                  </label>
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={adding || !newName.trim()}
                    className="py-1.5 px-3.5 rounded-lg bg-dock-navy text-white text-xs font-bold transition-all cursor-pointer hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
                  >
                    {adding && <Loader2 className="w-3 h-3 animate-spin" />}
                    Add
                  </button>
                </div>
                {formError && (
                  <p className="text-[11px] text-red-600 px-0.5 mt-1.5">{formError}</p>
                )}
              </div>

              {/* Search + count */}
              <div className="flex items-center gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or email…"
                    className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-dock-navy"
                  />
                </div>
                <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                  {active.length} active{archived.length > 0 ? ` · ${archived.length} archived` : ''}
                </span>
              </div>
            </div>

            {/* Scrolling member grid */}
            <div className="p-4 overflow-y-auto">
              {members === null ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {active.map(memberRow)}
                  </div>
                  {archived.length > 0 && (
                    <>
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider pt-1">
                        Archived
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {archived.map(memberRow)}
                      </div>
                    </>
                  )}
                  {active.length === 0 && archived.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">
                      No-one matches that search.
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
