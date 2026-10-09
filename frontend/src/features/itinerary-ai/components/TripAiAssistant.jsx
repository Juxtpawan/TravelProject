import { useEffect, useRef, useState } from 'react';
import { Bot, LoaderCircle, Send, Sparkles, X } from 'lucide-react';
import { getTripPlannerConversation, sendPlannerMessage } from '../api/itineraryAiApi';

const quickPrompts = [
  'Make this trip less busy',
  'Add a local food stop',
  'Suggest a family-friendly change',
];

export default function TripAiAssistant({ tripId, onItineraryUpdated }) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const conversationRequest = useRef(null);
  const isLoading = isOpen && !conversationId && !error;

  useEffect(() => {
    if (!isOpen || conversationId) return;
    let active = true;
    if (!conversationRequest.current || conversationRequest.current.tripId !== tripId) {
      conversationRequest.current = { tripId, promise: getTripPlannerConversation(tripId) };
    }
    conversationRequest.current.promise
      .then(data => {
        if (!active) return;
        setConversationId(data.conversationId);
        setMessages(data.messages || []);
      })
      .catch(requestError => {
        if (active) {
          conversationRequest.current = null;
          setError(requestError.response?.data?.error || 'The trip assistant could not be opened. Close and reopen it to retry.');
        }
      });
    return () => { active = false; };
  }, [isOpen, conversationId, tripId]);

  const toggleAssistant = () => {
    setError('');
    setIsOpen(current => !current);
  };

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [isOpen, messages, isSending]);

  const send = async (value) => {
    const message = value.trim();
    if (!message || !conversationId || isSending) return;
    setError('');
    setIsSending(true);
    const localId = `local-${crypto.randomUUID()}`;
    setMessages(current => [...current, { id: localId, role: 'user', content: message }]);
    setDraft('');
    try {
      const result = await sendPlannerMessage(conversationId, message);
      setMessages(current => [...current.filter(item => item.id !== localId), result.assistantMessage]);
      if (result.tripResult?.itinerary) onItineraryUpdated?.(result.tripResult.itinerary);
    } catch (requestError) {
      setMessages(current => current.filter(item => item.id !== localId));
      setError(requestError.response?.data?.error || 'The itinerary could not be updated. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    send(draft);
  };

  return (
    <>
      <button type="button" onClick={toggleAssistant} aria-expanded={isOpen} className="fixed bottom-5 right-5 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-pine px-5 text-sm font-bold text-white shadow-lg transition hover:bg-pine/90">
        <Sparkles size={17} /> Ask AI
      </button>
      {isOpen && (
        <section aria-label="Trip AI assistant" className="fixed bottom-[4.75rem] right-4 z-40 flex h-[min(620px,calc(100vh-7rem))] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border-default bg-white shadow-2xl">
          <header className="flex items-center gap-3 border-b border-gray px-4 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-badge-bg text-pine"><Sparkles size={17} /></span>
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold text-pine">Trip assistant</h2>
              <p className="text-xs text-text-secondary">Changes apply to this itinerary</p>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Close assistant" className="ml-auto grid h-9 w-9 place-items-center rounded-full text-text-secondary hover:bg-gray"><X size={17} /></button>
          </header>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
            {isLoading && <p className="flex items-center gap-2 text-sm text-text-secondary"><LoaderCircle size={16} className="animate-spin" />Opening your trip conversation…</p>}
            {!isLoading && messages.slice(-24).map(message => (
              <article key={message.id} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-badge-bg text-pine"><Bot size={14} /></span>}
                <p className={`max-w-[85%] whitespace-pre-wrap break-words rounded-xl px-3 py-2.5 text-sm leading-5 ${message.role === 'user' ? 'bg-pine text-white' : 'bg-bg-subtle text-pine'}`}>{message.content}</p>
              </article>
            ))}
            {isSending && <p className="flex items-center gap-2 text-xs text-text-secondary"><LoaderCircle size={14} className="animate-spin" />Updating your itinerary…</p>}
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={submit} className="border-t border-gray p-3">
            {quickPrompts.map(prompt => (
              <button key={prompt} type="button" disabled={isLoading || isSending || !conversationId} onClick={() => send(prompt)} className="mb-2 mr-1.5 rounded-full border border-border-strong px-2.5 py-1.5 text-[11px] font-semibold text-pine hover:bg-bg-subtle disabled:opacity-50">{prompt}</button>
            ))}
            <div className="flex items-end gap-2 rounded-xl border border-border-strong p-2 focus-within:border-pine">
              <label className="sr-only" htmlFor="trip-ai-message">Ask about this trip</label>
              <textarea id="trip-ai-message" rows={2} maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Make a change to this trip…" disabled={isLoading || isSending || !conversationId} className="max-h-28 min-h-10 flex-1 resize-y bg-transparent px-1 py-1.5 text-sm text-pine outline-none placeholder:text-text-secondary disabled:opacity-60" />
              <button type="submit" aria-label="Send message" disabled={!draft.trim() || isLoading || isSending || !conversationId} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pine text-white disabled:opacity-40">{isSending ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={15} />}</button>
            </div>
            <p className="mt-2 px-1 text-[10px] text-text-secondary">Your trip dates and destination stay fixed. Ask to change stops, pace, or preferences.</p>
          </form>
        </section>
      )}
    </>
  );
}
