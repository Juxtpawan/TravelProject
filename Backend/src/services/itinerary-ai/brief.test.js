import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canGenerateTrip,
  createEmptyBrief,
  getChecklist,
  getNextQuestion,
  mergeBrief,
} from './brief.js';
import { validateRevisionOutput } from './revision.service.js';
import { optimizeStopOrder } from './route-optimizer.js';

const places = [
  { id: 'place-1', name: 'Beach walk', category: 'attraction', latitude: 15.3, longitude: 73.9 },
  { id: 'place-2', name: 'Market', category: 'attraction', latitude: 15.4, longitude: 73.8 },
];

test('merges multiple trip details from one turn and normalizes traveler data', () => {
  const brief = mergeBrief(createEmptyBrief(), {
    destination: ' Goa ',
    startDate: '2026-11-01',
    endDate: '2026-11-05',
    travelers: { adults: 2, childrenAges: [8, 30, 'not-an-age'] },
    interests: [' Food ', 'Food'],
  });

  assert.equal(brief.destination, 'Goa');
  assert.deepEqual(brief.travelers, { adults: 2, childrenAges: [8] });
  assert.deepEqual(brief.interests, ['Food']);
  assert.equal(canGenerateTrip(brief), true);
  assert.equal(getChecklist(brief).filter(slot => slot.captured).length, 4);
});

test('requires exact, valid dates before a trip can be generated', () => {
  const incomplete = mergeBrief(createEmptyBrief(), { destination: 'Goa', dateFlexibility: 'sometime in November' });
  assert.equal(canGenerateTrip(incomplete), false);

  const invalid = mergeBrief(incomplete, { startDate: '2026-02-30', endDate: '2026-03-02' });
  assert.equal(invalid.startDate, null);
  assert.equal(canGenerateTrip(invalid), false);
});

test('skipping optional slots advances intake without weakening generation requirements', () => {
  const brief = mergeBrief(createEmptyBrief(), {
    destination: 'Goa',
    skippedSlots: ['origin', 'travelers', 'preferences'],
    startDate: '2026-11-01',
    endDate: '2026-11-05',
  });
  const checklist = getChecklist(brief);

  assert.equal(checklist.find(slot => slot.id === 'origin').skipped, true);
  assert.equal(checklist.find(slot => slot.id === 'travelers').skipped, true);
  assert.equal(checklist.find(slot => slot.id === 'preferences').skipped, true);
  assert.equal(canGenerateTrip(brief), true);
  assert.match(getNextQuestion(brief), /trip brief is ready/i);
});

test('accepts a revision made only from verified places in the trip date range', () => {
  const revision = validateRevisionOutput({
    summary: 'Added a market stop.',
    briefPatch: { pace: 'relaxed', destination: 'not-allowed-to-change-destination' },
    itinerary: [
      { dayIndex: 0, placeId: 'place-1', startTime: '09:00', note: 'Go early.' },
      { dayIndex: 1, placeId: 'place-2', startTime: '10:30', note: 'Take your time.' },
    ],
  }, { brief: createEmptyBrief(), places, dayCount: 2 });

  assert.equal(revision.itinerary.length, 2);
  assert.equal(revision.itinerary[1].day_index, 1);
  assert.equal(revision.brief.pace, 'relaxed');
  assert.equal(revision.brief.destination, null);
});

test('rejects hallucinated, duplicate, out-of-range, and malformed itinerary stops', () => {
  const invalidPlans = [
    [{ dayIndex: 0, placeId: 'fake-place', startTime: '09:00' }],
    [
      { dayIndex: 0, placeId: 'place-1', startTime: '09:00' },
      { dayIndex: 1, placeId: 'place-1', startTime: '10:00' },
    ],
    [{ dayIndex: 2, placeId: 'place-1', startTime: '09:00' }],
    [{ dayIndex: 0, placeId: 'place-1', startTime: '25:90' }],
  ];

  for (const itinerary of invalidPlans) {
    assert.throws(
      () => validateRevisionOutput({ itinerary }, { brief: createEmptyBrief(), places, dayCount: 2 }),
      /verified|repeats|outside|invalid start/i
    );
  }
});

test('routes destination or date changes to a separate trip instead of revising the saved one', () => {
  const result = validateRevisionOutput({
    requiresNewTrip: true,
    summary: 'This needs a new trip.',
    itinerary: [],
  }, { brief: createEmptyBrief(), places, dayCount: 2 });

  assert.equal(result.requiresNewTrip, true);
});

test('uses route matrix travel times to order a day and keeps the first stop as the start', () => {
  const stops = [
    { id: 'a', latitude: 0, longitude: 0, start_time: '09:00' },
    { id: 'b', latitude: 0, longitude: 2, start_time: '12:00' },
    { id: 'c', latitude: 0, longitude: 0.1, start_time: '15:00' },
  ];
  const matrix = [
    { originIndex: 0, destinationIndex: 1, duration: '10s', distanceMeters: 100, condition: 'ROUTE_EXISTS' },
    { originIndex: 0, destinationIndex: 2, duration: '100s', distanceMeters: 200, condition: 'ROUTE_EXISTS' },
    { originIndex: 1, destinationIndex: 2, duration: '20s', distanceMeters: 300, condition: 'ROUTE_EXISTS' },
  ];

  const result = optimizeStopOrder(stops, matrix);

  assert.deepEqual(result.items.map(item => item.id), ['a', 'b', 'c']);
  assert.deepEqual(result.items.map(item => item.start_time), ['09:00', '12:00', '15:00']);
  assert.equal(result.source, 'google_routes');
  assert.equal(result.totalDurationSeconds, 30);
});

test('falls back to coordinate distance when route matrix data is unavailable', () => {
  const stops = [
    { id: 'a', latitude: 0, longitude: 0 },
    { id: 'b', latitude: 0, longitude: 2 },
    { id: 'c', latitude: 0, longitude: 0.1 },
  ];

  const result = optimizeStopOrder(stops);

  assert.deepEqual(result.items.map(item => item.id), ['a', 'c', 'b']);
  assert.equal(result.source, 'straight_line');
  assert.equal(result.totalDurationSeconds, null);
});

test('asks family and friends for their group size before advancing intake', () => {
  const familyBrief = mergeBrief(createEmptyBrief(), {
    destination: 'Goa',
    skippedSlots: ['origin'],
    travelers: { type: 'family', countProvided: false },
  });

  assert.equal(familyBrief.travelers.adults, 1);
  assert.equal(familyBrief.travelers.countProvided, false);
  assert.match(getNextQuestion(familyBrief), /how many people/i);

  const sizedBrief = mergeBrief(familyBrief, {
    travelers: { adults: 4, countProvided: true },
  });
  assert.equal(sizedBrief.travelers.adults, 4);
  assert.equal(sizedBrief.travelers.countProvided, true);
  assert.doesNotMatch(getNextQuestion(sizedBrief), /how many people/i);
});

test('defaults couples to two adults when no count is supplied', () => {
  const brief = mergeBrief(createEmptyBrief(), { travelers: { type: 'couple' } });
  assert.equal(brief.travelers.adults, 2);
});
