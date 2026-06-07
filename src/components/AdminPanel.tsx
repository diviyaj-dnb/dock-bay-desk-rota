import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  ShieldCheck,
  UserPlus,
  Archive,
  ArchiveRestore,
  PawPrint,
  CalendarRange,
  Loader2,
  Search,
} from 'lucide-react';
import { TeamMember } from '../types';
import { fetchAllTeamMembers, addTeamMember, setMemberArchived } from '../lib/repository';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // Called after any change so the host app can refresh its member list.
  onMembersChanged: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  onMembersChanged,
}) => {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Add-member form
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
    if (isOpen) reload();
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

  if (!isOpen) return null;

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
        {m.isDog ? (
          <PawPrint className="w-3.5 h-3.5" />
        ) : (
          m.name
            .split(' ')
            .map((p) => p[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
        )}
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
              Team settings
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-md transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Fixed top section: admin note + add form + search. Only the member
            grid below scrolls, so the controls never disappear off-screen. */}
        <div className="px-4 pt-3 pb-3 space-y-3 border-b border-slate-100 shrink-0">
          {/* Booking window note — single compact line */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 px-0.5">
            <CalendarRange className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <p>
              To book for someone: <strong className="text-slate-700">pick any week with the
              arrows, click a desk, choose the person.</strong> Your arrows are unlocked —
              everyone else keeps the Friday rule.
            </p>
          </div>

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
      </div>
    </div>
  );
};
