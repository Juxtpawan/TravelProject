import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, MessageSquare, Plus, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../auth';
import { getDestinations } from '../../places/api/placesApi';
import {
  createPlannerConversation,
  getPlannerConversation,
  generatePlannerTrip,
  listPlannerConversations,
  loadPlannerConversation,
  sendPlannerMessage,
} from '../api/itineraryAiApi';
import PlannerConversation from './PlannerConversation';
import PlannerChatHistory from './PlannerChatHistory';

export default function AiPlannerScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const conversationRequest = useRef(null);
  const sendRequest = useRef(false);
  const generationRequest = useRef(false);
  const [conversationId, setConversationId] = useState('');
  const [brief, setBrief] = useState(null);
  const [messages, setMessages] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStages, setGenerationStages] = useState([]);
  const [error, setError] = useState('');
  const [tripResult, setTripResult] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    if (authLoading || !user?.id) return undefined;
    let active = true;

    if (!conversationRequest.current || conversationRequest.current.userId !== user.id) {
      conversationRequest.current = {
        userId: user.id,
        promise: (async () => {
          const data = await loadPlannerConversation();
          const rooms = await listPlannerConversations().catch(() => []);
          return { data, rooms };
        })(),
      };
    }

    conversationRequest.current.promise
      .then(({ data, rooms }) => {
        if (!active) return;
        setConversationId(data.conversationId);
        setBrief(data.brief);
        setMessages(data.messages);
        setTripResult(data.tripResult || null);
        setConversations(rooms);
      })
      .catch(() => {
        if (active) setError('Could not open the planner. Please try again.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, [authLoading, user?.id]);

  useEffect(() => {
    getDestinations().then(setDestinations).catch(() => setDestinations([]));
  }, []);

  const handleSend = async (message) => {
    if (!conversationId || sendRequest.current || generationRequest.current || isSending || isGenerating) return false;
    sendRequest.current = true;
    setError('');
    setIsSending(true);
    const userMessage = { id: `local-${Date.now()}`, role: 'user', content: message };
    setMessages(current => [...current, userMessage]);
    try {
      const result = await sendPlannerMessage(conversationId, message);
      setBrief(result.brief);
      setMessages(current => [...current, result.assistantMessage]);
      if (result.tripResult) setTripResult(result.tripResult);
      listPlannerConversations().then(setConversations).catch(() => {});
      return true;
    } catch (requestError) {
      setMessages(current => current.filter(item => item.id !== userMessage.id));
      setError(requestError.response?.data?.error || 'Your message could not be sent. Please try again.');
      return false;
    } finally {
      sendRequest.current = false;
      setIsSending(false);
    }
  };

  const handleGenerate = async () => {
    if (!conversationId || generationRequest.current || sendRequest.current || isGenerating || isSending) return;
    generationRequest.current = true;
    setError('');
    setIsGenerating(true);
    setGenerationStages([]);
    try {
      const result = await generatePlannerTrip(conversationId, stage => {
        setGenerationStages(current => {
          const existing = current.findIndex(item => item.id === stage.id);
          if (existing < 0) return [...current, stage];
          return current.map((item, index) => index === existing ? stage : item);
        });
      });
      setTripResult(result);
      if (result.assistantMessage) {
        setMessages(current => [...current, {
          id: `generated-${result.tripId}`,
          role: 'assistant',
          content: result.assistantMessage,
        }]);
      }
      if (result.tripId) navigate(`/trips/${result.tripId}`);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Your itinerary could not be generated. Your trip details are still here.');
    } finally {
      generationRequest.current = false;
      setIsGenerating(false);
    }
  };

  const handleNewTrip = async () => {
    if (isSending || isGenerating) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await createPlannerConversation();
      const rooms = await listPlannerConversations().catch(() => []);
      setConversationId(data.conversationId);
      setBrief(data.brief);
      setMessages(data.messages);
      setTripResult(null);
      setConversations(rooms.length ? rooms : [{
        id: data.conversationId,
        title: 'New trip',
        last_message: data.messages?.[0]?.content || '',
        updated_at: new Date().toISOString(),
      }]);
      conversationRequest.current = { userId: user.id, promise: Promise.resolve({ data, rooms: rooms.length ? rooms : [{ id: data.conversationId, title: 'New trip', last_message: data.messages?.[0]?.content || '' }] }) };
      setIsHistoryOpen(false);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not start another trip. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectConversation = async (id) => {
    if (!id || id === conversationId || isSending || isGenerating) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await getPlannerConversation(id);
      setConversationId(data.conversationId);
      setBrief(data.brief);
      setMessages(data.messages);
      setTripResult(data.tripResult || null);
      conversationRequest.current = { userId: user.id, promise: Promise.resolve({ data, rooms: conversations }) };
      setIsHistoryOpen(false);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'This private chat could not be opened.');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return <div className="app-container py-20 text-center text-sm text-text-secondary">Loading your planner…</div>;
  }

  if (!user) {
    return (
      <div className="app-container py-16">
        <section className="mx-auto max-w-lg border-y border-gray py-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-badge-bg text-pine"><Compass size={23} /></span>
          <h1 className="mt-4 text-2xl font-extrabold text-pine">Plan a trip with AI</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">Sign in to save your trip brief and keep the itinerary you build.</p>
          <Link to="/auth/login" state={{ from: '/ai' }} className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-pine px-6 text-sm font-bold text-white hover:bg-pine/90">Sign in to continue</Link>
        </section>
      </div>
    );
  }

  if (!brief) {
    return <div className="app-container py-20 text-center text-sm text-text-secondary">{error || 'Starting your trip brief…'}</div>;
  }

  const tripDuration = (Date.parse(`${brief.endDate}T00:00:00Z`) - Date.parse(`${brief.startDate}T00:00:00Z`)) / 86400000;
  const canGenerate = Boolean(brief.destination && brief.startDate && brief.endDate && Number.isFinite(tripDuration) && tripDuration >= 0 && tripDuration < 21);
  const hasStarted = Boolean(brief.destination || messages.some(message => message.role === 'user'));

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col overflow-hidden px-4 py-3 sm:px-6">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray/70 pb-3">
        <Link to="/ai" className="flex min-w-0 items-center gap-2 text-sm font-bold text-pine" aria-label="AI trip planner home">
          <Sparkles size={16} className="shrink-0" /><span className="truncate">Trip planner</span>
          {conversationId && <span title={`Private room ID: ${conversationId}`} className="hidden rounded bg-bg-subtle px-1.5 py-1 font-mono text-[9px] font-normal text-text-secondary md:inline">{conversationId.slice(0, 8)}</span>}
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" aria-label="Open private chat history" onClick={() => setIsHistoryOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold text-text-secondary transition hover:bg-bg-subtle hover:text-pine">
            <MessageSquare size={15} /><span className="hidden sm:inline">Chats</span>
          </button>
          <button type="button" onClick={handleNewTrip} disabled={isSending || isGenerating || isLoading} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-pine transition hover:bg-bg-subtle disabled:opacity-50 sm:px-4">
            <Plus size={15} /><span>New trip</span>
          </button>
          <Link to="/trips" className="hidden h-9 items-center rounded-full px-3 text-xs font-semibold text-text-secondary transition hover:bg-bg-subtle hover:text-pine sm:inline-flex">My trips</Link>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 justify-center">
        {!hasStarted && !isLoading && (
          <div className="pointer-events-none absolute inset-x-0 top-[12%] z-0 flex flex-col items-center px-4 text-center sm:top-[18%]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">A better way to plan</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-pine sm:text-5xl">Where to next?</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-text-secondary sm:text-base">Tell me what kind of trip you have in mind. We’ll shape it together.</p>
          </div>
        )}
        <PlannerConversation
          messages={messages}
          isWelcome={!hasStarted}
          brief={brief}
          destinations={destinations}
          isLoading={isLoading}
          isSending={isSending}
          isGenerating={isGenerating}
          generationStages={generationStages}
          error={error}
          onSend={handleSend}
          onGenerate={handleGenerate}
          canGenerate={canGenerate}
          tripResult={tripResult}
          onOpenTrip={() => navigate(`/trips/${tripResult.tripId}`)}
        />
      </div>
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[60] flex justify-start bg-black/25 backdrop-blur-[1px]">
          <button type="button" aria-label="Close chat history" onClick={() => setIsHistoryOpen(false)} className="absolute inset-0 h-full w-full cursor-default" />
          <aside role="dialog" aria-modal="true" aria-label="Private chat history" className="relative z-10 flex h-full w-[min(22rem,88vw)] flex-col gap-3 overflow-y-auto border-r border-gray bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-pine">Private chats</h2>
              <button type="button" onClick={() => setIsHistoryOpen(false)} aria-label="Close chat history" className="grid h-9 w-9 place-items-center rounded-full hover:bg-gray"><X size={18} /></button>
            </div>
            <PlannerChatHistory conversations={conversations} activeConversationId={conversationId} isDisabled={isSending || isGenerating || isLoading} onSelect={handleSelectConversation} />
          </aside>
        </div>
      )}
      {isLoading && <p className="sr-only" role="status">Opening private chat</p>}
    </div>
  );
}
