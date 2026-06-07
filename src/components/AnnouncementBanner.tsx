import React, { useEffect, useRef, useState } from 'react';
import { Megaphone, Pencil, Check, X } from 'lucide-react';
import { fetchAnnouncement, saveAnnouncement } from '../lib/repository';

// Shown whenever no custom message is set — the banner is never blank, so the
// attendance rule is always visible (Sarah's ask: "it holds people accountable
// because it's on there").
const DEFAULT_MESSAGE = 'Reminder: 2 days a week minimum in the office';

interface AnnouncementBannerProps {
  // Only admins (Diviyaj, Sarah, Gabriella) see the edit pencil.
  isAdmin: boolean;
  // Recorded as updated_by on save.
  currentUserId: string | null;
}

export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({
  isAdmin,
  currentUserId,
}) => {
  // null = not loaded yet (render nothing to avoid a default-message flash)
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAnnouncement()
      .then(setMessage)
      .catch(() => setMessage('')); // fall back to the default on load failure
  }, []);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (message === null) return null;

  const displayed = message.trim() || DEFAULT_MESSAGE;
  const isCustom = !!message.trim();

  const startEdit = () => {
    setDraft(message);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft('');
  };

  // Saving an empty draft clears the custom message — banner falls back to
  // the default reminder rather than disappearing.
  const handleSave = async () => {
    const next = draft.trim();
    setSaving(true);
    try {
      await saveAnnouncement(next, currentUserId);
      setMessage(next);
      setEditing(false);
    } catch (e) {
      alert('Could not save the banner: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-dock-yellow/15 border-b border-dock-yellow/40 px-4 md:px-8 py-1.5 flex items-center justify-center gap-2 shrink-0 min-h-[32px]">
      <Megaphone className="w-3.5 h-3.5 text-[#854d0e] shrink-0" />
      {editing ? (
        <div className="flex items-center gap-1.5 flex-1 max-w-xl">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') cancelEdit();
            }}
            maxLength={140}
            placeholder={DEFAULT_MESSAGE}
            className="flex-1 bg-white/80 border border-dock-yellow/60 rounded-md px-2.5 py-1 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-dock-yellow min-w-0"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="p-1 rounded-md bg-[#854d0e] text-white hover:bg-[#6b3e0b] transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            title="Save (clears to the default reminder if left empty)"
            aria-label="Save banner"
          >
            <Check className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            className="p-1 rounded-md text-[#854d0e] hover:bg-dock-yellow/30 transition-colors cursor-pointer shrink-0"
            title="Cancel"
            aria-label="Cancel editing"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs font-medium text-[#854d0e] truncate">
            {displayed}
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={startEdit}
              className="p-1 rounded-md text-[#854d0e]/60 hover:text-[#854d0e] hover:bg-dock-yellow/30 transition-colors cursor-pointer shrink-0"
              title={isCustom ? 'Edit banner message' : 'Set a banner message'}
              aria-label="Edit banner message"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </>
      )}
    </div>
  );
};
