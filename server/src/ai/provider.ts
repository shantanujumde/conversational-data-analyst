import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { Config } from '../config';
import { createMockPlanner } from './mockPlanner';
import { createAiPlanner, type Planner } from './planner';

/** Picks the planner from config: Gemini through the AI SDK, or the keyword mock. */
export function createPlanner(
  config: Pick<Config, 'AI_PROVIDER' | 'AI_MODEL' | 'GEMINI_API_KEY'>,
): Planner {
  if (config.AI_PROVIDER === 'mock') return createMockPlanner();
  if (!config.GEMINI_API_KEY) {
    // loadConfig already refuses this; kept so a hand-built config fails loudly too.
    throw new Error('GEMINI_API_KEY is required when AI_PROVIDER is google');
  }
  const google = createGoogleGenerativeAI({ apiKey: config.GEMINI_API_KEY });
  return createAiPlanner(google(config.AI_MODEL), config.AI_MODEL);
}
