import { LockKeyhole, MessageSquareText } from 'lucide-react';

export default function PlannerChatHistory({ conversations, activeConversationId, isDisabled, onSelect }) {
  return (
    <section aria-label="Your private planner chats" className="overflow-hidden rounded-xl border border-gray bg-white">
      <div className="flex items-center justify-between border-b border-gray px-4 py-3">
        <div>
          <h2 className="text-sm font-extrabold text-pine">Your chats</h2>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-text-secondary"><LockKeyhole size={11} />Private to your account</p>
        </div>
        <span className="rounded-full bg-bg-subtle px-2 py-1 text-[10px] font-bold text-pine">{conversations.length}</span>
      </div>
      <div className="max-h-[min(34dvh,280px)] overflow-y-auto p-2">
        {conversations.length ? conversations.map(conversation => {
          const active = conversation.id === activeConversationId;
          return (
            <button
              key={conversation.id}
              type="button"
              disabled={isDisabled || active}
              aria-current={active ? 'true' : undefined}
              onClick={() => onSelect(conversation.id)}
              className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left transition last:mb-0 ${active ? 'bg-badge-bg text-pine' : 'text-pine hover:bg-bg-subtle'} disabled:cursor-default`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <MessageSquareText size={14} className="shrink-0 opacity-70" />
                <span className="truncate text-xs font-bold">{conversation.title || 'New trip'}</span>
              </span>
              <span className="mt-1 block truncate pl-[22px] text-[10px] text-text-secondary">{conversation.last_message || 'Start planning this trip'}</span>
              <span className="mt-1 block pl-[22px] font-mono text-[9px] tracking-wide text-text-secondary">ROOM · {conversation.id.slice(0, 8)}</span>
            </button>
          );
        }) : (
          <p className="px-3 py-5 text-center text-xs leading-5 text-text-secondary">Your planning chats will appear here.</p>
        )}
      </div>
    </section>
  );
}
