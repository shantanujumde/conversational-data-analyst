import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { AiConfig } from '../config';
import { createMockPlanner } from './mockPlanner';
import { createAiPlanner, type Planner } from './planner';

/** Picks the planner from config: Gemini or OpenAI through the AI SDK, or the keyword mock. */
export function createPlanner(config: AiConfig): Planner {
  switch (config.AI_PROVIDER) {
    case 'mock':
      return createMockPlanner();
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey: config.API_KEY });
      return createAiPlanner(google(config.AI_MODEL), {
        provider: 'google',
        model: config.AI_MODEL,
      });
    }
    case 'openai': {
      const openai = createOpenAI({ apiKey: config.API_KEY });
      return createAiPlanner(openai(config.AI_MODEL), {
        provider: 'openai',
        model: config.AI_MODEL,
      });
    }
  }
}
