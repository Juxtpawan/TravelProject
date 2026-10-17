import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCompactDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatCompactRange(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const startMonth = start.toLocaleDateString(undefined, { month: 'short' });
  const endMonth = end.toLocaleDateString(undefined, { month: 'short' });
  return startMonth === endMonth
    ? `${startMonth} ${start.getDate()}–${end.getDate()}`
    : `${formatCompactDate(startDate)}–${formatCompactDate(endDate)}`;
}

/** Shared single-month date range picker. Dates use YYYY-MM-DD strings. */
export default function DateRangePicker({ startDate, endDate, onStartChange, onEndChange, compact = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isYearView, setIsYearView] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const formatIso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const chooseDate = date => {
    const value = formatIso(date);
    if (!startDate || (startDate && endDate)) {
      onStartChange(value);
      onEndChange('');
    } else if (value < startDate) {
      onStartChange(value);
    } else {
      onEndChange(value);
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!compact || !isOpen) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [compact, isOpen]);

  const tripDays = startDate && endDate
    ? Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) + 1
    : 0;
  const month = visibleMonth;
  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const todayValue = formatIso(new Date());
  const currentYear = new Date().getFullYear();
  const [yearRangeStart, setYearRangeStart] = useState(currentYear - 10);

  const calendarPanel = <div className="rounded-xl border border-[#e1e8e2] bg-white p-3 shadow-lg sm:p-4">
    <div className="mb-2 flex items-center justify-between">
      <button type="button" aria-label={isYearView ? 'Previous years' : 'Previous month'} onClick={() => isYearView ? setYearRangeStart(year => year - 20) : setVisibleMonth(date => new Date(date.getFullYear(), date.getMonth() - 1, 1))} className="grid h-8 w-8 place-items-center rounded-full text-pine hover:bg-[#f2f5f2]"><ChevronLeft size={18} /></button>
      {isYearView
        ? <span className="text-sm font-bold text-pine">Choose a year</span>
        : <button type="button" onClick={() => { setYearRangeStart(month.getFullYear() - 10); setIsYearView(true); }} aria-label="Choose year" className="rounded px-2 py-1 text-sm font-bold text-pine hover:bg-[#f2f5f2] focus:outline-none focus:ring-2 focus:ring-green-medium/20">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</button>}
      <button type="button" aria-label={isYearView ? 'Next years' : 'Next month'} onClick={() => isYearView ? setYearRangeStart(year => year + 20) : setVisibleMonth(date => new Date(date.getFullYear(), date.getMonth() + 1, 1))} className="grid h-8 w-8 place-items-center rounded-full text-pine hover:bg-[#f2f5f2]"><ChevronRight size={18} /></button>
    </div>
    {isYearView ? <div className="grid max-h-60 grid-cols-4 gap-2 overflow-y-auto py-1">
      {Array.from({ length: 20 }, (_, index) => yearRangeStart + index).map(year => <button key={year} type="button" aria-pressed={year === month.getFullYear()} onClick={() => { setVisibleMonth(date => new Date(year, date.getMonth(), 1)); setIsYearView(false); }} className={`rounded-lg px-2 py-2.5 text-sm transition ${year === month.getFullYear() ? 'bg-pine font-bold text-white' : 'text-[#35433d] hover:bg-[#f2f5f2]'}`}>{year}</button>)}
    </div> : <>
      <p className="mb-1 text-center text-[11px] text-[#66736b]">{startDate && !endDate ? 'Choose the last day' : 'Choose the first day'}</p>
      <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase text-[#89958d]">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <span key={day} className="py-1">{day}</span>)}</div>
      <div className="grid grid-cols-7">
        {Array.from({ length: firstWeekday }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const date = new Date(month.getFullYear(), month.getMonth(), day);
          const value = formatIso(date);
          const selected = value === startDate || value === endDate;
          const inRange = startDate && endDate && value > startDate && value < endDate;
          const isToday = value === todayValue;
          return <button key={value} type="button" aria-label={date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} aria-pressed={selected} onClick={() => chooseDate(date)} className={`mx-auto grid h-9 w-9 place-items-center rounded-full text-xs transition ${selected ? 'bg-pine font-bold text-white' : inRange ? 'rounded-none bg-[#e8f1ea] text-pine' : isToday ? 'border border-green-medium font-bold text-pine' : 'text-[#35433d] hover:bg-[#f2f5f2]'}`}>{day}</button>;
        })}
      </div>
    </>}
    <button type="button" onClick={() => setIsOpen(false)} className="mt-2 w-full rounded-md py-2 text-xs font-bold text-[#66736b] hover:bg-[#f2f5f2]">Close calendar</button>
  </div>;

  return <div>
    <button type="button" onClick={() => setIsOpen(true)} aria-label="Choose trip dates" aria-expanded={isOpen} className={`flex items-center justify-between gap-2 text-left transition focus:outline-none focus:ring-2 focus:ring-green-medium/20 ${compact ? 'min-h-9 w-auto min-w-[128px] max-w-[230px] rounded-full border border-white/25 bg-white/5 px-2.5 py-1 text-white hover:bg-white/10 sm:min-h-10' : 'min-h-12 w-full gap-3 rounded-md border border-[#d6dfd8] px-3 py-2 hover:border-green-medium'}`}>
      <span className="min-w-0"><span className={`block truncate font-semibold ${compact ? 'text-xs text-white sm:text-sm' : 'text-sm text-pine'}`}>{startDate && endDate ? compact ? `${tripDays} ${tripDays === 1 ? 'day' : 'days'} · ${formatCompactRange(startDate, endDate)}` : `${formatDate(startDate)} – ${formatDate(endDate)}` : compact ? 'Trip dates' : 'Choose dates'}</span>{tripDays > 0 && !compact && <span className="block text-[11px] text-[#66736b]">{tripDays} {tripDays === 1 ? 'day' : 'days'}</span>}</span><CalendarDays size={compact ? 15 : 17} className={`shrink-0 ${compact ? 'text-amber-200' : 'text-[#75847b]'}`} />
    </button>
    {isOpen && (compact ? createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4" role="presentation" onClick={() => setIsOpen(false)}>
        <div role="dialog" aria-modal="true" aria-label="Choose trip dates" onClick={event => event.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-1 shadow-2xl">{calendarPanel}</div>
      </div>, document.body
    ) : <div className="mt-2 sm:max-w-sm">{calendarPanel}</div>)}
  </div>;
}
