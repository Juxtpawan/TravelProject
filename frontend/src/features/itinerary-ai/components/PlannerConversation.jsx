import { useEffect, useRef, useState } from 'react';
import { Bot, LoaderCircle, Send, Sparkles } from 'lucide-react';

function getSuggestions(brief, destinations, tripResult, messages) {
  if (tripResult) return [];
  if (!brief?.destination) {
    const popular = destinations.filter(item => Number(item.places_count || 0) > 0).slice(0, 5).map(item => item.name).filter(Boolean);
    return popular
      .map(name => ({ label: name, message: `I’d like to plan a trip to ${name}.` }));
  }
  if (!brief?.origin && !brief?.skippedSlots?.includes('origin')) {
    return ['I’ll be starting from Delhi.', 'I’ll be starting from Mumbai.', 'Skip starting location']
      .map(message => ({ label: message.replace('I’ll be starting from ', '').replace('.', ''), message }));
  }
  const lastUserMessage = messages.filter(message => message.role === 'user').at(-1)?.content?.toLowerCase() || '';
  const needsGroupSize = ['family', 'friends'].includes(brief?.travelers?.type)
    && brief.travelers.countProvided !== true
    && Number(brief.travelers.adults || 1) <= 1;
  if ((!brief?.travelers || needsGroupSize) && !brief?.skippedSlots?.includes('travelers')) {
    if (needsGroupSize || /family|friends|friend group/.test(lastUserMessage)) {
      const group = brief?.travelers?.type || (/family/.test(lastUserMessage) ? 'family' : 'friends');
      return [1, 2, 3, 4, 5, 6].map(count => ({
        label: `${count} ${count === 1 ? 'person' : 'people'}`,
        message: `There ${count === 1 ? 'is' : 'are'} ${count} ${count === 1 ? 'person' : 'people'} in our ${group} group.`,
      }));
    }
    return [
      { label: 'Solo · 1', message: 'I’m travelling solo, 1 person.' },
      { label: 'Couple · 2', message: 'We are a couple, 2 people.' },
      { label: 'Family', message: 'We are travelling as a family.' },
      { label: 'Friends', message: 'We are travelling with friends.' },
    ];
  }
  if (!brief?.durationDays && (!brief?.startDate || !brief?.endDate) && !brief?.skippedSlots?.includes('dates')) {
    return [1, 2, 3, 4, 5, 6, 7].map(days => ({
      label: `${days} day${days === 1 ? '' : 's'}`,
      message: `I’m thinking of a ${days}-day trip. Please help me choose exact dates.`,
    }));
  }
  if (brief?.durationDays && (!brief?.startDate || !brief?.endDate) && !brief?.skippedSlots?.includes('dates')) return [];
  if (!brief?.budget && !brief?.interests?.length) {
    return ['Affordable', 'Mid-range', 'Comfortable', 'Luxury'].map(budget => ({
      label: budget,
      message: `I prefer a ${budget.toLowerCase()} budget.`,
    }));
  }
  return [
    { label: 'Nature', message: 'I’m interested in nature.' },
    { label: 'Food', message: 'I’m interested in local food.' },
    { label: 'Culture', message: 'I’m interested in culture and history.' },
    { label: 'Adventure', message: 'I’m interested in adventure.' },
    { label: 'Relaxed', message: 'I prefer a relaxed pace.' },
    { label: 'Balanced', message: 'I prefer a balanced pace.' },
    { label: 'Packed', message: 'I prefer a packed pace.' },
    { label: 'Skip for now', message: 'Skip preferences for now.' },
  ];
}

function formatTripDates(startDate, endDate) {
  if (!startDate || !endDate) return '';
  const options = { month: 'short', day: 'numeric' };
  const start = new Date(`${startDate}T00:00:00`).toLocaleDateString(undefined, options);
  const end = new Date(`${endDate}T00:00:00`).toLocaleDateString(undefined, { ...options, year: 'numeric' });
  return `${start} – ${end}`;
}

