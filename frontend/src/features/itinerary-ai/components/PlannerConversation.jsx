import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Bot, LoaderCircle, MapPin, Search, Send, Sparkles } from 'lucide-react';
import { autocompleteDestinations, getDestinationPlaceDetails, resolveDestination, startDestinationDiscovery } from '../../places/api/placesApi';

function getSuggestions(brief, destinations, tripResult, messages) {
  if (tripResult) return [];
  if (!brief?.destination) {
    const popular = destinations.slice(0, 5).map(item => item.name).filter(Boolean);
    return (popular.length ? popular : ['Goa', 'Manali', 'Jaipur', 'Kerala', 'Dubai'])
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

export default function PlannerConversation({ messages, isWelcome, brief, destinations = [], isLoading, isSending, isGenerating, generationStages = [], canGenerate, onGenerate, error, onSend, tripResult, onOpenTrip }) {
  const [draft, setDraft] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [placeSuggestions, setPlaceSuggestions] = useState([]);
  const [usingSavedDestinations, setUsingSavedDestinations] = useState(false);
  const [isResolvingDestination, setIsResolvingDestination] = useState(false);
  const [destinationError, setDestinationError] = useState('');
  const placesSession = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (destinationQuery.trim().length < 2 || brief?.destination) return undefined;
    let active = true;
    const timeoutId = window.setTimeout(async () => {
      try {
        placesSession.current ||= crypto.randomUUID();
        const result = await autocompleteDestinations(destinationQuery.trim(), placesSession.current);
        if (active) {
          setPlaceSuggestions(result.suggestions || []);
          setUsingSavedDestinations(Boolean(result.mapsUnavailable));
        }
      } catch {
        if (active) {
          setPlaceSuggestions([]);
          setUsingSavedDestinations(false);
        }
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timeoutId); };
  }, [destinationQuery, brief?.destination]);

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
  const chooseDestination = async (selection) => {
    if (!selection?.placeId) return;
    setIsResolvingDestination(true);
    setDestinationError('');
    try {
      const place = await getDestinationPlaceDetails(selection.placeId, placesSession.current);
      const name = place.name || selection.mainText || destinationQuery.trim();
      const destination = await resolveDestination(name, place.placeId || selection.placeId, place.location || undefined);
      placesSession.current = null;
      setDestinationQuery('');
      setPlaceSuggestions([]);
      startDestinationDiscovery(destination.slug).catch(() => {});
      const sent = await onSend(`I’d like to plan a trip to ${destination.name}.`);
      if (!sent) setDestinationQuery(destination.name);
    } catch {
      setDestinationError('That destination could not be saved. Please try again or type it in the chat.');
    } finally {
      setIsResolvingDestination(false);
    }
  };

  const visibleMessages = isWelcome ? [] : messages;

  return (
    <section className="relative z-10 flex h-full min-h-0 w-full max-w-3xl min-w-0 flex-col overflow-hidden">
      <div className={`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-1 py-5 sm:px-4 sm:py-7 ${isWelcome ? 'justify-end' : ''}`} aria-live="polite">
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
                      {stage.status === 'complete' ? <span className="text-green-medium">✓</span> : <LoaderCircle size={13} className="animate-spin" />}
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
                <p className={`max-w-[min(88%,38rem)] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'rounded-br-md bg-pine text-white' : 'rounded-bl-md bg-bg-subtle text-pine'}`}>
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

      <form onSubmit={submit} className="mx-auto w-full max-w-2xl shrink-0 bg-white/95 px-0 pb-2 pt-3 sm:px-4 sm:pb-4">
        {suggestions.length > 0 && !isLoading && (
          <div className="mb-3 max-h-24 overflow-y-auto">
            <p className={`mb-2 text-xs font-semibold text-text-secondary ${isWelcome ? 'text-center' : ''}`}>{!brief?.destination ? 'A few places to start' : 'Quick choices'}</p>
            <div className={`flex flex-wrap gap-2 ${isWelcome ? 'justify-center' : ''}`}>
              {suggestions.map(({ label, message }) => (
                <button key={label} type="button" disabled={isSending || isGenerating} onClick={() => {
                  if (!brief?.destination) {
                    setDestinationQuery(label);
                    setDestinationError('');
                    return;
                  }
                  onSend(message);
                }} className="rounded-full border border-border-strong bg-white px-3 py-2 text-left text-xs font-semibold capitalize text-pine transition hover:border-pine hover:bg-badge-bg disabled:opacity-50">
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {!brief?.destination && !isLoading && (
          <div className="relative mb-3">
            <div className="flex items-center gap-2 rounded-2xl border border-border-strong bg-white px-4 py-3 shadow-sm transition focus-within:border-pine focus-within:ring-2 focus-within:ring-pine/10">
              {isResolvingDestination ? <LoaderCircle size={16} className="shrink-0 animate-spin text-text-secondary" /> : <Search size={16} className="shrink-0 text-text-secondary" />}
              <input
                value={destinationQuery}
                onChange={event => {
                  const value = event.target.value;
                  setDestinationQuery(value);
                  if (value.trim().length < 2) setPlaceSuggestions([]);
                }}
                onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (placeSuggestions[0]?.placeId) chooseDestination(placeSuggestions[0]); else setDestinationError('Choose a destination from the suggestions to continue.'); } }}
                placeholder="Search a city, state or country"
                aria-label="Search a destination"
                autoComplete="off"
                disabled={isResolvingDestination || isSending || isGenerating}
                className="min-w-0 flex-1 bg-transparent py-1 text-sm text-pine outline-none placeholder:text-text-secondary"
              />
              <button type="button" aria-label="Choose first destination suggestion" disabled={isResolvingDestination || isSending || isGenerating || !placeSuggestions[0]?.placeId} onClick={() => chooseDestination(placeSuggestions[0])} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pine text-white transition hover:bg-pine/90 disabled:opacity-35"><ArrowUp size={16} /></button>
            </div>
            {placeSuggestions.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-lg border border-border-default bg-white shadow-lg">
              {usingSavedDestinations && <p className="border-b border-border-default px-4 py-2 text-xs text-text-secondary">Showing saved destinations while Google Places is unavailable.</p>}
              <ul className="max-h-56 overflow-auto py-1" role="listbox">
                {placeSuggestions.map(suggestion => (
                  <li key={suggestion.placeId} role="option">
                    <button type="button" disabled={isResolvingDestination || isSending || isGenerating} onClick={() => chooseDestination(suggestion)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-pine hover:bg-bg-subtle disabled:opacity-50">
                      <MapPin size={16} className="shrink-0" /><span>{suggestion.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
              </div>
            )}
          </div>
        )}
        {usingSavedDestinations && placeSuggestions.length === 0 && destinationQuery.trim().length >= 2 && <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">Google Places is unavailable for this API key. Try one of the saved destinations.</p>}
        {destinationError && <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{destinationError}</p>}
        {!tripResult && canGenerate && (
          <section aria-label="Review your trip" className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-bg-subtle px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-pine">{brief.destination}</p>
              <p className="mt-0.5 truncate text-xs text-text-secondary">
                {formatTripDates(brief.startDate, brief.endDate)}
                {brief.travelers ? ` · ${Number(brief.travelers.adults || 1) + (brief.travelers.childrenAges?.length || 0)} travelers` : ''}
                {brief.budget ? ` · ${brief.budget}` : ''}
              </p>
              {(brief.interests?.length || brief.pace) && <p className="mt-1 truncate text-[11px] text-text-secondary">{[brief.interests?.join(' · '), brief.pace].filter(Boolean).join(' · ')}</p>}
            </div>
            <button type="button" onClick={onGenerate} disabled={isGenerating || isSending} className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-pine px-4 text-xs font-bold text-white transition hover:bg-pine/90 disabled:opacity-50">
              <Sparkles size={13} />Build trip
            </button>
          </section>
        )}
        {brief?.destination && <>
        <label className="sr-only" htmlFor="planner-message">Message your travel planner</label>
        <div className="flex items-end gap-2 rounded-2xl border border-border-strong bg-white p-2 shadow-sm transition focus-within:border-pine focus-within:ring-2 focus-within:ring-pine/10">
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
          <button type="submit" disabled={!draft.trim() || isLoading || isSending || isGenerating} aria-label="Send message" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pine text-white transition hover:bg-pine/90 disabled:cursor-not-allowed disabled:opacity-40">
            {isSending ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="mt-2 px-1 text-center text-[11px] text-text-secondary">{tripResult ? 'Ask for a change in your own words; your saved trip will update.' : 'Suggestions appear above. Exact dates are needed before generating your itinerary.'}</p>
        </>}
      </form>
    </section>
  );
}
