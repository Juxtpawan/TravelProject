import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { generateJson } from '../gemini.service.js';
import { canGenerateTrip, getNextQuestion, mergeBrief } from './brief.js';

const IntakeState = Annotation.Root({
  brief: Annotation(),
  userMessage: Annotation(),
  updatedBrief: Annotation(),
  assistantMessage: Annotation(),
});

function createIntakeGraph(env) {
  const updateBrief = async ({ brief, userMessage }) => {
    const nextQuestion = getNextQuestion(brief);
    const extraction = await generateJson({
      env,
      systemPrompt: `You extract explicit travel details from the user's latest message. Return one JSON object: {"patch":{},"acknowledgement":""}.
Only include patch keys supported by the latest user message. Never replace existing details unless the user corrects or clears them. Do not invent a destination, date, traveler count, or preference. Dates must be exact YYYY-MM-DD values; for vague timing, put the user's wording in dateFlexibility and leave dates out. Extract traveler type as solo, couple, family, or friends when stated. Extract durationDays as an integer when the user says how many days they want (1–21). Supported keys: destination, origin, travelers:{type:solo|couple|family|friends,adults,childrenAges}, startDate, endDate, durationDays, dateFlexibility, interests, pace, budget, mustSee, avoid, skippedSlots. Only provide travelers.adults when the user explicitly gives an adult/group count; selecting Family or Friends alone is not a count. If the user explicitly skips the currently requested optional detail, set skippedSlots to include its slot id: origin, travelers, dates, or preferences. Keep acknowledgement friendly and short, without asking a question. Do not mention internal tools or hidden reasoning.`,
      userPrompt: JSON.stringify({ currentBrief: brief, nextQuestion, latestMessage: userMessage }),
      maxOutputTokens: 350,
    });

    const patch = { ...(extraction?.patch || {}) };
    if (patch.travelers && typeof patch.travelers === 'object') {
      const type = patch.travelers.type || brief.travelers?.type;
      const hasExplicitGroupSize = /\b[1-9]\d*\s*(?:people|persons?|travell?ers?|adults?|members?)\b/i.test(userMessage)
        || /\b(?:family|group)\s+of\s+(?:one|two|three|four|five|six|[1-9]\d*)\b/i.test(userMessage)
        || /\b\d+\s+of\s+us\b/i.test(userMessage);
      if (['family', 'friends'].includes(type)) {
        patch.travelers = { ...patch.travelers, countProvided: hasExplicitGroupSize };
        if (!hasExplicitGroupSize) delete patch.travelers.adults;
      }
    }

    const updatedBrief = mergeBrief(brief, patch);
    const acknowledgement = typeof extraction?.acknowledgement === 'string'
      ? extraction.acknowledgement.trim().slice(0, 240)
      : '';
    const followUp = canGenerateTrip(updatedBrief)
      ? 'I have enough to make a first draft. You can generate it now, or tell me one more thing to shape the trip.'
      : getNextQuestion(updatedBrief);

    return {
      updatedBrief,
      assistantMessage: [acknowledgement, followUp].filter(Boolean).join(' '),
    };
  };

  return new StateGraph(IntakeState)
    .addNode('update_brief', updateBrief)
    .addEdge(START, 'update_brief')
    .addEdge('update_brief', END)
    .compile();
}

const graphCache = new WeakMap();

export async function runIntakeTurn({ brief, userMessage, env }) {
  let graph = env && typeof env === 'object' ? graphCache.get(env) : null;
  if (!graph) {
    graph = createIntakeGraph(env);
    if (env && typeof env === 'object') graphCache.set(env, graph);
  }
  return graph.invoke({ brief, userMessage });
}
