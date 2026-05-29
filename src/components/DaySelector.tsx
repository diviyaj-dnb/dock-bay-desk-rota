import React from 'react';
import { DayOfWeek } from '../types';

interface DaySelectorProps {
  activeDay: DayOfWeek;
  onDayChange: (day: DayOfWeek) => void;
  bookingsByDay: Record<DayOfWeek, number>;
  datesByDay: Record<DayOfWeek, number>;
}

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const DaySelector: React.FC<DaySelectorProps> = ({
  activeDay,
  onDayChange,
  bookingsByDay,
  datesByDay,
}) => {
  return (
    <div className="flex items-center justify-center w-full">
      <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/60 relative">
        {DAYS.map((day) => {
          const isActive = day === activeDay;
          const count = bookingsByDay[day] || 0;

          return (
            <button
              key={day}
              id={`btn-day-${day.toLowerCase()}`}
              onClick={() => onDayChange(day)}
              className={`relative px-3.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200 flex flex-col items-center justify-center min-w-[70px] cursor-pointer z-10 active:scale-[0.97] ${
                isActive
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span className="leading-none">{day.slice(0, 3)}</span>
              <span
                className={`text-[9px] mt-1 px-1.5 rounded-full font-medium tabular-nums transition-colors ${
                  isActive
                    ? 'bg-[#f3705a] text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
