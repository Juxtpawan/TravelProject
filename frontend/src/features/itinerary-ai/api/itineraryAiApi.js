import { apiClient } from '../../../lib/apiClient';
import { ENV } from '../../../config/env';

function generationError(message) {
  const error = new Error(message);
  error.response = { data: { error: message } };
  return error;
}

export async function createPlannerConversation() {
  const { data } = await apiClient.post('/ai/conversations');
  return data;
}

export async function getPlannerConversation(conversationId) {
  const { data } = await apiClient.get(`/ai/conversations/${conversationId}`);
  return data;
}

export async function loadPlannerConversation() {
  try {
    const { data } = await apiClient.get('/ai/conversations/latest');
    return data;
  } catch (error) {
    if (error.response?.status !== 404) throw error;
    return createPlannerConversation();
  }
}

export async function sendPlannerMessage(conversationId, message) {
  const { data } = await apiClient.post(`/ai/conversations/${conversationId}/messages`, { message });
  return data;
}

export async function generatePlannerTrip(conversationId, onProgress) {
  const response = await fetch(`${ENV.API_URL}/ai/conversations/${conversationId}/generate`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream, application/json' },
    body: JSON.stringify({}),
  });
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    if (!response.ok) throw generationError(data.error || 'The itinerary could not be generated.');
    return data;
  }
  if (!response.ok || !response.body) {
    throw generationError('The itinerary could not be generated.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;
  let streamError = '';
  const consumeEvent = (block) => {
    const dataLine = block.split('\n').find(line => line.startsWith('data:'));
    if (!dataLine) return;
    try {
      const event = JSON.parse(dataLine.slice(5).trim());
      if (event.type === 'stage') onProgress?.(event);
      if (event.type === 'result') result = event.data;
      if (event.type === 'error') streamError = event.message || 'The itinerary could not be generated.';
    } catch {
      streamError = 'The planner returned an unreadable progress update.';
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';
    events.forEach(consumeEvent);
    if (done) break;
  }
  if (buffer.trim()) consumeEvent(buffer);
  if (streamError) throw generationError(streamError);
  if (!result) throw generationError('The planner ended before the itinerary was saved.');
  return result;
}

export async function listPlannerConversations() {
  const { data } = await apiClient.get('/ai/conversations');
  return Array.isArray(data) ? data : [];
}

export async function getTripPlannerConversation(tripId) {
  const { data } = await apiClient.get(`/ai/trips/${tripId}/conversation`);
  return data;
}
