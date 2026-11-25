import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { AiConfig } from '../config';
import { createMockPlanner } from './mockPlanner';
import { createAiPlanner, type Planner } from './planner';

/** Picks the planner from config: Gemini through the AI SDK, or the keyword mock. */
export function createPlanner(config: AiConfig): Planner {
  if (config.AI_PROVIDER === 'mock') return createMockPlanner();
  const google = createGoogleGenerativeAI({ apiKey: config.GEMINI_API_KEY });
  return createAiPlanner(google(config.AI_MODEL), config.AI_MODEL);
}
