import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, BusFront, CarFront, Check, Hotel, LoaderCircle, Plane, Plus, TrainFront, Trash2, X } from 'lucide-react';
import DateRangePicker from '../../shared/components/date-range-picker/DateRangePicker';

const fieldClass = 'mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-pine outline-none focus:border-green-medium focus:ring-2 focus:ring-green-medium/15';
const compactFieldClass = 'h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-pine outline-none focus:border-green-medium focus:ring-2 focus:ring-green-medium/15';
const textareaClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-pine outline-none placeholder:text-[#7b8980] focus:border-green-medium focus:ring-2 focus:ring-green-medium/15';
const arrivalFieldNames = [
  'arrival_name', 'arrival_number', 'arrival_from', 'arrival_to', 'arrival_confirmation',
  'arrival_departure_date', 'arrival_departure_time', 'arrival_arrival_date', 'arrival_arrival_time',
  'arrival_cost', 'arrival_notes',
];
const arrivalModeFields = [...arrivalFieldNames, 'arrival_currency'];
const modes = [
  { label: 'Flight', icon: Plane },
  { label: 'Train', icon: TrainFront },
  { label: 'Bus', icon: BusFront },
];

function makeModeDraft(mode, values = {}) {
  return {
    arrival_mode: mode,
    ...Object.fromEntries(arrivalModeFields.map(field => [field, values[field] || (field === 'arrival_currency' ? 'INR' : '')])),
  };
}

function parseModeDrafts(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function makeDraft(details) {
  const mode = details.arrival_mode || 'Flight';
  return makeModeDraft(mode, { ...parseModeDrafts(details.arrival_transport_options)[mode], ...details, arrival_notes: details.arrival_notes || details.arrival_details || '' });
}

function hasArrivalDetails(details) {
  return Boolean(details.arrival_mode || details.arrival_details || details.arrival_transport_options || arrivalFieldNames.some(field => details[field]));
}

function parseEntryList(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function formatTravelDay(value) {
  if (!value) return 'Date TBD';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(value) {
  if (!value) return '';
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatCost(details) {
  if (!details.arrival_cost) return '';
  const amount = Number(details.arrival_cost);
  if (!Number.isFinite(amount)) return `${details.arrival_currency || 'INR'} ${details.arrival_cost}`;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: details.arrival_currency || 'INR', maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${details.arrival_currency || 'INR'} ${amount.toFixed(2)}`;
  }
}

function DateField({ label, value, onChange }) {
  return <DateRangePicker selectionMode="single" selectedDate={value} onDateChange={onChange} dateLabel={label} emptyLabel="Date" compact fullWidth />;
}

function PlaceholderField({ label, placeholder, value, onChange }) {
  return <input type="text" value={value} onChange={event => onChange(event.target.value.replace(/[^\p{L}\s]/gu, ''))} aria-label={label} placeholder={placeholder} maxLength={200} className={compactFieldClass} />;
}

function formatTimeEntry(value) {
  const input = value.slice(0, 8);
  const colonIndex = input.indexOf(':');
  if (colonIndex >= 0) {
    let hours = input.slice(0, colonIndex).replace(/\D/g, '').slice(0, 2);
    const minutes = input.slice(colonIndex + 1).replace(/\D/g, '').slice(0, 2);
    if (hours.length === 1 && minutes.length) hours = hours.padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  const digits = input.replace(/\D/g, '').slice(0, 4);
  return digits.length > 1 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

function TimeField({ label, value, onChange }) {
  return <input type="text" value={value} onChange={event => onChange(formatTimeEntry(event.target.value))} aria-label={label} placeholder="HH:MM" inputMode="numeric" maxLength={5} className={`${compactFieldClass} px-1.5 text-center tabular-nums`} />;
}

function Field({ label, value, onChange, placeholder, maxLength = 200, type = 'text', className = compactFieldClass, lettersOnly = false, ...props }) {
  return <label className="block text-xs font-bold text-text-secondary">{label}
    <input type={type} value={value} onChange={event => onChange(lettersOnly ? event.target.value.replace(/[^\p{L}\s]/gu, '') : event.target.value)} placeholder={placeholder} maxLength={maxLength} className={`mt-1 ${className}`} {...props} />
  </label>;
}

function CostField({ value, currency, onCostChange, onCurrencyChange }) {
  return <label className="block text-xs font-bold text-text-secondary">Cost
    <span className="mt-1 flex">
      <input type="number" min="0" step="0.01" value={value} onChange={event => onCostChange(event.target.value)} placeholder="0.00" className={`${compactFieldClass} min-w-0 flex-1 rounded-r-none`} />
      <select value={currency} onChange={event => onCurrencyChange(event.target.value)} aria-label="Cost currency" style={{ flex: '0 0 5.5rem' }} className={`${compactFieldClass} shrink-0 rounded-l-none border-l-0 px-1.5`}><option value="INR">INR</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="CAD">CAD</option><option value="AUD">AUD</option><option value="JPY">JPY</option></select>
    </span>
  </label>;
}

function AutoGrowTextarea({ value, onChange }) {
  const textareaRef = useRef(null);
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return <textarea ref={textareaRef} value={value} onChange={event => onChange(event.target.value)} maxLength={2000} rows={2} placeholder="Add extra details here" className={`${textareaClass} resize-none overflow-hidden`} />;
}

function AddAnotherDivider({ onClick, label = 'Add another' }) {
  return <div className="flex items-center gap-2 py-1.5" aria-label={label}>
    <span className="h-px flex-1 bg-[#dce3e5]" />
    <button type="button" onClick={onClick} aria-label={label} className="group flex h-8 items-center overflow-hidden rounded-full bg-[#f3f7f4] text-pine shadow-sm transition hover:bg-[#e8efea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium">
      <span className="grid h-8 w-8 shrink-0 place-items-center"><Plus size={16} strokeWidth={3}/></span>
      <span className="max-w-0 overflow-hidden whitespace-nowrap pr-0 text-xs font-semibold opacity-0 transition-all group-hover:max-w-24 group-hover:pr-3 group-hover:opacity-100 group-focus-visible:max-w-24 group-focus-visible:pr-3 group-focus-visible:opacity-100">{label}</span>
    </button>
    <span className="h-px flex-1 bg-[#dce3e5]" />
  </div>;
}

function ArrivalEntryCard({ details, onSave, onDelete, onCancelNew }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isChoosingMode, setIsChoosingMode] = useState(() => Boolean(details._startChoosing));
  const [isDeleting, setIsDeleting] = useState(false);
  const [draft, setDraft] = useState(() => makeDraft(details));
  const [status, setStatus] = useState('');
  const cardRef = useRef(null);
  const draftRef = useRef(draft);
  const initialDraftRef = useRef(draft);
  const modeDraftsRef = useRef(parseModeDrafts(details.arrival_transport_options));
  const isEditingRef = useRef(false);
  const savingRef = useRef(false);
  const saved = hasArrivalDetails(details);

  const beginEditing = selectedMode => {
    const modeDrafts = parseModeDrafts(details.arrival_transport_options);
    const existingDraft = makeDraft(details);
    if (arrivalFieldNames.some(field => existingDraft[field]) || details.arrival_mode) {
      modeDrafts[existingDraft.arrival_mode] = Object.fromEntries(arrivalModeFields.map(field => [field, existingDraft[field]]));
    }
    const initialDraft = selectedMode ? makeModeDraft(selectedMode, modeDrafts[selectedMode]) : existingDraft;
    modeDraftsRef.current = modeDrafts;
    draftRef.current = initialDraft;
    initialDraftRef.current = initialDraft;
    setDraft(initialDraft);
    setStatus('');
    setIsDeleting(false);
    setIsChoosingMode(false);
    isEditingRef.current = true;
    setIsEditing(true);
  };

  const updateDraft = (field, value) => {
    setDraft(current => {
      const next = { ...current, [field]: value };
      draftRef.current = next;
      return next;
    });
    setStatus('');
  };

  const saveDraft = async () => {
    if (!isEditingRef.current || savingRef.current) return;
    const currentDraft = draftRef.current;
    if (JSON.stringify(currentDraft) === JSON.stringify(initialDraftRef.current)) {
      isEditingRef.current = false;
      setIsEditing(false);
      setStatus('');
      return;
    }
    if (!arrivalFieldNames.some(field => String(currentDraft[field] || '').trim()) && !details.arrival_details) {
      setStatus('Add at least one travel detail before saving.');
      return;
    }
    if ([currentDraft.arrival_departure_time, currentDraft.arrival_arrival_time].some(time => time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
      setStatus('Enter times as HH:MM using the 24-hour clock.');
      return;
    }
    if (currentDraft.arrival_departure_date && currentDraft.arrival_arrival_date && currentDraft.arrival_arrival_date < currentDraft.arrival_departure_date) {
      setStatus('Arrival date must be on or after the departure date.');
      return;
    }
    savingRef.current = true;
    setStatus('saving');
    try {
      const modeDrafts = { ...modeDraftsRef.current, [currentDraft.arrival_mode]: Object.fromEntries(arrivalModeFields.map(field => [field, currentDraft[field]])) };
      await onSave({ ...currentDraft, arrival_details: details.arrival_details || '', arrival_status: '', arrival_transport_options: JSON.stringify(modeDrafts) });
      initialDraftRef.current = currentDraft;
      isEditingRef.current = false;
      setIsEditing(false);
      setStatus('');
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Travel details could not be saved. Try again.');
    } finally {
      savingRef.current = false;
    }
  };

  const saveDraftRef = useRef(saveDraft);
  saveDraftRef.current = saveDraft;

  useEffect(() => {
    if (!isEditing) return undefined;
    const handleOutsidePointerDown = event => {
      const target = event.target;
      if (cardRef.current?.contains(target) || target?.closest?.('[data-autosave-ignore]')) return;
      void saveDraftRef.current();
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [isEditing]);

  const save = event => {
    event.preventDefault();
    void saveDraft();
  };

  const deleteDetails = async () => {
    setStatus('deleting');
    try {
      await onDelete();
      setIsDeleting(false);
      isEditingRef.current = false;
      setIsEditing(false);
      setStatus('');
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Travel details could not be deleted. Try again.');
      setIsDeleting(false);
    }
  };

  if (isEditing) return <form ref={cardRef} onSubmit={save} className="@container rounded-xl border border-[#d7e5da] bg-white p-1.5 shadow-sm sm:p-2">
    <fieldset disabled={status === 'saving'} className="m-0 min-w-0 border-0 p-0">
    <div className="grid grid-cols-1 gap-1.5 @sm:grid-cols-2">
      <Field lettersOnly className={compactFieldClass} label={draft.arrival_mode === 'Flight' ? 'Airline' : draft.arrival_mode === 'Train' ? 'Rail operator' : 'Bus operator'} value={draft.arrival_name} onChange={value => updateDraft('arrival_name', value)} placeholder={draft.arrival_mode === 'Flight' ? 'e.g. AirAsia' : draft.arrival_mode === 'Train' ? 'e.g. Indian Railways' : 'e.g. Volvo'} />
      <Field className={compactFieldClass} label={draft.arrival_mode === 'Flight' ? 'Flight number' : draft.arrival_mode === 'Train' ? 'Train name or number' : 'Bus name or number'} value={draft.arrival_number} onChange={value => updateDraft('arrival_number', value)} placeholder={draft.arrival_mode === 'Flight' ? 'e.g. AK 23' : draft.arrival_mode === 'Train' ? 'e.g. 12951' : 'Route or service number'} />
    </div>

    <div className="mt-1.5 grid grid-cols-1 gap-1.5 @md:grid-cols-2">
      <section className="min-w-0 rounded-lg border border-[#edf1ee] bg-[#fafcfa] p-1.5">
        <h3 className="mb-1 text-xs font-bold text-pine">From</h3>
        <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-stretch gap-1.5">
          <DateField label="Departure date" value={draft.arrival_departure_date} onChange={value => updateDraft('arrival_departure_date', value)} />
          <TimeField label="Departure time" value={draft.arrival_departure_time} onChange={value => updateDraft('arrival_departure_time', value)} />
          <div className="col-span-2"><PlaceholderField label={draft.arrival_mode === 'Flight' ? 'Departure airport name' : draft.arrival_mode === 'Train' ? 'Departure station name' : 'Departure bus stop'} placeholder={draft.arrival_mode === 'Flight' ? 'Departure airport' : draft.arrival_mode === 'Train' ? 'Departure station' : 'Departure stop'} value={draft.arrival_from} onChange={value => updateDraft('arrival_from', value)} /></div>
        </div>
      </section>
      <section className="min-w-0 rounded-lg border border-[#edf1ee] bg-[#fafcfa] p-1.5">
        <h3 className="mb-1 text-xs font-bold text-pine">To</h3>
        <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-stretch gap-1.5">
          <DateField label="Arrival date" value={draft.arrival_arrival_date} onChange={value => updateDraft('arrival_arrival_date', value)} />
          <TimeField label="Arrival time" value={draft.arrival_arrival_time} onChange={value => updateDraft('arrival_arrival_time', value)} />
          <div className="col-span-2"><PlaceholderField label={draft.arrival_mode === 'Flight' ? 'Arrival airport name' : draft.arrival_mode === 'Train' ? 'Arrival station name' : 'Arrival bus stop'} placeholder={draft.arrival_mode === 'Flight' ? 'Arrival airport' : draft.arrival_mode === 'Train' ? 'Arrival station' : 'Arrival stop'} value={draft.arrival_to} onChange={value => updateDraft('arrival_to', value)} /></div>
        </div>
      </section>
    </div>

    <div className="mt-1.5 grid grid-cols-1 gap-1.5 border-t border-[#edf1ee] pt-1.5 @sm:grid-cols-2">
      <Field className={compactFieldClass} label="Confirmation #" value={draft.arrival_confirmation} onChange={value => updateDraft('arrival_confirmation', value)} placeholder="Booking reference" />
      <CostField value={draft.arrival_cost} currency={draft.arrival_currency} onCostChange={value => updateDraft('arrival_cost', value)} onCurrencyChange={value => updateDraft('arrival_currency', value)} />
      <label className="block text-xs font-bold text-text-secondary @sm:col-span-2">Notes
        <AutoGrowTextarea value={draft.arrival_notes} onChange={value => updateDraft('arrival_notes', value)} />
      </label>
    </div>
    </fieldset>

    {status === 'saving' && <p role="status" className="mt-2 text-xs font-medium text-[#66736b]">Saving travel details…</p>}
    {status && status !== 'saving' && <p role="alert" className="mt-2 text-xs font-semibold text-[#a13a31]">{status}</p>}
    {isDeleting && <div className="mt-2 rounded-lg bg-[#fff5f3] p-2.5"><p className="text-xs font-semibold text-[#7d2f28]">Delete these travel details?</p><div className="mt-2 flex justify-end gap-2"><button type="button" onClick={() => setIsDeleting(false)} disabled={status === 'deleting'} className="min-h-8 rounded-md px-2.5 text-xs font-bold text-[#6d554f] hover:bg-white">Keep</button><button type="button" onClick={deleteDetails} disabled={status === 'deleting'} className="inline-flex min-h-8 items-center gap-1 rounded-md bg-[#a13a31] px-2.5 text-xs font-bold text-white hover:bg-[#842e27] disabled:opacity-60">{status === 'deleting' && <LoaderCircle size={13} className="animate-spin" />}Delete</button></div></div>}
    <div className="mt-2.5 flex items-center justify-between border-t border-[#edf1ee] pt-2">
      {saved ? <button type="button" onClick={() => { setStatus(''); setIsDeleting(true); }} disabled={status === 'saving'} className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-bold text-[#8c4a43] transition hover:bg-[#fff1ef] disabled:opacity-50"><Trash2 size={13} />Delete</button> : <span />}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => { isEditingRef.current = false; setDraft(initialDraftRef.current); draftRef.current = initialDraftRef.current; setStatus(''); setIsDeleting(false); setIsEditing(false); }} disabled={status === 'saving' || status === 'deleting'} className="inline-flex min-h-8 items-center rounded-lg border border-[#d7e5da] bg-white px-3 text-xs font-bold text-pine transition hover:bg-[#f3f7f4] disabled:opacity-60">Cancel</button>
        <button type="submit" disabled={status === 'saving' || status === 'deleting'} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-pine px-3 text-xs font-bold text-white transition hover:bg-[#003d27] disabled:opacity-60">{status === 'saving' ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}{status === 'saving' ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  </form>;

  const mode = details.arrival_mode || 'Flight';
  const service = [details.arrival_name || details.arrival_details, details.arrival_number].filter(Boolean).join(' ');
  const departureTime = formatTime(details.arrival_departure_time) || '—';
  const arrivalTime = formatTime(details.arrival_arrival_time) || '—';
  const cost = formatCost(details);
  const departureDate = formatTravelDay(details.arrival_departure_date);
  const arrivalDate = formatTravelDay(details.arrival_arrival_date);

  if (isChoosingMode) return <div className="rounded-xl border border-dashed border-[#a9cbb0] bg-[#f8fbf8] p-2.5 sm:p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-pine">Choose arrival transport</p><button type="button" onClick={() => { setIsChoosingMode(false); onCancelNew?.(); }} className="rounded-md px-2 py-1 text-xs font-semibold text-[#66736b] hover:bg-white">Cancel</button></div><div className="mt-2 grid grid-cols-3 gap-1.5">{modes.map(({ label, icon: Icon }) => <button key={label} type="button" onClick={() => beginEditing(label)} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#d7e5da] bg-white px-2 text-xs font-bold text-pine transition hover:border-green-medium hover:bg-[#f0f7f1]"><Icon size={15} />{label}</button>)}</div></div>;

  if (!saved) return <button type="button" onClick={() => setIsChoosingMode(true)} className="flex min-h-24 w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#a9cbb0] bg-[#f8fbf8] px-4 py-4 text-center transition hover:border-green-medium hover:bg-[#f0f7f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium"><span className="grid h-8 w-8 place-items-center rounded-full bg-white text-green-ink shadow-sm"><Plus size={18} /></span><span className="mt-1.5 text-sm font-bold text-pine">Add arrival details</span><span className="mt-0.5 text-xs text-[#66736b]">Flight, train, or bus</span></button>;

  return <div><button ref={cardRef} type="button" onClick={beginEditing} aria-label={`Open ${mode.toLowerCase()} arrival details to edit`} className="@container block w-full rounded-xl border border-[#dce3e5] bg-[#f7f8f8] p-3 text-left shadow-sm transition hover:border-[#c5d2d5] hover:bg-[#f3f5f5] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium sm:p-4">
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 rounded-full bg-[#e8efea] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-pine">{mode}</span>
        {service && <span className="truncate text-sm font-semibold text-pine">{service}</span>}
      </div>
      {(details.arrival_confirmation || cost) && <div className="hidden shrink-0 items-center gap-2 text-xs text-[#526158] @md:flex">
        {details.arrival_confirmation && <span className="rounded-md bg-white px-2 py-1">Ref <strong className="font-semibold text-pine">{details.arrival_confirmation}</strong></span>}
        {cost && <span className="rounded-md bg-white px-2 py-1 font-semibold text-pine">{cost}</span>}
      </div>}
    </div>
    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:mt-4 sm:gap-3">
      <div className="min-w-0"><p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#77847c]">From</p><p className="truncate text-base font-bold leading-tight text-pine sm:text-lg">{details.arrival_from || 'TBD'}</p></div>
      <ArrowRight size={18} className="text-[#89958d]" aria-hidden="true" />
      <div className="min-w-0 text-right"><p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#77847c]">To</p><p className="truncate text-base font-bold leading-tight text-pine sm:text-lg">{details.arrival_to || 'TBD'}</p></div>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-white/80 px-2.5 py-2 sm:mt-4 sm:px-3">
      <div className="min-w-0 border-r border-[#e7ece8] pr-2"><p className="text-[10px] font-bold uppercase tracking-wide text-[#77847c]">Depart</p><p className="mt-0.5 truncate text-xs font-semibold text-pine sm:text-sm">{departureDate}<span className="mx-1 text-[#a0aaa3]">·</span>{departureTime}</p></div>
      <div className="min-w-0 pl-1"><p className="text-[10px] font-bold uppercase tracking-wide text-[#77847c]">Arrive</p><p className="mt-0.5 truncate text-xs font-semibold text-pine sm:text-sm">{arrivalDate}<span className="mx-1 text-[#a0aaa3]">·</span>{arrivalTime}</p></div>
    </div>
    {(details.arrival_confirmation || cost) && <div className="mt-2 flex flex-wrap gap-1.5 @md:hidden">
      {details.arrival_confirmation && <span className="rounded-md bg-white px-2 py-1 text-[11px] text-[#526158]">Ref <strong className="font-semibold text-pine">{details.arrival_confirmation}</strong></span>}
      {cost && <span className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-pine">{cost}</span>}
    </div>}
    {(details.arrival_notes || (!details.arrival_notes && details.arrival_details)) && <p className="mt-2 line-clamp-2 border-t border-[#e2e8e9] pt-2 text-xs leading-5 text-[#526158]">{details.arrival_notes || details.arrival_details}</p>}
  </button>
  </div>;
}

function ArrivalCard({ details, onSave }) {
  const saved = parseEntryList(details.arrival_items);
  const items = saved.length ? saved : hasArrivalDetails(details) ? [Object.fromEntries(Object.keys(details).filter(key => key.startsWith('arrival_')).map(key => [key, details[key]]))] : [];
  const [adding, setAdding] = useState(false);
  const writeItems = async next => {
    const first = next[0] || {};
    const legacy = Object.fromEntries(Object.keys(details).filter(key => key.startsWith('arrival_')).map(key => [key, first[key] || (key === 'arrival_currency' ? 'INR' : '')]));
    await onSave({ ...legacy, arrival_items: JSON.stringify(next) });
  };
  const saveItem = async (index, item) => { const next = [...items]; if (index < 0) next.push({ ...item, id: crypto.randomUUID() }); else next[index] = { ...item, id: next[index].id }; await writeItems(next); setAdding(false); };
  return <div className="space-y-2">{items.map((item, index) => <ArrivalEntryCard key={item.id || index} details={item} onSave={value => saveItem(index, value)} onDelete={async () => writeItems(items.filter((_, i) => i !== index))} />)}{adding ? <ArrivalEntryCard key="new-arrival" details={{ _startChoosing: true }} onSave={value => saveItem(-1, value)} onDelete={() => {}} onCancelNew={() => setAdding(false)} /> : <AddAnotherDivider onClick={() => setAdding(true)} />}</div>;
}

function TransferEntryCard({ details, onSave, onDelete, onCancelNew }) {
  const [editing, setEditing] = useState(false);
  const [choosingMode, setChoosingMode] = useState(() => Boolean(details._startChoosing));
  const [draft, setDraft] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fields = ['transfer_mode', 'transfer_from', 'transfer_to', 'transfer_notes'];
  const begin = mode => { setDraft(Object.fromEntries(fields.map(field => [field, field === 'transfer_mode' && mode ? mode : details[field] || '']))); setChoosingMode(false); setEditing(true); };
  const update = (field, value) => setDraft(current => ({ ...current, [field]: value }));
  const save = async event => {
    event.preventDefault();
    if (!draft.transfer_mode) return;
    await onSave(Object.fromEntries(fields.map(field => [field, draft[field] || ''])));
    setEditing(false);
  };
  if (choosingMode && !editing) return <div className="rounded-xl border border-dashed border-[#a9cbb0] bg-[#f8fbf8] p-2.5 sm:p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-pine">Choose transport</p><button type="button" onClick={() => { setChoosingMode(false); onCancelNew?.(); }} className="rounded-md px-2 py-1 text-xs font-semibold text-[#66736b] hover:bg-white">Cancel</button></div><div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">{['Taxi or rideshare', 'Public transport', 'Rental car', 'Bike or scooter', 'Private transfer', 'Other'].map(mode => <button key={mode} type="button" onClick={() => begin(mode)} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[#d7e5da] bg-white px-2 text-xs font-bold text-pine transition hover:border-green-medium hover:bg-[#f0f7f1]">{mode}</button>)}</div></div>;
  if (editing) return <form onSubmit={save} className="@container rounded-xl border border-[#d7e5da] bg-white p-1.5 shadow-sm sm:p-2">
    <div className="grid grid-cols-1 gap-1.5 @sm:grid-cols-2">
      <Field className={compactFieldClass} label="From" value={draft.transfer_from} onChange={value => update('transfer_from', value)} placeholder="Pickup location" />
      <Field className={compactFieldClass} label="To" value={draft.transfer_to} onChange={value => update('transfer_to', value)} placeholder="Destination" />
      <Field className={compactFieldClass} label="Notes (optional)" value={draft.transfer_notes} onChange={value => update('transfer_notes', value)} placeholder="Anything to remember" />
    </div>
    {confirmDelete && <div className="mt-2 rounded-lg bg-[#fff5f3] p-2.5"><p className="text-xs font-semibold text-[#7d2f28]">Delete these transfer details?</p><div className="mt-2 flex justify-end gap-2"><button type="button" onClick={() => setConfirmDelete(false)} className="min-h-8 rounded-md px-2.5 text-xs font-bold text-[#6d554f] hover:bg-white">Keep</button><button type="button" disabled={deleting} onClick={async () => { setDeleting(true); try { await onDelete(); setEditing(false); } finally { setDeleting(false); } }} className="inline-flex min-h-8 items-center gap-1 rounded-md bg-[#a13a31] px-2.5 text-xs font-bold text-white disabled:opacity-60">{deleting && <LoaderCircle size={13} className="animate-spin"/>}Delete</button></div></div>}
    <div className="mt-2.5 flex items-center justify-between border-t border-[#edf1ee] pt-2"><button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-bold text-[#8c4a43] transition hover:bg-[#fff1ef]"><Trash2 size={13}/>Delete</button><div className="flex gap-2"><button type="button" onClick={() => setEditing(false)} className="inline-flex min-h-8 items-center rounded-lg border border-[#d7e5da] bg-white px-3 text-xs font-bold text-pine">Cancel</button><button type="submit" className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-pine px-3 text-xs font-bold text-white"><Check size={13}/>Save</button></div></div>
  </form>;
  return <button type="button" onClick={() => begin()} aria-label="Open transfer details to edit" className="@container block w-full rounded-xl border border-[#dce3e5] bg-[#f7f8f8] p-3 text-left shadow-sm transition hover:border-[#c5d2d5] hover:bg-[#f3f5f5] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium sm:p-4"><div className="flex min-w-0 items-center gap-2"><span className="shrink-0 rounded-full bg-[#e8efea] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-pine">{details.transfer_mode}</span></div><div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:mt-4 sm:gap-3"><div className="min-w-0"><p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#77847c]">From</p><p className="truncate text-base font-bold leading-tight text-pine sm:text-lg">{details.transfer_from || 'TBD'}</p></div><ArrowRight size={18} className="text-[#89958d]"/><div className="min-w-0 text-right"><p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#77847c]">To</p><p className="truncate text-base font-bold leading-tight text-pine sm:text-lg">{details.transfer_to || 'TBD'}</p></div></div>{details.transfer_notes && <p className="mt-2 line-clamp-2 border-t border-[#e2e8e9] pt-2 text-xs leading-5 text-[#526158]">{details.transfer_notes}</p>}</button>;
}

function TransferCard({ details, onChange }) {
  const saved = parseEntryList(details.transfer_items);
  const items = saved.length ? saved : details.transfer_mode ? [{ transfer_mode: details.transfer_mode, transfer_from: details.transfer_from, transfer_to: details.transfer_to, transfer_notes: details.transfer_notes }] : [];
  const [adding, setAdding] = useState(false);
  const update = async next => { onChange('transfer_items', JSON.stringify(next)); onChange('transfer_mode', next[0]?.transfer_mode || ''); onChange('transfer_from', next[0]?.transfer_from || ''); onChange('transfer_to', next[0]?.transfer_to || ''); onChange('transfer_notes', next[0]?.transfer_notes || ''); };
  const saveItem = async (index, item) => { const next = [...items]; if (index < 0) next.push({ ...item, id: crypto.randomUUID() }); else next[index] = { ...next[index], ...item }; await update(next); setAdding(false); };
  return <div className="space-y-2">{items.map((item, index) => <div key={item.id || index}><TransferEntryCard details={item} onSave={value => saveItem(index, value)} onDelete={async () => update(items.filter((_, i) => i !== index))} /></div>)}{adding ? <TransferEntryCard key="new-transfer" details={{ _startChoosing: true }} onSave={value => saveItem(-1, value)} onDelete={() => {}} onCancelNew={() => setAdding(false)} /> : <AddAnotherDivider onClick={() => setAdding(true)} />}</div>;
}

export default function TripLogisticsPanel({ section, details, onChange, saveStatus = 'idle', onSaveArrival, onDeleteArrival, onDeleteTransfer }) {
  const sectionConfig = ['arrive', 'transfer', 'stay'].includes(section);

  if (section === 'essentials') {
    const summary = [
      details.arrival_mode && `Arriving by ${details.arrival_mode.toLowerCase()}`,
      details.local_transport && `Getting around by ${details.local_transport.toLowerCase()}`,
      details.stay_name && `Staying at ${details.stay_name}`,
    ].filter(Boolean);
    return <div>
      <p className="text-sm text-text-secondary">A quick overview of your arrival, local transport, and stay.</p>
      {summary.length ? <ul className="mt-2 space-y-1 text-sm text-pine">{summary.map(item => <li key={item}>{item}</li>)}</ul> : <p className="mt-2 text-sm text-text-secondary">Add your travel details in Arrive, Transfer, and Stay.</p>}
    </div>;
  }

  if (!sectionConfig) return null;
  return <div className="space-y-3">
    {section === 'arrive' && <ArrivalCard details={details} onSave={onSaveArrival} onDelete={onDeleteArrival} />}
    {section === 'transfer' && <TransferCard details={details} onChange={onChange} onDelete={onDeleteTransfer} />}
    {section === 'stay' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="text-xs font-bold text-text-secondary"><span className="flex items-center gap-1.5 text-pine"><Hotel size={13} />Where are you staying?</span><input value={details.stay_name} onChange={event => onChange('stay_name', event.target.value)} maxLength={300} placeholder="Hotel or accommodation" className={fieldClass} /></label>
      <label className="text-xs font-bold text-text-secondary">Stay details<input value={details.stay_details} onChange={event => onChange('stay_details', event.target.value)} maxLength={300} placeholder="Address, check-in, or booking notes" className={fieldClass} /></label>
    </div>}
    {section === 'stay' && <p role="status" aria-live="polite" className="min-h-4 text-xs text-text-secondary">
      {saveStatus === 'editing' && 'Changes save automatically.'}
      {saveStatus === 'saving' && 'Saving details…'}
    </p>}
  </div>;
}
