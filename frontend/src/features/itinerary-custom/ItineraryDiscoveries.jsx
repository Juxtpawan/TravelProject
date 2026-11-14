import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, ChevronLeft, ChevronRight, Compass, MapPin, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const destinationIdeas = {
  paris: {
    name: 'Paris',
    guide: {
      title: 'Explore Paris',
      detail: 'Neighborhoods, landmarks, and local favorites',
      image: '/images/home-hero-eiffel-640.jpg',
    },
    itinerary: {
      title: '3 days in Paris',
      detail: 'A relaxed first-timer city break',
      image: '/images/home-hero-eiffel-640.jpg',
      days: [
        ['Day 1 · Around the Seine', 'Louvre, Tuileries Garden, and an evening river walk'],
        ['Day 2 · Paris icons', 'Eiffel Tower, Rue Cler, and the Arc de Triomphe'],
        ['Day 3 · Montmartre', 'Sacré-Cœur, café stops, and a slow neighborhood stroll'],
      ],
    },
    more: [
      { kind: 'guide', title: 'Paris food guide', detail: 'Bakeries, bistros, and classic French dining', image: '/images/home-hero-eiffel-640.jpg' },
      { kind: 'itinerary', title: 'A weekend in Paris', detail: 'Two days of memorable city highlights', image: '/images/home-hero-eiffel-640.jpg', days: [['Day 1 · Central Paris', 'The Louvre, Île de la Cité, and a walk along the Seine'], ['Day 2 · West to Montmartre', 'Eiffel Tower, Arc de Triomphe, and Sacré-Cœur']] },
    ],
  },
  manali: {
    name: 'Manali',
    guide: {
      title: 'Explore Manali',
      detail: 'Mountain viewpoints, temples, and local food',
      image: '/images/home-hero-mountain-640.jpg',
    },
    itinerary: {
      title: '4 days in Manali',
      detail: 'A mountain escape with time to unwind',
      image: '/images/home-hero-mountain-640.jpg',
      days: [
        ['Day 1 · Old Manali', 'Manu Temple, the old village lanes, and a riverside café'],
        ['Day 2 · Manali town', 'Hadimba Temple, the cedar forest, and Mall Road'],
        ['Day 3 · Mountain views', 'Solang Valley and a flexible afternoon in town'],
        ['Day 4 · Nearby nature', 'Jogini Falls trail and a relaxed final dinner'],
      ],
    },
    more: [
      { kind: 'guide', title: 'Manali food guide', detail: 'Local cafés and Himachali favorites', image: '/images/home-hero-mountain-640.jpg' },
      { kind: 'itinerary', title: 'Manali weekend', detail: 'A two-day plan for a short mountain break', image: '/images/home-hero-mountain-640.jpg', days: [['Day 1 · Old Manali', 'Manu Temple, village lanes, and a relaxed café stop'], ['Day 2 · Manali town', 'Hadimba Temple, cedar forest, and Mall Road']] },
    ],
  },
  goa: {
    name: 'Goa',
    guide: {
      title: 'Explore Goa',
      detail: 'Beaches, heritage streets, and coastal food',
      tone: 'from-[#176b65] via-[#3f9b86] to-[#e2b36c]',
    },
    itinerary: {
      title: '3 days in Goa',
      detail: 'A flexible mix of coast, culture, and cafés',
      tone: 'from-[#176b65] via-[#3f9b86] to-[#e2b36c]',
      days: [
        ['Day 1 · Panaji', 'Fontainhas, the Latin Quarter, and a riverside dinner'],
        ['Day 2 · North Goa', 'Choose a beach, explore local markets, and catch sunset'],
        ['Day 3 · Old Goa', 'Old Goa churches and an unhurried coastal lunch'],
      ],
    },
    more: [
      { kind: 'guide', title: 'Goa beach guide', detail: 'Find a coast that suits your kind of day', tone: 'from-[#176b65] via-[#3f9b86] to-[#e2b36c]' },
      { kind: 'itinerary', title: '5 days in Goa', detail: 'More time for the coast, Panaji, and Old Goa', tone: 'from-[#176b65] via-[#3f9b86] to-[#e2b36c]', days: [['Day 1 · Panaji', 'Fontainhas and a riverside dinner'], ['Day 2 · North Goa', 'Choose a beach and catch sunset'], ['Day 3 · Old Goa', 'Churches, heritage, and a long lunch'], ['Day 4 · South Goa', 'A quieter beach day'], ['Day 5 · At your pace', 'Return to a favorite spot or explore a market']] },
    ],
  },
};

