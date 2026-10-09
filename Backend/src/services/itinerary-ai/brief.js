const EMPTY_BRIEF = {
  destination: null,
  origin: null,
  travelers: null,
  startDate: null,
  endDate: null,
  durationDays: null,
  dateFlexibility: null,
  interests: [],
  pace: null,
  budget: null,
  mustSee: [],
  avoid: [],
  skippedSlots: [],
};

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function createEmptyBrief() {
  return structuredClone(EMPTY_BRIEF);
}

export function mergeBrief(currentBrief, patch) {
  const current = currentBrief && typeof currentBrief === 'object' ? currentBrief : createEmptyBrief();
  const next = { ...createEmptyBrief(), ...current };

  for (const key of ['destination', 'origin', 'pace', 'budget', 'dateFlexibility']) {
    if (patch[key] === null || isNonEmptyString(patch[key])) {
      next[key] = isNonEmptyString(patch[key]) ? patch[key].trim() : null;
    }
  }

  for (const key of ['startDate', 'endDate']) {
    if (patch[key] === null || isIsoDate(patch[key])) next[key] = patch[key];
  }

  if (next.startDate && next.endDate && next.endDate >= next.startDate && (patch.startDate || patch.endDate)) {
    next.durationDays = Math.round((Date.parse(`${next.endDate}T00:00:00Z`) - Date.parse(`${next.startDate}T00:00:00Z`)) / 86400000) + 1;
  }

  if (!patch.startDate && !patch.endDate && (patch.durationDays === null || (Number.isInteger(Number(patch.durationDays)) && Number(patch.durationDays) >= 1 && Number(patch.durationDays) <= 21))) {
    next.durationDays = patch.durationDays === null ? null : Number(patch.durationDays);
  }

  if (patch.travelers === null || (patch.travelers && typeof patch.travelers === 'object')) {
    const adults = Number(patch.travelers?.adults);
    const childrenAges = Array.isArray(patch.travelers?.childrenAges)
      ? patch.travelers.childrenAges.map(Number).filter(age => Number.isInteger(age) && age >= 0 && age <= 17)
      : [];
    const type = ['solo', 'couple', 'family', 'friends'].includes(patch.travelers?.type)
      ? patch.travelers.type
      : next.travelers?.type || null;
    const countProvided = patch.travelers?.countProvided === true
      || (patch.travelers?.countProvided !== false && Number.isInteger(adults) && adults > 0);
    const groupType = type === 'family' || type === 'friends';
    next.travelers = patch.travelers === null
      ? null
      : {
          ...(type ? { type } : {}),
          adults: Number.isInteger(adults) && adults > 0 ? adults : type === 'couple' ? 2 : 1,
          childrenAges,
          ...(groupType ? { countProvided: countProvided || next.travelers?.countProvided === true } : {}),
        };
  }

  for (const key of ['interests', 'mustSee', 'avoid']) {
    if (patch[key] === null || Array.isArray(patch[key])) {
      next[key] = patch[key] === null
        ? []
        : [...new Set(patch[key].filter(isNonEmptyString).map(value => value.trim()))].slice(0, 12);
    }
  }

  if (Array.isArray(patch.skippedSlots)) {
    next.skippedSlots = [...new Set(patch.skippedSlots.filter(slot =>
      ['origin', 'travelers', 'dates', 'preferences'].includes(slot)
    ))];
  }

  for (const [slot, key] of [['origin', 'origin'], ['travelers', 'travelers'], ['dates', 'startDate'], ['preferences', 'interests']]) {
    if (patch[key] !== undefined && patch[key] !== null && patch[key] !== '' && patch[key].length !== 0) {
      next.skippedSlots = next.skippedSlots.filter(value => value !== slot);
    }
  }

  return next;
}

export function getChecklist(brief) {
  const travelers = brief.travelers;
  const datesCaptured = isIsoDate(brief.startDate) && isIsoDate(brief.endDate) && brief.endDate >= brief.startDate;
  const preferencesCaptured = brief.interests.length > 0 || isNonEmptyString(brief.pace)
    || isNonEmptyString(brief.budget) || brief.mustSee.length > 0 || brief.avoid.length > 0;

  return [
    { id: 'destination', label: 'Where to', value: brief.destination, captured: isNonEmptyString(brief.destination), skipped: false },
    { id: 'origin', label: 'Where from', value: brief.origin, captured: isNonEmptyString(brief.origin), skipped: brief.skippedSlots.includes('origin') },
    {
      id: 'travelers',
      label: "Who's coming",
      value: travelers ? `${travelers.adults} adult${travelers.adults === 1 ? '' : 's'}${travelers.childrenAges.length ? `, ${travelers.childrenAges.length} children` : ''}` : null,
      captured: Boolean(travelers),
      skipped: brief.skippedSlots.includes('travelers'),
    },
    {
      id: 'dates',
      label: "When you'd go",
      value: datesCaptured ? `${brief.startDate} to ${brief.endDate}` : brief.dateFlexibility,
      captured: datesCaptured || isNonEmptyString(brief.dateFlexibility),
      skipped: brief.skippedSlots.includes('dates'),
    },
    {
      id: 'preferences',
      label: "What you're after",
      value: [brief.interests.join(', '), brief.pace, brief.budget].filter(Boolean).join(' · '),
      captured: preferencesCaptured,
      skipped: brief.skippedSlots.includes('preferences'),
    },
  ];
}

export function canGenerateTrip(brief) {
  const dayCount = brief.startDate && brief.endDate
    ? Math.round((Date.parse(`${brief.endDate}T00:00:00Z`) - Date.parse(`${brief.startDate}T00:00:00Z`)) / 86400000) + 1
    : 0;
  return isNonEmptyString(brief.destination)
    && isIsoDate(brief.startDate)
    && isIsoDate(brief.endDate)
    && brief.endDate >= brief.startDate
    && dayCount <= 21;
}

export function getNextQuestion(brief) {
  if (!isNonEmptyString(brief.destination)) return 'Where would you like to go? If you are not sure, tell me what kind of trip sounds good.';
  if (!isNonEmptyString(brief.origin) && !brief.skippedSlots.includes('origin')) return 'Where will you be starting from? You can skip this if you are planning around the destination.';
  const needsGroupSize = ['family', 'friends'].includes(brief.travelers?.type)
    && brief.travelers.countProvided !== true
    && Number(brief.travelers.adults || 1) <= 1;
  if ((!brief.travelers || needsGroupSize) && !brief.skippedSlots.includes('travelers')) {
    return needsGroupSize
      ? `How many people are in your ${brief.travelers.type} group? Choose 1–6 or type a number.`
      : "Who's coming along? You can share the group size, and ages for any children if helpful.";
  }
  if (brief.durationDays > 21) return 'This planner supports trips up to 21 days. Please shorten the selected dates before generating.';
  if (!brief.durationDays && !brief.skippedSlots.includes('dates')) return 'How many days would you like to travel? Choose 1–7 days or type another duration (up to 21 days).';
  if (!canGenerateTrip(brief) && !brief.skippedSlots.includes('dates')) return 'When are you thinking of going? Exact dates help me build a day-by-day plan.';
  if (!getChecklist(brief)[4].captured && !brief.skippedSlots.includes('preferences')) return "What would make this trip yours? Tell me about interests, pace, or budget, or ask me to draft it now.";
  if (!canGenerateTrip(brief)) return 'I have the general timing. What exact start and end dates should I use for the saved itinerary?';
  return 'Your trip brief is ready. I can draft the itinerary now, or you can add anything else you have in mind.';
}
