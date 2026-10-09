import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { d1Batch, d1Query } from '../db/client.js';
import { generateJson } from '../services/gemini.service.js';
import { canGenerateTrip, createEmptyBrief } from '../services/itinerary-ai/brief.js';
import { runIntakeTurn } from '../services/itinerary-ai/intake.graph.js';
import { createItineraryRevision } from '../services/itinerary-ai/revision.service.js';
import { fetchGoogleRouteMatrix, optimizeStopOrder } from '../services/itinerary-ai/route-optimizer.js';

const router = express.Router();
const INITIAL_MESSAGE = "Hi, I'm your trip planner. Where would you like to go? If you are not sure yet, tell me what kind of trip sounds good.";

async function getConversation(conversationId, userId) {
  const [conversation] = await d1Query(
    'SELECT * FROM ai_conversations WHERE id = ? AND user_id = ?',
    [conversationId, userId]
  );
  return conversation || null;
}

async function getTripItems(tripId) {
  return d1Query(
    `SELECT i.*, p.name as place_name, p.category, p.latitude, p.longitude, p.google_place_id
     FROM itinerary_items i JOIN places p ON i.place_id = p.id
     WHERE i.trip_id = ? ORDER BY i.day_index ASC, i.order_index ASC`,
    [tripId]
  );
}

async function getTripResult(tripId) {
  if (!tripId) return null;
  const [trip] = await d1Query(
    `SELECT t.id, t.start_date, t.end_date, d.name as destination_name
     FROM trips t JOIN destinations d ON t.destination_id = d.id WHERE t.id = ?`,
    [tripId]
  );
  if (!trip) return null;
  const itinerary = await getTripItems(tripId);
  const numDays = Math.round((new Date(`${trip.end_date}T00:00:00Z`) - new Date(`${trip.start_date}T00:00:00Z`)) / 86400000) + 1;
  return {
    tripId,
    destination: trip.destination_name,
    numDays,
    totalItems: itinerary.length,
    itinerary,
  };
}