function IdeaCard({ image, tone, kind, title, detail, onClick, to }) {
  const body = <>
    <span className={`relative block aspect-[16/9] overflow-hidden bg-gradient-to-br ${tone || 'from-[#193e30] via-[#64866a] to-[#d6b17a]'}`}>
      {image && <img src={image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />}
      <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold leading-4 text-pine shadow-sm backdrop-blur-sm">
        {kind === 'guide' ? <Compass size={12} /> : <CalendarDays size={12} />}
        {kind === 'guide' ? 'Guide' : 'Itinerary'}
      </span>
    </span>
      <span className="flex min-h-28 flex-1 flex-col gap-2 p-3 sm:min-h-32 sm:gap-2.5 sm:p-4">
      <span className="line-clamp-2 min-h-10 text-[15px] font-extrabold leading-5 text-pine sm:text-base">{title}</span>
      <span className="line-clamp-2 min-h-9 text-xs leading-[18px] text-[#66736b] sm:text-[13px]">{detail}</span>
      <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-xs font-bold leading-5 text-pine">{kind === 'guide' ? 'Open guide' : 'View itinerary'} <ArrowRight size={13} /></span>
    </span>
  </>;

  const className = 'group flex h-full w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e0e8e1] bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#bfd2c2] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium';
  return to
    ? <Link to={to} className={className}>{body}</Link>
    : <button type="button" onClick={onClick} className={className}>{body}</button>;
}

export default function ItineraryDiscoveries({ destinationSlug, destinationName, expanded, onExpandedChange }) {
  const [selectedItinerary, setSelectedItinerary] = useState(null);
  const [internalIsExpanded, setInternalIsExpanded] = useState(true);
  const isExpanded = expanded ?? internalIsExpanded;
  const ideasRowRef = useRef(null);
  const [scrollEdges, setScrollEdges] = useState({ left: false, right: false });
  const slug = String(destinationSlug || '').trim().toLowerCase().replace(/\s+/g, '-');
  const ideas = destinationIdeas[slug];
  const cards = ideas ? [
    ...(ideas.guide ? [{ ...ideas.guide, kind: 'guide' }] : []),
    ...(ideas.itinerary ? [{ ...ideas.itinerary, kind: 'itinerary' }] : []),
    ...(ideas.more || []),
  ] : [];

  useEffect(() => {
    if (!selectedItinerary) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') setSelectedItinerary(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedItinerary]);

  useLayoutEffect(() => {
    const row = ideasRowRef.current;
    if (!row) return undefined;
    const updateScrollEdges = () => {
      const rowBounds = row.getBoundingClientRect();
      const firstCard = row.firstElementChild?.getBoundingClientRect();
      const lastCard = row.lastElementChild?.getBoundingClientRect();
      setScrollEdges(current => {
        const next = {
          left: Boolean(firstCard && firstCard.left < rowBounds.left - 1),
          right: Boolean(lastCard && lastCard.right > rowBounds.right + 1),
        };
        return current.left === next.left && current.right === next.right ? current : next;
      });
    };
    updateScrollEdges();
    const frame = window.requestAnimationFrame(updateScrollEdges);
    row.addEventListener('scroll', updateScrollEdges, { passive: true });
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateScrollEdges);
    resizeObserver?.observe(row);
    Array.from(row.children).forEach(card => resizeObserver?.observe(card));
    window.addEventListener('resize', updateScrollEdges, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      row.removeEventListener('scroll', updateScrollEdges);
      window.removeEventListener('resize', updateScrollEdges);
      resizeObserver?.disconnect();
    };
  }, [cards.length, slug, isExpanded]);

  if (!ideas || (!ideas.guide && !ideas.itinerary)) return null;
  const guidePath = `/locations/${encodeURIComponent(slug)}`;

  const scrollIdeas = direction => {
    const row = ideasRowRef.current;
    if (!row) return;
    const card = row.firstElementChild;
    if (!card) return;
    const gap = Number.parseFloat(window.getComputedStyle(row).columnGap) || 0;
    row.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: 'smooth' });
  };

  return <>
    <section aria-labelledby="itinerary-discoveries-title" className="mb-3 min-w-0">
      <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
        <button type="button" aria-expanded={isExpanded} aria-controls={`destination-ideas-${slug}`} onClick={() => onExpandedChange ? onExpandedChange() : setInternalIsExpanded(value => !value)} className="flex min-h-12 min-w-0 items-center gap-2 text-left text-pine">
          <ChevronRight size={16} className={`shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          <h2 id="itinerary-discoveries-title" className="truncate text-2xl font-black leading-8">Explore {destinationName || ideas.name}</h2>
        </button>
        {isExpanded && (scrollEdges.left || scrollEdges.right) && <div className="flex shrink-0 items-center gap-1">
          <button type="button" aria-label="Scroll destination ideas one card left" aria-hidden={!scrollEdges.left} tabIndex={scrollEdges.left ? 0 : -1} disabled={!scrollEdges.left} onClick={() => scrollIdeas(-1)} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#e3eae4] bg-white text-pine shadow-sm transition hover:bg-[#f3f7f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium ${scrollEdges.left ? '' : 'invisible pointer-events-none'}`}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Scroll destination ideas one card right" aria-hidden={!scrollEdges.right} tabIndex={scrollEdges.right ? 0 : -1} disabled={!scrollEdges.right} onClick={() => scrollIdeas(1)} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#e3eae4] bg-white text-pine shadow-sm transition hover:bg-[#f3f7f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium ${scrollEdges.right ? '' : 'invisible pointer-events-none'}`}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>}
      </div>
      <div id={`destination-ideas-${slug}`} hidden={!isExpanded} className="relative min-w-0">
        <div ref={ideasRowRef} role="region" aria-label={`${ideas.name} guides and itineraries`} tabIndex={0} className="app-scrollbar-hidden flex w-full min-w-0 snap-x snap-proximity touch-pan-x gap-2 overflow-x-auto scroll-smooth px-0.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium/60 sm:gap-3">
          {cards.map(card => <div key={`${card.kind}-${card.title}`} className="w-[13rem] shrink-0 snap-start">
            <IdeaCard {...card} kind={card.kind} to={card.kind === 'guide' ? guidePath : undefined} onClick={() => setSelectedItinerary(card.kind === 'itinerary' ? card : null)} />
          </div>)}
        </div>
      </div>
    </section>

    {selectedItinerary && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedItinerary(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="sample-itinerary-title" className="max-h-[min(88dvh,46rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className={`relative flex aspect-[16/6] items-end overflow-hidden bg-gradient-to-br ${selectedItinerary.tone || 'from-[#193e30] via-[#64866a] to-[#d6b17a]'}`}>
          {selectedItinerary.image && <img src={selectedItinerary.image} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          <button type="button" onClick={() => setSelectedItinerary(null)} aria-label="Close itinerary preview" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-pine shadow-sm"><X size={17} /></button>
          <div className="relative w-full bg-white/95 p-4 text-pine backdrop-blur-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-wider text-green-ink">Sample itinerary · {ideas.name}</p><h2 id="sample-itinerary-title" className="mt-1 text-xl font-extrabold sm:text-2xl">{selectedItinerary.title}</h2><p className="mt-1 text-sm text-text-secondary">{selectedItinerary.detail}</p></div>
        </div>
        <ol className="space-y-3 p-4 sm:p-6">
          {selectedItinerary.days.map(([day, description]) => <li key={day} className="flex gap-3 rounded-xl bg-[#f5f8f5] p-3.5"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e2efe4] text-pine"><MapPin size={14} /></span><div><h3 className="text-sm font-extrabold text-pine">{day}</h3><p className="mt-1 text-sm leading-5 text-[#66736b]">{description}</p></div></li>)}
        </ol>
        <div className="flex flex-col-reverse gap-2 border-t border-[#edf1ed] p-4 sm:flex-row sm:justify-end sm:p-5">
          <button type="button" onClick={() => setSelectedItinerary(null)} className="inline-flex h-10 items-center justify-center rounded-full border border-[#dce5de] px-4 text-sm font-bold text-pine hover:bg-[#f7faf7]">Close</button>
          <Link to={guidePath} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-btn-primary-bg px-4 text-sm font-bold text-btn-primary-text hover:bg-btn-primary-bg-hover">Build your own trip <BookOpen size={15} /></Link>
        </div>
      </section>
    </div>}
  </>;
}
