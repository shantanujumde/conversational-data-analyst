/** Example questions the catalog can answer: the UI's empty state and refusal suggestions. */
export const EXAMPLE_QUESTIONS: readonly string[] = [
  // The four questions from the brief.
  'Show monthly onboarding applications by customer segment',
  'Which branches have the highest rejection rate?',
  'Compare retail and SME onboarding volumes',
  'Show the top five customers by transaction value',
  // More, so every dataset is covered.
  'How many onboarding applications were rejected?',
  'Show approval and rejection rate by region and channel',
  'Show monthly transaction value',
  'How many customers does each region have?',
];

/** The three questions offered when a question can't be answered. */
export const SUGGESTIONS: readonly string[] = [
  'Which branches have the highest rejection rate?',
  'Show monthly onboarding applications by customer segment',
  'Show the top five customers by transaction value',
];