router.post('/conversations', authMiddleware, async (req, res) => {
  const conversationId = crypto.randomUUID();
  const messageId = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await d1Batch([
      {
        sql: `INSERT INTO ai_conversations (id, user_id, title, brief_json, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        params: [conversationId, req.user.id, 'New trip', JSON.stringify(createEmptyBrief()), now, now],
      },
      {
        sql: `INSERT INTO ai_messages (id, conversation_id, role, content, created_at)
              VALUES (?, ?, 'assistant', ?, ?)`,
        params: [messageId, conversationId, INITIAL_MESSAGE, now],
      },
    ]);
    res.status(201).json({
      conversationId,
      brief: createEmptyBrief(),
      messages: [{ id: messageId, role: 'assistant', content: INITIAL_MESSAGE, created_at: now }],
    });
  } catch (error) {
    console.error('[AI conversation] Create failed:', error);
    res.status(500).json({ error: 'Could not start a planning conversation.' });
  }
});

router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const conversations = await d1Query(
      `SELECT c.id, c.title, c.trip_id, c.created_at, c.updated_at,
              (SELECT m.content FROM ai_messages m
               WHERE m.conversation_id = c.id
               ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message
       FROM ai_conversations c
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC
       LIMIT 100`,
      [req.user.id]
    );
    res.json(conversations);
  } catch (error) {
    console.error('[AI conversation] List failed:', error);
    res.status(500).json({ error: 'Could not load your private trip chats.' });
  }
});

router.get('/conversations/latest', authMiddleware, async (req, res) => {
  try {
    const [conversation] = await d1Query(
      `SELECT * FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`,
      [req.user.id]
    );
    if (!conversation) return res.status(404).json({ error: 'No planning conversation found.' });

    const messages = await d1Query(
      `SELECT id, role, content, created_at FROM ai_messages
       WHERE conversation_id = ? ORDER BY created_at ASC, id ASC`,
      [conversation.id]
    );
    res.json({
      conversationId: conversation.id,
      brief: JSON.parse(conversation.brief_json || '{}'),
      messages,
      tripResult: await getTripResult(conversation.trip_id),
    });
  } catch (error) {
    console.error('[AI conversation] Latest load failed:', error);
    res.status(500).json({ error: 'Could not load your latest planning conversation.' });
  }
});

router.get('/trips/:tripId/conversation', authMiddleware, async (req, res) => {
  try {
    let [conversation] = await d1Query(
      `SELECT * FROM ai_conversations WHERE trip_id = ? AND user_id = ? ORDER BY updated_at DESC LIMIT 1`,
      [req.params.tripId, req.user.id]
    );
    if (!conversation) {
      const [trip] = await d1Query(
        `SELECT t.id, t.start_date, t.end_date, d.name AS destination_name
         FROM trips t JOIN destinations d ON d.id = t.destination_id
         WHERE t.id = ? AND t.user_id = ? LIMIT 1`,
        [req.params.tripId, req.user.id]
      );
      if (!trip) return res.status(404).json({ error: 'Trip not found.' });
      const brief = {
        ...createEmptyBrief(),
        destination: trip.destination_name,
        startDate: trip.start_date,
        endDate: trip.end_date,
        durationDays: Math.round((Date.parse(`${trip.end_date}T00:00:00Z`) - Date.parse(`${trip.start_date}T00:00:00Z`)) / 86400000) + 1,
      };
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const welcome = 'I can help adjust this itinerary. Tell me what you would like to change; the trip dates and destination will stay fixed.';
      await d1Batch([
        {
          sql: `INSERT INTO ai_conversations (id, user_id, trip_id, title, brief_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          params: [id, req.user.id, trip.id, `${trip.destination_name} trip`, JSON.stringify(brief), now, now],
        },
        {
          sql: `INSERT INTO ai_messages (id, conversation_id, role, content, created_at)
                VALUES (?, ?, 'assistant', ?, ?)`,
          params: [crypto.randomUUID(), id, welcome, now],
        },
      ]);
      conversation = { id, trip_id: trip.id, brief_json: JSON.stringify(brief) };
    }
    const messages = await d1Query(
      `SELECT id, role, content, created_at FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC`,
      [conversation.id]
    );
    res.json({
      conversationId: conversation.id,
      tripId: conversation.trip_id,
      brief: JSON.parse(conversation.brief_json || '{}'),
      messages,
      tripResult: await getTripResult(conversation.trip_id),
    });
  } catch (error) {
    console.error('[AI conversation] Trip conversation load failed:', error);
    res.status(500).json({ error: 'Could not load the AI assistant for this trip.' });
  }
});

router.get('/conversations/:conversationId', authMiddleware, async (req, res) => {
  try {
    const conversation = await getConversation(req.params.conversationId, req.user.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });

    const messages = await d1Query(
      `SELECT id, role, content, created_at FROM ai_messages
       WHERE conversation_id = ? ORDER BY created_at ASC, id ASC`,
      [conversation.id]
    );
    res.json({
      conversationId: conversation.id,
      tripId: conversation.trip_id,
      brief: JSON.parse(conversation.brief_json || '{}'),
      messages,
      tripResult: await getTripResult(conversation.trip_id),
    });
  } catch (error) {
    console.error('[AI conversation] Load failed:', error);
    res.status(500).json({ error: 'Could not load this planning conversation.' });
  }
});

