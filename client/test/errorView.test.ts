import { describe, expect, it } from 'vitest';
import { errorView, rateLimitMessage } from '../src/lib/errorView';

describe('rateLimitMessage', () => {
  it('counts down with the seconds left', () => {
    expect(rateLimitMessage(42)).toBe('Too many questions at once. Try again in 42 seconds.');
    expect(rateLimitMessage(1)).toBe('Too many questions at once. Try again in 1 second.');
  });

  it('says the user can try again once the wait is over', () => {
    expect(rateLimitMessage(0)).toBe('Too many questions at once. You can try again now.');
  });
});

describe('errorView', () => {
  it('has a rate-limit fallback in the spec style', () => {
    expect(errorView.RATE_LIMITED.fallbackMessage).toBe(
      'Too many questions at once. Try again in a few seconds.',
    );
  });
});
