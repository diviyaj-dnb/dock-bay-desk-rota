import React, { useState, useEffect, useMemo } from 'react';
import { TeamMember, Booking, Desk, DayOfWeek } from '../types';
import { Sofa, Ban, X, Check, Laptop, Trash, PawPrint, PenTool, MapPin, AlertTriangle, Info, ChevronDown, Home } from 'lucide-react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  day: DayOfWeek;
  weekId: string;            // Monday of the active week, "YYYY-MM-DD"
  memberId: string | null;  // the member being booked
  deskId: number | null;     // the desk being booked (if clicked directly)
  teamMembers: TeamMember[];
  desks: Desk[];
  bookings: Booking[];
  onSave: (memberId: string, day: DayOfWeek, deskId: number | null, status: 'booked' | 'sofa_surf' | 'wfh') => void;
  onDelete: (memberId: string, day: DayOfWeek) => void;
  // When true, the modal was opened from the pup-bed hotspot — picker is
  // filtered to dogs only, status buttons + desk grid are hidden, and save
  // is forced to ('booked', desk_id=null).
  pupBookingMode?: boolean;
  // Admins (Diviyaj, Sarah, Gabriella) may book/edit/remove for anyone.
  // Non-admins are limited to their own bookings.
  isAdmin?: boolean;
  // The signed-in user's team-member id — "own" booking is one where the
  // booking's member equals this.
  currentUserId?: string | null;
}

