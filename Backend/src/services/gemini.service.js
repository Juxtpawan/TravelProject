import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

function parseJsonResponse(content) {
  const text = (Array.isArray(content)
    ? content.map(part => typeof part === 'string' ? part : part.text || '').join('')
    : content).trim();
  const unfencedText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const candidates = [
    unfencedText,
    unfencedText.match(/\[[\s\S]*\]/)?.[0],
    unfencedText.match(/\{[\s\S]*\}/)?.[0],
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next extracted JSON candidate.
    }
  }

  throw new Error('Gemini returned invalid JSON');
}

export async function generateJson({ env, systemPrompt, userPrompt, maxOutputTokens }) {
  const apiKey = env?.GEMINI_API_KEY || env?.GOOGLE_AI_API_KEY
    || process.env?.GEMINI_API_KEY || process.env?.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const model = new ChatGoogleGenerativeAI({
    apiKey,
    model: 'gemini-2.5-flash',
    temperature: 0,
    maxOutputTokens,
  });
  const response = await model.invoke([
    ['system', systemPrompt],
    ['human', userPrompt],
  ]);

  return parseJsonResponse(response.content);
}