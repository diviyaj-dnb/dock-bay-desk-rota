import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Loader2, Plus, X } from 'lucide-react';
import {
  ROOMS,
  SLOT_COUNT,
  SLOT_MINUTES,
  DAY_START_HOUR,
  slotToDate,
  fmtTime,
  findConflict,
  overlaps,
  type Room,
  type RoomEvent,
  type RoomsProvider,
} from '../lib/rooms';

interface RoomsViewProps {
  /** The day being viewed, as a real Date (rooms are time-based, unlike desks). */
  date: Date;
  provider: RoomsProvider;
  /** Name put on the booking so the room calendar says who has it. */
  bookerName: string;
  /** Rooms are open to everyone; admins can clear anyone's app-made booking. */
  isAdmin?: boolean;
}

const DURATIONS = [30, 60, 90, 120];

export const RoomsView: React.FC<RoomsViewProps> = ({
  date,
  provider,
  bookerName,
  isAdmin = false,
}) => {
  const [events, setEvents] = useState<RoomEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ room: Room; slot: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setEvents(await provider.listDay(date));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load room bookings.');
      setEvents([]);
    }
  }, [provider, date]);

  useEffect(() => {
    setEvents(null);
    void load();
  }, [load]);

  const slots = useMemo(() => Array.from({ length: SLOT_COUNT }, (_, i) => i), []);

  // Which event, if any, covers a given room+slot.
  const eventAt = (roomKey: string, slot: number) => {
    if (!events) return undefined;
    const s = slotToDate(date, slot);
    const e = slotToDate(date, slot + 1);
    return events.find((ev) => ev.roomKey === roomKey && overlaps(s, e, ev.start, ev.end));
  };

  // Only the first slot of a booking renders the label, so a 90-minute meeting
  // reads as one block rather than three.
  const isEventStart = (ev: RoomEvent, slot: number) => {
    const s = slotToDate(date, slot);
    const prev = slot === 0 ? null : slotToDate(date, slot - 1);
    return !prev || !overlaps(prev, s, ev.start, ev.end) || slot === 0;
  };

  const submit = async (minutes: number) => {
    if (!draft || !events) return;
    const start = slotToDate(date, draft.slot);
    const end = new Date(start.getTime() + minutes * 60_000);
    const input = { roomKey: draft.room.key, title: bookerName, start, end };

    // These are plain shared calendars, not Workspace room resources, so Google
    // will NOT auto-decline a clash. This check is the only thing preventing it.
    const clash = findConflict(events, input);
    if (clash) {
      setError(
        `${draft.room.name} is already taken ${fmtTime(clash.start)}–${fmtTime(clash.end)} (${clash.title}).`,
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await provider.create(input);
      setDraft(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that booking.');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (ev: RoomEvent) => {
    if (!window.confirm(`Cancel "${ev.title}"?`)) return;
    setSaving(true);
    try {
      await provider.remove(ev.roomKey, ev.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel that booking.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/70 overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-4 py-3 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Meeting rooms</h2>
          <p className="text-[11px] text-slate-500">
            Booked straight into Google Calendar. Everyone sees it there too.
          </p>
        </div>
        <a
          href="https://calendar.google.com/calendar/r"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <Calendar className="w-3.5 h-3.5" />
          Open Calendar
        </a>
      </div>

      {error && (
        <div className="mx-4 mt-3 flex items-start gap-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-700 cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {events === null ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Reading Google Calendar…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[640px] p-4">
            <div
              className="grid gap-px"
              style={{ gridTemplateColumns: `64px repeat(${ROOMS.length}, minmax(0, 1fr))` }}
            >
              {/* Header */}
              <div />
              {ROOMS.map((room) => (
                <div key={room.key} className="pb-2 px-2 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                      style={{ background: room.colour }}
                    />
                    <span className="text-[13px] font-semibold text-slate-900">{room.name}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {room.blurb} · {room.capacity}
                  </p>
                </div>
              ))}

              {/* Time grid */}
              {slots.map((slot) => {
                const t = slotToDate(date, slot);
                const onHour = t.getMinutes() === 0;
                return (
                  <React.Fragment key={slot}>
                    <div
                      className={`pr-2 text-right text-[10px] leading-none h-7 flex items-center justify-end ${
                        onHour ? 'text-slate-500 font-medium' : 'text-slate-300'
                      }`}
                    >
                      {onHour ? fmtTime(t) : ''}
                    </div>

                    {ROOMS.map((room) => {
                      const ev = eventAt(room.key, slot);
                      if (ev) {
                        const first = isEventStart(ev, slot);
                        return (
                          <div
                            key={room.key}
                            className="h-7 px-1.5 flex items-center overflow-hidden"
                            style={{
                              background: `${room.colour}1A`,
                              borderTop: first ? `2px solid ${room.colour}` : undefined,
                            }}
                            title={`${ev.title} · ${fmtTime(ev.start)}–${fmtTime(ev.end)}`}
                          >
                            {first && (
                              <div className="flex items-center gap-1.5 min-w-0 w-full">
                                <span className="text-[11px] font-medium text-slate-800 truncate">
                                  {ev.title}
                                </span>
                                <span className="text-[10px] text-slate-500 shrink-0">
                                  {fmtTime(ev.start)}
                                </span>
                                {(ev.ours || isAdmin) && (
                                  <button
                                    onClick={() => cancel(ev)}
                                    disabled={saving}
                                    className="ml-auto shrink-0 text-slate-400 hover:text-red-600 cursor-pointer disabled:opacity-40"
                                    aria-label={`Cancel ${ev.title}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }

                      const isDraft = draft?.room.key === room.key && draft.slot === slot;
                      return (
                        <button
                          key={room.key}
                          onClick={() => setDraft(isDraft ? null : { room, slot })}
                          className={`h-7 group flex items-center justify-center transition-colors cursor-pointer ${
                            isDraft
                              ? 'bg-slate-900'
                              : onHour
                                ? 'bg-slate-50 hover:bg-emerald-50'
                                : 'bg-slate-50/60 hover:bg-emerald-50'
                          }`}
                          aria-label={`Book ${room.name} at ${fmtTime(t)}`}
                        >
                          {isDraft ? (
                            <span className="text-[10px] font-medium text-white">
                              {fmtTime(t)} — pick a length
                            </span>
                          ) : (
                            <Plus className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </button>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Duration picker — appears once a slot is chosen. */}
      {draft && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-slate-700">
            <strong>{draft.room.name}</strong> from {fmtTime(slotToDate(date, draft.slot))} for
          </span>
          {DURATIONS.map((m) => (
            <button
              key={m}
              onClick={() => submit(m)}
              disabled={saving}
              className="px-2.5 py-1 text-[12px] font-medium rounded-lg bg-white border border-slate-300 hover:border-slate-900 hover:bg-slate-900 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
            >
              {m < 60 ? `${m}m` : `${m / 60}h`}
            </button>
          ))}
          <button
            onClick={() => setDraft(null)}
            className="ml-auto text-[12px] text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            Cancel
          </button>
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
        </div>
      )}

      <div className="px-4 py-2.5 border-t border-slate-100 text-[11px] text-slate-500">
        Booking here puts <strong>{bookerName}</strong> on the room's Google Calendar. For a
        meeting with invites and a Meet link, book it in Calendar instead — it shows up here
        either way. Slots are {SLOT_MINUTES} minutes, {DAY_START_HOUR}:00 onwards.
      </div>
    </div>
  );
};
