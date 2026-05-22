import React, { useState, useEffect } from 'react';
import { TeamMember, Booking, Desk, DayOfWeek } from '../types';
import { Sofa, Ban, X, Check, Laptop, Trash, PawPrint, PenTool, MapPin, AlertTriangle, Info } from 'lucide-react';

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
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [bookingStatus, setBookingStatus] = useState<'booked' | 'sofa_surf' | 'wfh'>('booked');
  const [selectedDeskId, setSelectedDeskId] = useState<number | null>(null);

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

  // Is a desk taken? Returns the occupant member
  const getDeskOccupant = (id: number) => {
    const booking = otherBookingsOnSelectedDay.find((b) => b.deskId === id);
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
    const finalDeskId = currentMember?.isDog ? null : selectedDeskId;
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-fade-in">
      <div 
        id="booking-modal-container"
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 tracking-tight">Manage booking</h3>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">{dateLabelFor(weekId, day)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Member Picker */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase text-slate-500 mb-1.5 flex items-center justify-between">
              <span>Select Team Member</span>
              <span className="text-[10px] text-slate-400 capitalize">Who is this booking for?</span>
            </label>
            <div className="relative">
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
          </div>

          {/* Rota Action Buttons Selector */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase text-slate-500 mb-1.5">
              Attendance Rota Status
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

          {/* Desk assignment */}
          {bookingStatus === 'booked' && (
            currentMember?.isDog ? (
              <div className="border border-slate-200 rounded-xl p-4 text-xs space-y-2 text-slate-600">
                <div className="flex items-center gap-2">
                  <PawPrint className="w-4 h-4 text-slate-500" />
                  <p className="font-semibold text-slate-900">Pup room</p>
                </div>
                <p className="leading-relaxed">
                  <strong className="text-slate-900">{currentMember.name}</strong> will be placed in the pup room on {day} — no desk needed.
                </p>
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

          {/* Booking reminder */}
          <div className="border border-slate-200 rounded-lg px-3.5 py-3 text-xs leading-relaxed text-slate-600 flex gap-2.5 items-start">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <p>
              Book one week ahead. Try a different desk than your usual, and leave the coral-marked desks for the design team.
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-between gap-3">
          {/* Delete Action (only available if we have an active booker) */}
          {selectedMemberId && bookings.some(b => b.memberId === selectedMemberId && b.day === day) ? (
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
              Cancel
            </button>
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
              <span>Save Schedule</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