export default function PlannerConversation({ messages, isWelcome, brief, destinations = [], isLoading, isSending, isGenerating, generationStages = [], canGenerate, destinationAvailability, onGenerate, error, onSend, tripResult, onOpenTrip, onBrowseDestinations }) {
  const [draft, setDraft] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    const messageList = bottomRef.current?.parentElement;
    messageList?.scrollTo({ top: messageList.scrollHeight, behavior: 'smooth' });
  }, [messages, isSending]);

  const submit = async (event) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isSending || isGenerating) return;
    setDraft('');
    const sent = await onSend(message);
    if (!sent) setDraft(message);
  };

  const suggestions = getSuggestions(brief, destinations, tripResult, messages);
  const submitDestination = async (event) => {
    event.preventDefault();
    const destinationText = draft.trim();
    if (!destinationText || isSending || isGenerating) return;
    setDraft('');
    const sent = await onSend(`I want to plan a trip to ${destinationText}.`);
    if (!sent) setDraft(destinationText);
  };

  const submitDates = async (event) => {
    event.preventDefault();
    if (!startDate || !endDate || endDate < startDate || isSending || isGenerating) return;
    const sent = await onSend(`My trip is from ${startDate} to ${endDate}.`);
    if (sent) {
      setStartDate('');
      setEndDate('');
    }
  };

  const visibleMessages = isWelcome ? [] : messages;
  const needsExactDates = Boolean(brief?.durationDays && (!brief?.startDate || !brief?.endDate));
  const selectedDayCount = startDate && endDate
    ? Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) + 1
    : 0;

  return (
    <section className="relative z-10 flex h-full min-h-0 w-full max-w-3xl min-w-0 flex-col overflow-hidden rounded-t-2xl border-x border-t border-[#e4ebe6] bg-white shadow-[0_12px_40px_rgba(31,51,42,0.07)] sm:rounded-t-3xl">
      <div className={`app-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-1 py-5 sm:px-4 sm:py-7 ${isWelcome ? 'justify-end' : ''}`} aria-live="polite">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-text-secondary"><LoaderCircle size={17} className="animate-spin" />Opening your trip…</div>
        ) : (
          <>
            {isGenerating && (
              <section role="status" aria-live="polite" className="ml-11 max-w-lg rounded-xl border border-border-default bg-bg-subtle p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-pine"><LoaderCircle size={16} className="animate-spin" />Building your trip</p>
                <ol className="mt-3 space-y-2">
                  {generationStages.map(stage => (
                    <li key={stage.id} className="flex items-center gap-2 text-xs text-pine">
                      {stage.status === 'complete' ? <span className="text-green-ink">✓</span> : <LoaderCircle size={13} className="animate-spin" />}
                      {stage.label}
                    </li>
                  ))}
                  {!generationStages.length && <li className="text-xs text-text-secondary">Starting with your trip details…</li>}
                </ol>
              </section>
            )}
            {visibleMessages.map(message => (
              <article key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-bg-subtle text-pine"><Bot size={14} /></span>}
                <p className={`max-w-[min(88%,38rem)] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'rounded-br-md bg-green text-btn-primary-text' : 'rounded-bl-md bg-bg-subtle text-pine'}`}>
                  {message.content}
                </p>
              </article>
            ))}
            {isSending && (
              <div className="flex items-center gap-3 pl-1 text-sm text-text-secondary"><span className="grid h-8 w-8 place-items-center rounded-full bg-badge-bg text-pine"><Sparkles size={15} /></span><span>Putting your trip details together…</span></div>
            )}
            {tripResult && (
              <div className="ml-11 rounded-lg border border-border-default bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-pine">{tripResult.destination} itinerary</p>
                    <p className="mt-1 text-xs text-text-secondary">{tripResult.numDays} days · {tripResult.totalItems} stops</p>
                  </div>
                  <button type="button" onClick={onOpenTrip} className="text-xs font-bold text-pine underline underline-offset-4">Open map</button>
                </div>
                <ol className="mt-3 divide-y divide-gray">
                  {tripResult.itinerary.slice(0, 6).map(item => (
                    <li key={item.id} className="flex items-center gap-3 py-2 text-sm">
                      <span className="w-12 shrink-0 text-xs font-bold text-text-secondary">Day {item.day_index + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-pine">{item.place_name}</span>
                      <span className="shrink-0 text-xs text-text-secondary">{item.start_time}</span>
                    </li>
                  ))}
                </ol>
                {tripResult.totalItems > 6 && <p className="mt-2 text-xs text-text-secondary">And {tripResult.totalItems - 6} more stops</p>}
              </div>
            )}
            {error && <p role="alert" className="ml-11 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <div className="mx-auto w-full max-w-2xl shrink-0 bg-white/95 px-0 pb-2 pt-3 sm:px-4 sm:pb-4">
        {suggestions.length > 0 && !isLoading && (
          <div className="app-scrollbar mb-3 max-h-24 overflow-y-auto">
            <p className={`mb-2 text-xs font-semibold text-text-secondary ${isWelcome ? 'text-center' : ''}`}>{!brief?.destination ? 'A few places to start' : 'Quick choices'}</p>
            <div className={`flex flex-wrap gap-2 ${isWelcome ? 'justify-center' : ''}`}>
              {suggestions.map(({ label, message }) => (
                <button key={label} type="button" disabled={isSending || isGenerating} onClick={() => {
                  if (!brief?.destination) setDraft(label);
                  else onSend(message);
                }} className="rounded-full border border-border-strong bg-white px-3 py-2 text-left text-xs font-semibold capitalize text-pine transition hover:border-pine hover:bg-badge-bg disabled:opacity-50">
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {destinationAvailability?.status === 'unavailable' && !isLoading && <section role="alert" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-[#68531e]">
          <p className="font-bold">This destination needs more guide data</p>
          <p className="mt-1 text-xs leading-5">{destinationAvailability.message}</p>
          {onBrowseDestinations && <button type="button" onClick={onBrowseDestinations} className="mt-2 min-h-8 rounded-lg bg-white px-2.5 text-xs font-bold text-pine shadow-sm ring-1 ring-amber-200 transition hover:bg-amber-100">Browse supported guides</button>}
        </section>}
        {needsExactDates && !isLoading && !tripResult && (
          <form onSubmit={submitDates} className="mb-3 rounded-xl border border-[#d8e6db] bg-[#f7fbf8] p-3">
            <p className="text-sm font-bold text-pine">Choose your travel dates</p>
            <p className="mt-1 text-xs text-text-secondary">You mentioned {brief.durationDays} days. Exact dates make the itinerary usable.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-[#526158]">Start
                <input type="date" required value={startDate} onChange={event => setStartDate(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#cfded2] bg-white px-2 text-sm text-pine outline-none focus:border-green-medium focus:ring-2 focus:ring-green-medium/15" />
              </label>
              <label className="text-xs font-semibold text-[#526158]">End
                <input type="date" required min={startDate || undefined} value={endDate} onChange={event => setEndDate(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#cfded2] bg-white px-2 text-sm text-pine outline-none focus:border-green-medium focus:ring-2 focus:ring-green-medium/15" />
              </label>
            </div>
            {selectedDayCount > 0 && <p className="mt-2 text-xs text-[#526158]">These dates cover {selectedDayCount} {selectedDayCount === 1 ? 'day' : 'days'}{brief.durationDays && selectedDayCount !== brief.durationDays ? `, replacing the ${brief.durationDays}-day estimate.` : '.'}</p>}
            <button type="submit" disabled={!startDate || !endDate || endDate < startDate || isSending || isGenerating} className="mt-3 min-h-9 rounded-lg bg-pine px-3 text-xs font-bold text-white transition hover:bg-[#003d27] disabled:opacity-50">Use these dates</button>
          </form>
        )}
        {!tripResult && canGenerate && (
          <section aria-label="Review your trip" className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-bg-subtle px-4 py-3 xl:hidden">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-pine">{brief.destination}</p>
              <p className="mt-0.5 truncate text-xs text-text-secondary">
                {formatTripDates(brief.startDate, brief.endDate)}
                {brief.travelers ? ` · ${Number(brief.travelers.adults || 1) + (brief.travelers.childrenAges?.length || 0)} travelers` : ''}
                {brief.budget ? ` · ${brief.budget}` : ''}
              </p>
              {(brief.interests?.length || brief.pace) && <p className="mt-1 truncate text-[11px] text-text-secondary">{[brief.interests?.join(' · '), brief.pace].filter(Boolean).join(' · ')}</p>}
            </div>
            <button type="button" onClick={onGenerate} disabled={isGenerating || isSending} className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-btn-primary-bg px-4 text-xs font-bold text-btn-primary-text transition hover:bg-btn-primary-bg-hover disabled:opacity-50">
              <Sparkles size={13} />Build trip
            </button>
          </section>
        )}
        {!brief?.destination && <>
        <form onSubmit={submitDestination} className="mb-3 flex items-end gap-2 rounded-2xl border border-border-strong bg-white p-2 shadow-sm focus-within:border-pine focus-within:ring-2 focus-within:ring-pine/10">
          <label className="sr-only" htmlFor="planner-destination">Where would you like to go?</label>
          <textarea id="planner-destination" rows={2} maxLength={1000} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Tell me where you want to go, or describe the trip you have in mind…" disabled={isLoading || isSending || isGenerating} className="max-h-28 min-h-12 flex-1 resize-y bg-transparent px-2 py-2 text-sm leading-5 text-pine outline-none placeholder:text-text-secondary" />
          <button type="submit" disabled={!draft.trim() || isLoading || isSending || isGenerating} aria-label="Ask AI to plan this trip" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-btn-primary-bg text-btn-primary-text transition hover:bg-btn-primary-bg-hover disabled:opacity-40">{isSending ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={16} />}</button>
        </form>
        <p className="mb-2 text-center text-[11px] text-text-secondary">The AI will read your idea and ask for any trip details it needs.</p>
        </>}
        {brief?.destination && <>
        <label className="sr-only" htmlFor="planner-message">Message your travel planner</label>
        <form onSubmit={submit} className="flex items-end gap-2 rounded-2xl border border-border-strong bg-white p-2 shadow-sm transition focus-within:border-green-medium focus-within:ring-2 focus-within:ring-green-medium/15">
          <textarea
            id="planner-message"
            rows={2}
            maxLength={2000}
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={tripResult ? 'Ask me to adjust this itinerary…' : 'Tell me what you have in mind…'}
            disabled={isLoading || isSending || isGenerating}
            className="max-h-36 min-h-12 flex-1 resize-y bg-transparent px-2 py-2 text-sm leading-5 text-pine outline-none placeholder:text-text-secondary disabled:opacity-60"
          />
          <button type="submit" disabled={!draft.trim() || isLoading || isSending || isGenerating} aria-label="Send message" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-btn-primary-bg text-btn-primary-text transition hover:bg-btn-primary-bg-hover disabled:cursor-not-allowed disabled:opacity-40">
            {isSending ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
        <p className="mt-2 px-1 text-center text-[11px] text-text-secondary">{tripResult ? 'Ask for a change in your own words; your saved trip will update.' : 'Suggestions appear above. Exact dates are needed before generating your itinerary.'}</p>
        </>}
      </div>
    </section>
  );
}
