/** The four example questions from the brief, in the brief's order: the UI's empty state. */
export const BRIEF_QUESTIONS: readonly string[] = [
  'Show monthly onboarding applications by customer segment',
  'Which branches have the highest rejection rate?',
  'Compare retail and SME onboarding volumes',
  'Show the top five customers by transaction value',
];

/** Every example the catalog can answer: the brief's four plus more, so every dataset is covered. */
export const EXAMPLE_QUESTIONS: readonly string[] = [
  ...BRIEF_QUESTIONS,
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
