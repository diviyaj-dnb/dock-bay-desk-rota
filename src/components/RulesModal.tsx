import React from 'react';
import { X, Calendar, Shuffle, PenTool, Sofa, Check } from 'lucide-react';
import logoUrl from '../assets/dock-and-bay-logo.jpg';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-350"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 font-sans">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Dock & Bay" className="w-7 h-7 object-contain shrink-0" />
            <div>
              <span className="text-[10px] font-medium tracking-[0.18em] text-slate-500 uppercase">
                Dock &amp; Bay
              </span>
              <h3 className="text-sm font-semibold text-slate-900 leading-tight mt-0.5">
                Booking guidelines
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <p className="text-xs text-slate-500 leading-relaxed">
            A few simple norms so the office stays comfortable, fair, and easy to share.
          </p>

          <div className="space-y-4">
            {/* Rule 1 */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-slate-600" />
              </div>
              <div className="text-xs">
                <h4 className="font-semibold text-slate-900 text-sm">
                  Book one week in advance
                </h4>
                <p className="text-slate-500 mt-1 leading-relaxed">
                  Try not to default to your usual desk every week — the rota works better when people move around.
                </p>
              </div>
            </div>

            {/* Rule 2 */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <Shuffle className="w-4 h-4 text-slate-600" />
              </div>
              <div className="text-xs">
                <h4 className="font-semibold text-slate-900 text-sm">
                  Mix it up each day
                </h4>
                <p className="text-slate-500 mt-1 leading-relaxed">
                  Pick a different desk or area each day you're in. Expand your neighbourhood.
                </p>
              </div>
            </div>

            {/* Rule 3 */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <PenTool className="w-4 h-4 text-slate-600" />
              </div>
              <div className="text-xs">
                <h4 className="font-semibold text-slate-900 text-sm">
                  Design desks have priority
                </h4>
                <p className="text-slate-500 mt-1 leading-relaxed">
                  Leave the coral-marked desks for the design team. If they're free closer to the day, anyone can take them.
                </p>
              </div>
            </div>

            {/* Rule 4 */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <Sofa className="w-4 h-4 text-slate-600" />
              </div>
              <div className="text-xs">
                <h4 className="font-semibold text-slate-900 text-sm">
                  Sofa surf when meeting-heavy
                </h4>
                <p className="text-slate-500 mt-1 leading-relaxed">
                  If most of your day is calls, pick sofa surf — it keeps formal desks free for focused work.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Got it</span>
          </button>
        </div>
      </div>
    </div>
  );
};
