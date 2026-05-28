import React from 'react';
import { TeamMember, Booking, DayOfWeek, Desk } from '../types';
import { Sofa, Trash, ArrowUpDown, RefreshCw, Sparkles, AlertTriangle, Download, FileSpreadsheet } from 'lucide-react';

interface SpreadsheetViewProps {
  teamMembers: TeamMember[];
  bookings: Booking[];
  desks: Desk[];
  onCellClick: (memberId: string, day: DayOfWeek) => void;
  day: DayOfWeek;
  // Week navigation — drives the bottom sheet tabs. The same rolling 1-week
  // rules apply: only the current week (and next, from Thursday) are reachable.
  activeWeek: string;
  currentMondayStr: string;
  nextMondayDateStr: string;
  isNextWeekUnlocked: boolean;
  onWeekChange: (weekId: string) => void;
}

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// "Jun 1" style short label for the week-tab buttons
function shortWeekLabel(mondayStr: string): string {
  const [y, m, d] = mondayStr.split('-').map(Number);
  const monday = new Date(y, m - 1, d);
  return monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export const SpreadsheetView: React.FC<SpreadsheetViewProps> = ({
  teamMembers,
  bookings,
  desks,
  onCellClick,
  day,
  activeWeek,
  currentMondayStr,
  nextMondayDateStr,
  isNextWeekUnlocked,
  onWeekChange,
}) => {
  const [filterMode, setFilterMode] = React.useState<'all' | 'humans' | 'dogs'>('all');

  // Find booking for member on a specific day
  const getBookingForCell = (memberId: string, day: DayOfWeek) => {
    return bookings.find((b) => b.memberId === memberId && b.day === day);
  };

  const getDeskById = (id: number) => {
    return desks.find((d) => d.id === id);
  };

  // Sort humans and dogs
  const humans = React.useMemo(() => teamMembers.filter((m) => !m.isDog), [teamMembers]);
  const dogs = React.useMemo(() => teamMembers.filter((m) => m.isDog), [teamMembers]);

  const filteredMembers = React.useMemo(() => {
    if (filterMode === 'humans') return humans;
    if (filterMode === 'dogs') return dogs;
    return teamMembers;
  }, [filterMode, teamMembers, humans, dogs]);

  // Handle Export to CSV
  const handleExportCSV = () => {
    const headers = ['Team Member', 'Category', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    // Rows
    const rows = teamMembers.map(member => {
      const rowData = [
        member.name,
        member.isDog ? 'Dog' : member.isDesigner ? 'Designer' : 'Core Team'
      ];
      
      DAYS.forEach(dayOfWeek => {
        const booking = bookings.find(b => b.memberId === member.id && b.day === dayOfWeek);
        if (booking) {
          if (booking.status === 'booked' && booking.deskId !== null) {
            rowData.push(`Desk ${booking.deskId}`);
          } else if (booking.status === 'sofa_surf') {
            rowData.push('Sofa Surf');
          } else if (booking.status === 'wfh') {
            rowData.push('WFH Out');
          } else {
            rowData.push('—');
          }
        } else {
          rowData.push('—');
        }
      });
      
      return rowData;
    });

    // Create CSV payload
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => {
        const escaped = val.replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(','))
    ].join('\n');

    // Trigger Download file dialog
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `dock_and_bay_hq_booking_rota_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden h-full flex flex-col">
      {/* Google Sheets Inspired Title & Tools bar */}
      <div className="bg-[#107c41] px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white">
        <div className="flex items-center gap-2.5">
          <div className="bg-[#ffffff20] p-1 text-xs font-bold font-mono rounded-md uppercase tracking-wide flex items-center gap-1">
            <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
            <span>Spreadsheet Editor</span>
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight">HOT DESK PLAN — INTERACTIVE SHEET</h2>
            <p className="text-[11px] text-emerald-100 font-mono">Click any cell to book or edit</p>
          </div>
        </div>

        {/* Toolbar with Filter & Export Button */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Group */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-emerald-100 font-mono font-bold uppercase tracking-wide">Filter:</span>
            <div className="bg-emerald-900/40 p-0.5 rounded-lg flex border border-emerald-600/30">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                  filterMode === 'all' ? 'bg-white text-[#107c41] shadow-sm' : 'text-emerald-100 hover:bg-emerald-800/40'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterMode('humans')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                  filterMode === 'humans' ? 'bg-white text-[#107c41] shadow-sm' : 'text-emerald-100 hover:bg-emerald-800/40'
                }`}
              >
                33 Humans
              </button>
              <button
                onClick={() => setFilterMode('dogs')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                  filterMode === 'dogs' ? 'bg-white text-[#107c41] shadow-sm' : 'text-emerald-100 hover:bg-emerald-800/40'
                }`}
              >
                Office Pups
              </button>
            </div>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-sky-50 hover:bg-white text-[#107c41] border border-sky-100 hover:border-white rounded-lg text-[11px] font-extrabold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer select-none"
            title="Download full rota as a standard CSV spreadsheet"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>


      <div className="flex-1 overflow-auto text-[11px]">
        <table className="min-w-full border-collapse border border-slate-200">
          <thead>
            {/* Spreadsheet Column Headings A, B, C, D, E, F */}
            <tr className="bg-[#f8f9fa] border-b border-slate-200 divide-x divide-slate-200 font-mono text-center text-gray-500 h-6">
              <th className="w-8 shrink-0 text-[10px] font-semibold"></th>
              <th className="text-left px-3 text-[10px] font-semibold min-w-[200px]">A</th>
              <th className="px-3 text-[10px] font-semibold min-w-[120px]">B (Mon)</th>
              <th className="px-3 text-[10px] font-semibold min-w-[120px]">C (Tue)</th>
              <th className="px-3 text-[10px] font-semibold min-w-[120px]">D (Wed)</th>
              <th className="px-3 text-[10px] font-semibold min-w-[120px]">E (Thu)</th>
              <th className="px-3 text-[10px] font-semibold min-w-[120px]">F (Fri)</th>
            </tr>
            {/* Headers row with Labels */}
            <tr className="bg-[#f8f9fa] border-b border-slate-200 divide-x divide-slate-200 text-center text-gray-700 font-bold uppercase tracking-wider h-8">
              <td className="w-8 shrink-0 select-none bg-slate-100 text-[9px] font-mono text-slate-400">1</td>
              <td className="text-left px-3 text-slate-800">Team Member</td>
              {DAYS.map((d) => (
                <td
                  key={d}
                  className={`px-3 font-semibold ${
                    d === day ? 'bg-dock-navy text-white text-xs py-1' : 'text-slate-700'
                  }`}
                >
                  {d.toUpperCase()}
                </td>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {/* Render human team members */}
            {filterMode !== 'dogs' && (
              <>
                {humans.map((member, idx) => {
                  const rowNum = idx + 2; // Rows in sheets start at 2
                  return renderRow(member, rowNum);
                })}
              </>
            )}

            {/* Dogs section header */}
            {filterMode === 'all' && (
              <tr className="bg-slate-50 divide-x divide-slate-200 h-8">
                <td className="w-8 shrink-0 select-none bg-slate-100 text-[9px] font-mono text-slate-400 text-center">
                  {humans.length + 2}
                </td>
                <td className="px-3 tracking-wider text-slate-500 text-[10px] uppercase font-semibold">
                  Dogs in the office
                </td>
                <td colSpan={5}></td>
              </tr>
            )}

            {/* Render dog members */}
            {filterMode !== 'humans' && (
              <>
                {dogs.map((dog, idx) => {
                  const rowOffset = filterMode === 'dogs' ? 2 : humans.length + 3;
                  const rowNum = idx + rowOffset;
                  return renderRow(dog, rowNum);
                })}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Sheets Tab Bar at Bottom — functional week switcher matching the rolling
          1-week rule (current week always; next week from Thursday). */}
      <div className="bg-[#f8f9fa] border-t border-slate-200 px-4 py-2 flex items-center gap-2 text-xs select-none">
        <button
          type="button"
          onClick={() => onWeekChange(currentMondayStr)}
          className={`px-3.5 py-1 font-bold rounded-t-md transition-colors ${
            activeWeek === currentMondayStr
              ? 'bg-white border-x border-t border-slate-300 text-[#107c41] shadow-sm border-b-2 border-b-white z-10 -mb-[9px] cursor-default'
              : 'text-slate-500 hover:text-slate-900 hover:bg-white/50 cursor-pointer'
          }`}
        >
          {shortWeekLabel(currentMondayStr)} (This week)
        </button>
        <button
          type="button"
          onClick={() => isNextWeekUnlocked && onWeekChange(nextMondayDateStr)}
          disabled={!isNextWeekUnlocked}
          title={isNextWeekUnlocked ? 'Switch to next week' : 'Next week unlocks Thursday'}
          className={`px-3.5 py-1 font-bold rounded-t-md transition-colors ${
            activeWeek === nextMondayDateStr
              ? 'bg-white border-x border-t border-slate-300 text-[#107c41] shadow-sm border-b-2 border-b-white z-10 -mb-[9px] cursor-default'
              : isNextWeekUnlocked
                ? 'text-slate-500 hover:text-slate-900 hover:bg-white/50 cursor-pointer'
                : 'text-gray-400 cursor-not-allowed'
          }`}
        >
          {shortWeekLabel(nextMondayDateStr)} (Next week)
        </button>
      </div>
    </div>
  );

  function renderRow(member: TeamMember, rowNum: number) {
    return (
      <tr
        key={member.id}
        id={`row-${member.id}`}
        className="hover:bg-slate-50/70 transition-colors h-8 divide-x divide-slate-200"
      >
        {/* Row number label */}
        <td className="text-center w-8 bg-slate-50 text-[9px] font-mono text-slate-400 select-none">
          {rowNum}
        </td>

        {/* Name cell with avatar or dog icon */}
        <td className="px-3 font-semibold text-slate-800 h-8">
          <div className="flex items-center w-full h-full gap-1.5">
            {member.isDog ? (
              <span className="text-xs">🐶</span>
            ) : (
              <span className="text-[10px] w-4.5 h-4.5 bg-slate-100 border border-slate-300 rounded-full flex items-center justify-center text-slate-500 font-bold font-mono">
                {member.name.split(' ').map((n) => n[0]).join('')}
              </span>
            )}
            <span className={`truncate ${member.isDog ? 'text-emerald-700 font-bold font-mono text-xs' : ''}`}>
              {member.name}
            </span>
          </div>
        </td>

        {/* Days Mon -> Fri */}
        {DAYS.map((dayOfWeek) => {
          const booking = getBookingForCell(member.id, dayOfWeek);
          let cellStyle = 'bg-white cursor-pointer';
          let displayVal = '—';

          if (booking) {
            if (booking.status === 'booked') {
              if (member.isDog) {
                displayVal = '🐶 PUP BED';
                cellStyle = 'bg-amber-100/70 font-bold text-amber-800 hover:bg-amber-200/80 cursor-pointer';
              } else if (booking.deskId !== null) {
                const desk = getDeskById(booking.deskId);
                displayVal = `DESK ${booking.deskId}`;
                if (desk?.type === 'design') {
                  cellStyle = 'bg-rose-100 font-bold text-rose-800 hover:bg-rose-200 cursor-pointer'; // Coral style
                } else {
                  cellStyle = 'bg-sky-100 font-bold text-[#0369a1] hover:bg-[#bae6fd] cursor-pointer'; // Blue style
                }
              }
            } else if (booking.status === 'sofa_surf') {
              if (member.isDog) {
                displayVal = '🐶 PUP BED';
                cellStyle = 'bg-amber-100/70 font-bold text-amber-800 hover:bg-amber-200/80 cursor-pointer';
              } else {
                displayVal = 'SOFA SURF';
                cellStyle = 'bg-[#fef9c3] font-bold text-[#854d0e] hover:bg-[#fef08a] cursor-pointer'; // Yellow Sofa Surf
              }
            } else if (booking.status === 'wfh') {
              displayVal = 'WFH Out';
              cellStyle = 'bg-slate-100/60 font-medium text-slate-400 hover:bg-slate-200/50 cursor-pointer';
            }
          }

          return (
            <td
              key={dayOfWeek}
              onClick={() => onCellClick(member.id, dayOfWeek)}
              className={`text-center px-1 font-mono text-[10px] tracking-tight relative transition-all duration-150 select-none ${cellStyle}`}
              title={`Click to register/edit booking for ${member.name} on ${dayOfWeek}`}
            >
              {displayVal}
            </td>
          );
        })}
      </tr>
    );
  }
};