// Compute the actual calendar date for a given (weekId, day) pair and format it
// as a UK-style "Tuesday, 26 May 2026" string.
const DAY_INDEX: Record<DayOfWeek, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
};
function dateLabelFor(weekId: string, day: DayOfWeek): string {
  const [y, m, d] = weekId.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + DAY_INDEX[day]);
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  day,
  weekId,
  memberId,
  deskId,
  teamMembers,
  desks,
  bookings,
  onSave,
  onDelete,
  pupBookingMode = false,
  isAdmin = false,
  currentUserId = null,
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [bookingStatus, setBookingStatus] = useState<'booked' | 'sofa_surf' | 'wfh'>('booked');
  const [selectedDeskId, setSelectedDeskId] = useState<number | null>(null);
  // Disclosure for the full form. Defaults to false (compact mode) when context
  // is unambiguous — user clicked a specific desk with a specific member in mind.
  const isSimpleCase = !!memberId && !!deskId && !pupBookingMode;
  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(!isSimpleCase);

  // Reset disclosure to the appropriate default each time the modal opens fresh.
  useEffect(() => {
    if (isOpen) setShowMoreOptions(!isSimpleCase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Load state when modal opens or selections change
  useEffect(() => {
    if (memberId) {
      setSelectedMemberId(memberId);
      // Check existing booking for this member & day
      const existing = bookings.find((b) => b.memberId === memberId && b.day === day);
      if (existing) {
        setBookingStatus(existing.status);
        setSelectedDeskId(existing.deskId);
      } else {
        setBookingStatus('booked');
        // If a desk was clicked directly, default to that desk
        setSelectedDeskId(deskId);
      }
    } else if (deskId) {
      // Desk clicked directly without pre-selected member
      setSelectedDeskId(deskId);
      setBookingStatus('booked');
      // If desk is booked, find the member and load details
      const existingBooking = bookings.find((b) => b.deskId === deskId && b.day === day);
      if (existingBooking) {
        setSelectedMemberId(existingBooking.memberId);
        setBookingStatus('booked');
      } else {
        setSelectedMemberId('');
      }
    } else {
      setSelectedMemberId('');
      setBookingStatus('booked');
      setSelectedDeskId(null);
    }
  }, [isOpen, memberId, deskId, day, bookings]);

  if (!isOpen) return null;

  const currentMember = teamMembers.find((m) => m.id === selectedMemberId);
  const targetDesk = selectedDeskId ? desks.find((d) => d.id === selectedDeskId) : null;

  // List of all bookings on this specific day (excluding the current member)
  const otherBookingsOnSelectedDay = bookings.filter(
    (b) => b.day === day && b.memberId !== selectedMemberId && b.deskId !== null
  );

  // Is a desk taken (by a HUMAN)? Dogs share desks with their owners, so a
  // dog at a desk never blocks it. Returns the human occupant member.
  const getDeskOccupant = (id: number) => {
    const booking = otherBookingsOnSelectedDay.find((b) => {
      if (b.deskId !== id) return false;
      const m = teamMembers.find((tm) => tm.id === b.memberId);
      return !m?.isDog;
    });
    return booking ? teamMembers.find((m) => m.id === booking.memberId) : null;
  };

  const handleStatusChange = (status: 'booked' | 'sofa_surf' | 'wfh') => {
    setBookingStatus(status);
    if (status !== 'booked') {
      setSelectedDeskId(null);
    } else {
      // Default to either the clicked desk, or first available desk
      setSelectedDeskId(deskId || null);
    }
  };

  const isFormValid = () => {
    if (!selectedMemberId) return false;
    if (currentMember?.isDog) return true;
    if (bookingStatus === 'booked' && !selectedDeskId) return false;
    return true;
  };

  const handleSave = () => {
    if (!isFormValid()) return;
    // Dogs may sit at a desk with their owner (deskId set) or default to the
    // pup bed (null). Sofa-surf/WFH always clear the desk.
    const finalDeskId = bookingStatus === 'booked' ? selectedDeskId : null;
    onSave(selectedMemberId, day, finalDeskId, bookingStatus);
    onClose();
  };

  const handleDelete = () => {
    if (!selectedMemberId) return;
    onDelete(selectedMemberId, day);
    onClose();
  };

  // Find designers and other users
  // Everyone alphabetical, dogs kept separate so they show below
  const humansList = teamMembers
    .filter((m) => !m.isDog)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const dogsList = teamMembers
    .filter((m) => m.isDog)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  // Derived for the compact summary view
  const memberInitials = useMemo(() => {
    if (!currentMember) return '?';
    return currentMember.name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [currentMember]);
  const isExistingBooking = !!(
    selectedMemberId && bookings.some((b) => b.memberId === selectedMemberId && b.day === day)
  );
  // Permission: admins manage anyone; everyone else only their own row.
  // For a fresh booking with no member chosen yet, non-admins implicitly book
  // for themselves, so it's allowed.
  const targetIsSelfOrEmpty = !selectedMemberId || selectedMemberId === currentUserId;
  // Dogs have no login, so anyone may book/manage a pup (they share a desk and
  // never evict a human). Admins + your own bookings are manageable as before.
  const canManage = isAdmin || targetIsSelfOrEmpty || !!currentMember?.isDog;
  const deskTypeLabel = targetDesk?.type === 'design'
    ? 'Design area'
    : targetDesk?.type === 'no-screen'
      ? 'No monitor'
      : 'Standard desk';
  const statusLabel = bookingStatus === 'booked'
    ? (currentMember?.isDog
        ? selectedDeskId
          ? `Desk ${selectedDeskId} · with ${getDeskOccupant(selectedDeskId)?.name ?? 'the team'}`
          : 'Pup bed'
        : selectedDeskId
          ? `Desk ${selectedDeskId} · ${deskTypeLabel}`
          : 'No desk picked yet')
    : bookingStatus === 'sofa_surf'
      ? 'Sofa surfing'
      : 'Working from home';

  // Dog seat picker — pup bed (default) or any desk, labelled with the human
  // sitting there so "next to their owner" is one glance.
  const dogDeskSelect = (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
        Where will they sit?
      </label>
      <select
        value={selectedDeskId ?? ''}
        onChange={(e) => setSelectedDeskId(e.target.value ? Number(e.target.value) : null)}
        className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-400 transition-all cursor-pointer font-medium"
      >
        <option value="">🛏 Pup bed</option>
        {desks.map((d) => {
          const occupant = getDeskOccupant(d.id);
          return (
            <option key={d.id} value={d.id}>
              Desk {d.number}
              {occupant ? ` — with ${occupant.name}` : ''}
            </option>
          );
        })}
      </select>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-fade-in">
      <div
        id="booking-modal-container"
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {pupBookingMode && <PawPrint className="w-4 h-4 text-amber-600 shrink-0" />}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight truncate">
                {pupBookingMode
                  ? 'Book the pup bed'
                  : isExistingBooking
                    ? 'Edit booking'
                    : !showMoreOptions
                      ? 'Reserve desk'
                      : 'Manage booking'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">{dateLabelFor(weekId, day)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-md transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-3">
          {/* Compact summary — always visible. Shows who/what/where at a glance
              so the 90% case ("I clicked my desk, book me") is a 1-click action. */}
          <div className={`flex items-center gap-2.5 p-3 rounded-xl border ${
            pupBookingMode ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm ${
              pupBookingMode
                ? 'bg-amber-500 text-white'
                : currentMember
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-200 text-slate-400'
            }`}>
              {pupBookingMode ? <PawPrint className="w-4 h-4" /> : memberInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-slate-900 truncate leading-tight">
                {currentMember?.name || (pupBookingMode ? 'Pick a pup below' : 'No-one selected')}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">{statusLabel}</p>
            </div>
          </div>

          {/* Pup-booking mode: dog picker + seat picker (pup bed or owner's desk) */}
          {pupBookingMode && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Which pup?
                </label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-400 transition-all cursor-pointer font-medium"
                >
                  <option value="">-- Choose a pup --</option>
                  {dogsList.map((m) => (
                    <option key={m.id} value={m.id}>🐶 {m.name}</option>
                  ))}
                </select>
              </div>
              {selectedMemberId && dogDeskSelect}
            </>
          )}

          {/* Member picker — admins only (non-admins always book themselves). */}
          {!pupBookingMode && showMoreOptions && isAdmin && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Who is this for?
              </label>
              <select
                id="select-team-member"
                value={selectedMemberId}
                onChange={(e) => {
                  setSelectedMemberId(e.target.value);
                  // Initialize booking details as needed for this member
                  const existing = bookings.find((b) => b.memberId === e.target.value && b.day === day);
                  if (existing) {
                    setBookingStatus(existing.status);
                    setSelectedDeskId(existing.deskId);
                  }
                }}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-3 text-xs outline-none focus:ring-2 focus:ring-dock-navy transition-all cursor-pointer font-medium"
              >
                <option value="">-- Choose a team member or pup --</option>
                <optgroup label="Team members">
                  {humansList.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Office pups">
                  {dogsList.map((m) => (
                    <option key={m.id} value={m.id}>🐶 {m.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}

          {/* Rota Action Buttons Selector — hidden in compact + pup-booking modes */}
          {!pupBookingMode && showMoreOptions && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Attendance status
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleStatusChange('booked')}
                className={`py-3 px-2 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                  bookingStatus === 'booked'
                    ? 'bg-dock-blue/15 border-dock-blue text-[#0369a1] font-bold shadow-sm'
                    : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-600'
                }`}
              >
                <Laptop className="w-5 h-5 text-sky-600" />
                <span className="text-[10px] font-mono leading-none">Book Desk</span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange('sofa_surf')}
                className={`py-3 px-2 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                  bookingStatus === 'sofa_surf'
                    ? 'bg-dock-yellow/15 border-dock-yellow text-[#854d0e] font-bold shadow-sm'
                    : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-600'
                }`}
              >
                <Sofa className="w-5 h-5 text-yellow-600" />
                <span className="text-[10px] font-mono leading-none font-semibold">Sofa Surf</span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange('wfh')}
                className={`py-3 px-2 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                  bookingStatus === 'wfh'
                    ? 'bg-slate-100 border-slate-300 text-slate-500 font-bold shadow-sm'
                    : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-600'
                }`}
              >
                <Ban className="w-5 h-5 text-slate-400" />
                <span className="text-[10px] font-mono leading-none">WFH Out</span>
              </button>
            </div>
          </div>
          )}

          {/* Desk assignment — only when more options is open AND not pup-booking */}
          {!pupBookingMode && showMoreOptions && bookingStatus === 'booked' && (
            currentMember?.isDog ? (
              <div className="border border-slate-200 rounded-xl p-4 text-xs space-y-3 text-slate-600">
                <div className="flex items-center gap-2">
                  <PawPrint className="w-4 h-4 text-slate-500" />
                  <p className="font-semibold text-slate-900">
                    {currentMember.name} on {day}
                  </p>
                </div>
                {dogDeskSelect}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-500">
                    Select desk
                  </label>
                  {currentMember?.isDesigner && (
                    <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                      <PenTool className="w-3 h-3" />
                      Design priority
                    </span>
                  )}
                </div>

                {/* Selected desk badge */}
                {selectedDeskId && (
                  <div className="bg-slate-50 px-3 py-2.5 rounded-lg border border-slate-200 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      <div>
                        <p className="font-semibold text-slate-900">Desk {selectedDeskId}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {targetDesk?.type === 'design'
                            ? 'Design area'
                            : targetDesk?.type === 'no-screen'
                              ? 'No monitor'
                              : 'Standard desk'}
                        </p>
                      </div>
                    </div>
                    {!currentMember?.isDesigner && targetDesk?.type === 'design' && (
                      <span className="text-[10px] text-amber-700 font-medium flex items-center gap-1 max-w-[180px] leading-tight">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        Reserved for designers
                      </span>
                    )}
                  </div>
                )}

                {/* Grid map array */}
                <div className="grid grid-cols-6 gap-1.5 max-h-44 overflow-y-auto p-1.5 bg-slate-100 rounded-xl border border-slate-200">
                  {desks.map((d) => {
                    const occupant = getDeskOccupant(d.id);
                    const isTaken = occupant !== null;
                    const isSelected = selectedDeskId === d.id;

                    let btnStyle = 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer';
                    if (isSelected) {
                      btnStyle = 'ring-2 ring-dock-navy bg-dock-blue text-slate-900 border-sky-400 font-bold';
                    } else if (isTaken) {
                      btnStyle = 'bg-slate-200/60 border-slate-200 text-slate-400 cursor-not-allowed';
                    } else if (d.type === 'design') {
                      btnStyle = 'bg-rose-50 border-rose-100 hover:bg-rose-100 text-rose-800 font-bold cursor-pointer';
                    } else if (d.type === 'no-screen') {
                      btnStyle = 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 cursor-pointer';
                    }

                    return (
                      <button
                        key={d.id}
                        type="button"
                        disabled={isTaken}
                        onClick={() => setSelectedDeskId(d.id)}
                        className={`h-11 rounded-lg border flex flex-col items-center justify-center p-1 text-center font-mono text-xs transition-all relative ${btnStyle}`}
                        title={isTaken ? `Booked by ${occupant?.name}` : `Desk ${d.number}`}
                      >
                        <span className="font-bold">#{d.number}</span>
                        {d.type === 'design' && !isSelected && !isTaken && (
                          <span className="text-[7px] text-rose-500 scale-90 font-sans font-extrabold">📐</span>
                        )}
                        {occupant && (
                          <span className="text-[7.5px] text-slate-400 font-sans truncate max-w-[50px] font-bold leading-none scale-90">
                            {occupant.name.split(' ')[0]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          )}

          {/* Booking reminder — only in full-form mode */}
          {!pupBookingMode && showMoreOptions && (
          <div className="border border-slate-200 rounded-lg px-3.5 py-3 text-xs leading-relaxed text-slate-600 flex gap-2.5 items-start">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <p>
              Book one week ahead. Try a different desk than your usual, and leave the coral-marked desks for the design team.
            </p>
          </div>
          )}

          {/* "More options" disclosure — hidden in pup-booking mode (no extra options needed) */}
          {!pupBookingMode && (
            <button
              type="button"
              onClick={() => setShowMoreOptions((v) => !v)}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors py-1.5 cursor-pointer"
            >
              <span>{showMoreOptions ? 'Hide options' : 'More options'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showMoreOptions ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        {/* Read-only notice when a non-admin is viewing someone else's booking */}
        {!canManage && (
          <div className="px-4 pb-1">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-[12px] text-slate-600 leading-relaxed">
              This is <strong className="text-slate-800">{currentMember?.name}</strong>&rsquo;s
              booking. You can only manage your own — ask an admin to change someone else&rsquo;s.
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="bg-slate-50/70 px-4 py-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-between gap-2">
          {/* Delete Action — only for managers of an existing booking */}
          {canManage && selectedMemberId && bookings.some(b => b.memberId === selectedMemberId && b.day === day) ? (
            <button
              type="button"
              onClick={handleDelete}
              className="py-2.5 px-4 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
            >
              <Trash className="w-4 h-4" />
              <span>Remove Booking</span>
            </button>
          ) : (
            <div></div> /* Placeholder */
          )}

          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-all cursor-pointer w-full sm:w-auto flex items-center justify-center"
            >
              {canManage ? 'Cancel' : 'Close'}
            </button>
            {canManage && (
              <button
                type="button"
                disabled={!isFormValid()}
                onClick={handleSave}
                className={`py-2.5 px-5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 w-full sm:w-auto ${
                  isFormValid()
                    ? 'bg-dock-navy text-white hover:bg-slate-800 cursor-pointer shadow-md'
                    : 'bg-slate-200 text-slate-400 border-slate-200 cursor-not-allowed'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>
                  {pupBookingMode
                    ? 'Book pup bed'
                    : isExistingBooking
                      ? 'Save changes'
                      : !showMoreOptions
                        ? 'Confirm'
                        : 'Save schedule'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