router.post('/conversations/:conversationId/messages', authMiddleware, async (req, res) => {
  const userMessage = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!userMessage || userMessage.length > 2000) {
    return res.status(400).json({ error: 'Message must be between 1 and 2,000 characters.' });
  }

  try {
    const conversation = await getConversation(req.params.conversationId, req.user.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });

    const now = new Date().toISOString();
    const brief = JSON.parse(conversation.brief_json || '{}');
    let updatedBrief = brief;
    let assistantContent;
    let revisionOperations = [];

    if (conversation.trip_id) {
      const [trip] = await d1Query(
        `SELECT t.id, t.destination_id, t.start_date, t.end_date, d.name as destination_name
         FROM trips t JOIN destinations d ON t.destination_id = d.id
         WHERE t.id = ? AND t.user_id = ?`,
        [conversation.trip_id, req.user.id]
      );
      if (!trip) return res.status(404).json({ error: 'The trip connected to this conversation was not found.' });

      const [currentItems, places] = await Promise.all([
        getTripItems(conversation.trip_id),
        d1Query(
          `SELECT id, name, category, latitude, longitude, google_place_id
           FROM places WHERE destination_id = ? LIMIT 40`,
          [trip.destination_id]
        ),
      ]);
      const revision = await createItineraryRevision({
        env: req.cloudflare?.env,
        trip,
        brief,
        currentItems,
        places,
        request: userMessage,
      });

      if (revision.requiresNewTrip) {
        assistantContent = 'That changes the destination or dates. I can keep this itinerary as-is while we start a separate trip for those new plans.';
      } else {
        updatedBrief = revision.brief;
        assistantContent = `${revision.summary} Your itinerary is updated, and you can still edit any stop on the map.`;
        revisionOperations = [{
          sql: 'DELETE FROM itinerary_items WHERE trip_id = ?',
          params: [conversation.trip_id],
        }, ...revision.itinerary.map(item => ({
          sql: `INSERT INTO itinerary_items (id, trip_id, place_id, day_index, order_index, start_time, note, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [item.id, conversation.trip_id, item.place_id, item.day_index, item.order_index, item.start_time, item.note, now, now],
        }))];
      }
    } else {
      const result = await runIntakeTurn({
        brief,
        userMessage,
        env: req.cloudflare?.env,
      });
      updatedBrief = result.updatedBrief;
      assistantContent = result.assistantMessage;
    }

    const userMessageId = crypto.randomUUID();
    const assistantMessageId = crypto.randomUUID();
    const title = conversation.title === 'New trip' && updatedBrief.destination
      ? `Trip to ${updatedBrief.destination}`
      : conversation.title;

    await d1Batch([...revisionOperations,
      {
        sql: `INSERT INTO ai_messages (id, conversation_id, role, content, created_at)
              VALUES (?, ?, 'user', ?, ?)`,
        params: [userMessageId, conversation.id, userMessage, now],
      },
      {
        sql: `INSERT INTO ai_messages (id, conversation_id, role, content, created_at)
              VALUES (?, ?, 'assistant', ?, ?)`,
        params: [assistantMessageId, conversation.id, assistantContent, now],
      },
      {
        sql: `UPDATE ai_conversations SET brief_json = ?, title = ?, updated_at = ?
              WHERE id = ? AND user_id = ?`,
        params: [JSON.stringify(updatedBrief), title, now, conversation.id, req.user.id],
      },
    ]);

    res.json({
      conversationId: conversation.id,
      brief: updatedBrief,
      assistantMessage: {
        id: assistantMessageId,
        role: 'assistant',
        content: assistantContent,
        created_at: now,
      },
      canGenerate: canGenerateTrip(updatedBrief),
      tripResult: conversation.trip_id ? await getTripResult(conversation.trip_id) : null,
    });
  } catch (error) {
    console.error('[AI conversation] Message failed:', error);
    res.status(502).json({ error: 'The planner could not process that message. Please try again.' });
  }
});

router.post('/conversations/:conversationId/generate', authMiddleware, async (req, res) => {
  let streamStarted = false;
  const emit = event => res.write(`data: ${JSON.stringify(event)}\n\n`);
  try {
    const conversation = await getConversation(req.params.conversationId, req.user.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });
    if (conversation.trip_id) {
      return res.json({
        success: true,
        tripId: conversation.trip_id,
        ...(await getTripResult(conversation.trip_id)),
      });
    }

    const brief = JSON.parse(conversation.brief_json || '{}');
    if (!canGenerateTrip(brief)) {
      return res.status(422).json({ error: 'Add a destination and exact trip dates before generating.' });
    }

    const startDate = new Date(`${brief.startDate}T00:00:00Z`);
    const endDate = new Date(`${brief.endDate}T00:00:00Z`);
    const dayCount = Math.round((endDate - startDate) / 86400000) + 1;
    if (dayCount < 1 || dayCount > 21) {
      return res.status(422).json({ error: 'For now, AI drafts support trips of 1 to 21 days.' });
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    streamStarted = true;
    emit({ type: 'stage', id: 'validate_trip', label: 'Trip details checked', status: 'complete' });

    const destinationSlug = brief.destination.trim().toLowerCase().replace(/\s+/g, '-');
    emit({ type: 'stage', id: 'resolve_destination', label: 'Resolving destination', status: 'active' });
    const [destination] = await d1Query(
      `SELECT id, name, slug FROM destinations
       WHERE lower(name) = lower(?) OR slug = ? LIMIT 1`,
      [brief.destination.trim(), destinationSlug]
    );
    if (!destination) throw new Error('I could not find that destination in the travel guide yet.');
    emit({ type: 'stage', id: 'resolve_destination', label: 'Destination resolved', status: 'complete' });

    emit({ type: 'stage', id: 'load_places', label: 'Loading verified places', status: 'active' });
    const places = await d1Query(
      `SELECT id, name, category, latitude, longitude, google_place_id
       FROM places WHERE destination_id = ? LIMIT 40`,
      [destination.id]
    );
    if (!places.length) throw new Error('There are no verified places for this destination yet.');
    emit({ type: 'stage', id: 'load_places', label: `Loaded ${places.length} verified places`, status: 'complete' });

    const candidatePlaces = places.map(({ id, name, category, latitude, longitude }) => ({
      id, name, category, latitude, longitude,
    }));
    emit({ type: 'stage', id: 'draft_itinerary', label: 'Building your day-by-day plan', status: 'active' });
    const generated = await generateJson({
      env: req.cloudflare?.env,
      systemPrompt: 'You are a travel itinerary planner. Only use supplied place IDs. Return valid JSON, no prose.',
      userPrompt: `Build a realistic ${dayCount}-day itinerary for ${destination.name}, India.
Dates: ${brief.startDate} through ${brief.endDate}.
Travelers: ${JSON.stringify(brief.travelers)}. Starting from: ${brief.origin || 'not specified'}.
Interests: ${JSON.stringify(brief.interests)}. Pace: ${brief.pace || 'balanced'}. Budget: ${brief.budget || 'not specified'}.
Must-see: ${JSON.stringify(brief.mustSee)}. Avoid: ${JSON.stringify(brief.avoid)}.
Select only from these verified places: ${JSON.stringify(candidatePlaces)}.
Return a JSON array with 2-4 stops per day using exactly these fields:
[{"dayIndex":0,"placeId":"existing id","startTime":"09:00","note":"short practical tip"}]`,
      maxOutputTokens: 2500,
    });
    emit({ type: 'stage', id: 'draft_itinerary', label: 'Draft itinerary created', status: 'complete' });

    emit({ type: 'stage', id: 'validate_itinerary', label: 'Checking places and schedule', status: 'active' });
    const suggestedItems = Array.isArray(generated) ? generated : generated?.itinerary;
    const placeById = new Map(places.map(place => [place.id, place]));
    const seenPlaceIds = new Set();
    const dailyOrder = new Map();
    const itineraryItems = [];

    for (const item of Array.isArray(suggestedItems) ? suggestedItems : []) {
      const dayIndex = Number(item.dayIndex);
      if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= dayCount) continue;
      if (!placeById.has(item.placeId) || seenPlaceIds.has(item.placeId)) continue;
      seenPlaceIds.add(item.placeId);
      const orderIndex = dailyOrder.get(dayIndex) || 0;
      dailyOrder.set(dayIndex, orderIndex + 1);
      const place = placeById.get(item.placeId);
      itineraryItems.push({
        id: crypto.randomUUID(),
        place_id: place.id,
        place_name: place.name,
        category: place.category,
        latitude: place.latitude,
        longitude: place.longitude,
        google_place_id: place.google_place_id,
        day_index: dayIndex,
        order_index: orderIndex,
        start_time: /^([01]\d|2[0-3]):[0-5]\d$/.test(item.startTime) ? item.startTime : ['09:00', '13:00', '17:00'][orderIndex % 3],
        note: typeof item.note === 'string' ? item.note.slice(0, 400) : '',
      });
    }

    if (!itineraryItems.length) {
      throw new Error('The planner could not build a valid itinerary from the available places.');
    }
    emit({ type: 'stage', id: 'validate_itinerary', label: 'Itinerary checks passed', status: 'complete' });

    emit({ type: 'stage', id: 'calculate_routes', label: 'Ordering nearby stops', status: 'active' });
    const routeSources = new Set();
    for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
      const dayItems = itineraryItems.filter(item => item.day_index === dayIndex);
      if (dayItems.length < 2) continue;
      const hasCoordinates = dayItems.every(item => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)));
      const matrixItems = dayItems.map(item => ({ ...item, lat: item.latitude, lng: item.longitude }));
      const matrix = hasCoordinates ? await fetchGoogleRouteMatrix(matrixItems, req.cloudflare?.env) : null;
      const optimized = optimizeStopOrder(dayItems, matrix);
      routeSources.add(optimized.source);
      const replacements = new Map(optimized.items.map(item => [item.id, item]));
      for (let index = 0; index < itineraryItems.length; index += 1) {
        if (itineraryItems[index].day_index === dayIndex) itineraryItems[index] = replacements.get(itineraryItems[index].id);
      }
    }
    emit({ type: 'stage', id: 'calculate_routes', label: routeSources.has('google_routes') ? 'Google Routes estimates applied' : 'Stops ordered by nearby locations', status: 'complete' });

    emit({ type: 'stage', id: 'save_trip', label: 'Saving your trip', status: 'active' });
    const tripId = crypto.randomUUID();
    const now = new Date().toISOString();
    const tripTitle = `${destination.name} getaway`;
    const operations = [{
      sql: `INSERT INTO trips (id, user_id, destination_id, title, start_date, end_date, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [tripId, req.user.id, destination.id, tripTitle, brief.startDate, brief.endDate, now, now],
    }];

    for (const item of itineraryItems) {
      operations.push({
        sql: `INSERT INTO itinerary_items (id, trip_id, place_id, day_index, order_index, start_time, note, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [item.id, tripId, item.place_id, item.day_index, item.order_index, item.start_time, item.note, now, now],
      });
    }

    const routeNote = routeSources.has('google_routes')
      ? ' Stop order was checked against Google Routes estimates.'
      : routeSources.has('straight_line')
        ? ' Stops were ordered by nearby locations; live route estimates were unavailable.'
        : '';
    const savedMessage = `Your ${dayCount}-day ${destination.name} itinerary is ready.${routeNote} You can edit the stops on the map or ask the trip assistant to adjust it.`;
    operations.push(
      {
        sql: 'UPDATE ai_conversations SET trip_id = ?, updated_at = ? WHERE id = ? AND user_id = ?',
        params: [tripId, now, conversation.id, req.user.id],
      },
      {
        sql: `INSERT INTO ai_messages (id, conversation_id, role, content, created_at)
              VALUES (?, ?, 'assistant', ?, ?)`,
        params: [crypto.randomUUID(), conversation.id, savedMessage, now],
      }
    );
    await d1Batch(operations);
    emit({ type: 'stage', id: 'save_trip', label: 'Trip saved', status: 'complete' });
    emit({ type: 'result', data: {
      success: true,
      tripId,
      destination: destination.name,
      numDays: dayCount,
      totalItems: itineraryItems.length,
      itinerary: itineraryItems,
      routeSource: routeSources.size === 0 ? 'not_required' : routeSources.has('straight_line') ? 'straight_line' : 'google_routes',
      assistantMessage: savedMessage,
    } });
    res.end();
  } catch (error) {
    console.error('[AI conversation] Generation failed:', error);
    const message = error?.message || 'The planner could not create this trip right now. Your brief is saved; please try again.';
    if (streamStarted) {
      emit({ type: 'error', message });
      res.end();
    } else {
      res.status(502).json({ error: message });
    }
  }
});

/**
 * POST /ai/:tripId/generate
 * Body: { style: 'relaxed'|'adventure'|'food', budget: 'budget'|'mid'|'luxury' }
 *
 * Flow:
 *  1. Load the trip + destination from D1
 *  2. Load all available places from D1 for that destination
 *  3. Build a structured prompt
 *  4. Call Gemini through LangChain for the draft
 *  5. Parse the AI JSON response into itinerary_items rows
 *  6. Return the parsed itinerary
 */
router.post('/:tripId/generate', authMiddleware, async (req, res) => {
  const { tripId } = req.params;
  const { style = 'balanced', budget = 'mid' } = req.body;

  try {
    // ── 1. Fetch the trip ────────────────────────────────────────────────────
    const [trip] = await d1Query(
      `SELECT t.*, d.name as dest_name 
       FROM trips t JOIN destinations d ON t.destination_id = d.id
      WHERE t.id = ? AND t.user_id = ?`,
          [tripId, req.user.id]
    );
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // ── 2. Fetch all places for this destination ─────────────────────────────
    const places = await d1Query(
      'SELECT id, name, category, latitude, longitude FROM places WHERE destination_id = ? LIMIT 30',
      [trip.destination_id]
    );

    if (places.length === 0) {
      return res.status(400).json({
        error: 'No saved places were found for this destination.'
      });
    }

    // Calculate trip duration in days
    const start = new Date(trip.start_date);
    const end = new Date(trip.end_date);
    const numDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));

    // ── 3. Build the prompt ──────────────────────────────────────────────────
    const placesJson = JSON.stringify(
      places.map(p => ({ id: p.id, name: p.name, category: p.category }))
    );

    const prompt = `You are an expert travel planner for ${trip.dest_name}, India.
    
Trip duration: ${numDays} days (${trip.start_date} to ${trip.end_date})
Traveler style: ${style}
Budget: ${budget}

Available places (use ONLY these IDs from the list):
${placesJson}

Create a detailed day-by-day itinerary. For each day, select 3-4 places that flow geographically.
Return ONLY a valid JSON array in this EXACT format (no extra text):
[
  { "dayIndex": 0, "orderIndex": 0, "placeId": "<id from list>", "startTime": "09:00", "note": "Brief tip" },
  { "dayIndex": 0, "orderIndex": 1, "placeId": "<id from list>", "startTime": "12:00", "note": "Brief tip" }
]`;

    // ── 4. Call Gemini through LangChain ─────────────────────────────────────
    let aiItems = [];

    try {
      const generatedItems = await generateJson({
        env: req.cloudflare?.env,
        systemPrompt: 'You are a travel itinerary planner. Always respond with valid JSON only.',
        userPrompt: prompt,
        maxOutputTokens: 1500,
      });
      if (!Array.isArray(generatedItems)) throw new Error('Gemini returned an invalid itinerary');
      aiItems = generatedItems;
    } catch (aiError) {
      console.warn('[AI] Gemini failed, using fallback itinerary:', aiError.message);
      // Fallback: distribute places evenly across days
      aiItems = places.slice(0, numDays * 3).map((p, idx) => ({
        dayIndex: Math.floor(idx / 3),
        orderIndex: idx % 3,
        placeId: p.id,
        startTime: ['09:00', '13:00', '17:00'][idx % 3],
        note: `Suggested stop in ${trip.dest_name}`,
      }));
    }

    // ── 5. Validate and save to D1 ───────────────────────────────────────────
    const validPlaceIds = new Set(places.map(p => p.id));
    const validItems = aiItems.filter(item => validPlaceIds.has(item.placeId));

    // Clear existing AI-generated items first
    await d1Query('DELETE FROM itinerary_items WHERE trip_id = ?', [tripId]);

    const now = new Date().toISOString();
    for (const item of validItems) {
      await d1Query(
        `INSERT INTO itinerary_items (id, trip_id, place_id, day_index, order_index, start_time, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), tripId, item.placeId, item.dayIndex, item.orderIndex,
         item.startTime, item.note, now, now]
      );
    }

    // ── 6. Return the final itinerary ────────────────────────────────────────
    const savedItems = await d1Query(
      `SELECT i.*, p.name as place_name, p.category, p.latitude, p.longitude, p.google_place_id
       FROM itinerary_items i JOIN places p ON i.place_id = p.id
       WHERE i.trip_id = ? ORDER BY i.day_index ASC, i.order_index ASC`,
      [tripId]
    );

    res.json({
      success: true,
      tripId,
      destination: trip.dest_name,
      numDays,
      totalItems: savedItems.length,
      itinerary: savedItems,
    });

  } catch (error) {
    console.error('[AI Generate] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
