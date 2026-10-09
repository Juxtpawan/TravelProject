import { generateJson } from '../gemini.service.js';
import { mergeBrief } from './brief.js';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateRevisionOutput(result, { brief, places, dayCount }) {
  if (result?.requiresNewTrip) return { requiresNewTrip: true, summary: result.summary };
  if (!Array.isArray(result?.itinerary) || result.itinerary.length === 0 || result.itinerary.length > 40) {
    throw new Error('The planner did not return a usable revised itinerary.');
  }

  const placeById = new Map(places.map(place => [place.id, place]));
  const seenIds = new Set();
  const orderByDay = new Map();
  const itinerary = [];

  for (const item of result.itinerary) {
    const dayIndex = Number(item.dayIndex);
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= dayCount) {
      throw new Error('The revised itinerary contains a day outside the trip dates.');
    }
    if (typeof item.placeId !== 'string' || !placeById.has(item.placeId)) {
      throw new Error('The revised itinerary contains a place that is not in the verified trip guide.');
    }
    if (seenIds.has(item.placeId)) throw new Error('The revised itinerary repeats a place.');
    if (typeof item.startTime !== 'string' || !TIME_PATTERN.test(item.startTime)) {
      throw new Error('The revised itinerary contains an invalid start time.');
    }

    seenIds.add(item.placeId);
    const place = placeById.get(item.placeId);
    const orderIndex = orderByDay.get(dayIndex) || 0;
    orderByDay.set(dayIndex, orderIndex + 1);
    itinerary.push({
      id: crypto.randomUUID(),
      place_id: place.id,
      place_name: place.name,
      category: place.category,
      latitude: place.latitude,
      longitude: place.longitude,
      google_place_id: place.google_place_id,
      day_index: dayIndex,
      order_index: orderIndex,
      start_time: item.startTime,
      note: typeof item.note === 'string' ? item.note.slice(0, 400) : '',
    });
  }

  return {
    requiresNewTrip: false,
    summary: typeof result.summary === 'string' ? result.summary.slice(0, 300) : 'I updated your itinerary.',
    brief: mergeBrief(brief, {
      pace: result.briefPatch?.pace,
      budget: result.briefPatch?.budget,
      interests: result.briefPatch?.interests,
      mustSee: result.briefPatch?.mustSee,
      avoid: result.briefPatch?.avoid,
      travelers: result.briefPatch?.travelers,
    }),
    itinerary,
  };
}

export async function createItineraryRevision({ env, trip, brief, currentItems, places, request }) {
  const candidates = places.map(({ id, name, category, latitude, longitude }) => ({
    id, name, category, latitude, longitude,
  }));
  const currentPlan = currentItems.map(item => ({
    dayIndex: item.day_index,
    placeId: item.place_id,
    startTime: item.start_time,
    note: item.note,
  }));

  const result = await generateJson({
    env,
    systemPrompt: `You revise an existing saved travel itinerary. Return one JSON object with {"summary":"short user-facing explanation","briefPatch":{},"itinerary":[...],"requiresNewTrip":false}.
Only select place IDs from the supplied verified candidates. Preserve all useful existing stops unless the user's request removes or replaces them. Keep dayIndex within the trip's existing date range, avoid duplicate place IDs, respect must-see and avoid preferences, and use practical 24-hour HH:MM times. Never change trip dates or destination. If the user asks to change destination or dates, set requiresNewTrip to true and return an empty itinerary. Do not claim that routes, opening hours, or availability were checked unless supplied.`,
    userPrompt: JSON.stringify({
      userRequest: request,
      trip: {
        destination: trip.destination_name,
        startDate: trip.start_date,
        endDate: trip.end_date,
        brief,
      },
      currentItinerary: currentPlan,
      verifiedPlaceCandidates: candidates,
    }),
    maxOutputTokens: 2200,
  });

  const startDate = new Date(`${trip.start_date}T00:00:00Z`);
  const endDate = new Date(`${trip.end_date}T00:00:00Z`);
  const dayCount = Math.round((endDate - startDate) / 86400000) + 1;
  return validateRevisionOutput(result, { brief, places, dayCount });
}