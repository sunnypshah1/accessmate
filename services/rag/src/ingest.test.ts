import { describe, expect, it } from 'vitest';
import { GuidelineIndex, __testing } from './ingest.js';

const { buildGuidelinesFromChecklist, parseWcagReference } = __testing;

describe('parseWcagReference', () => {
  it('extracts the WCAG code and title from combined strings', () => {
    const parsed = parseWcagReference('3.1.5 Reading Level');
    expect(parsed.code).toBe('3.1.5');
    expect(parsed.title).toBe('Reading Level');
  });

  it('falls back to the original value when parsing fails', () => {
    const parsed = parseWcagReference('Non standard value');
    expect(parsed.code).toBe('Non standard value');
    expect(parsed.title).toBe('');
  });
});

describe('GuidelineIndex', () => {
  const guidelines = buildGuidelinesFromChecklist();
  const index = new GuidelineIndex(guidelines);

  it('limits the number of matches returned', () => {
    const matches = index.search({ contextSnippet: 'form label accessible name' }, 2);
    expect(matches).toHaveLength(2);
    expect(matches[0].score).toBeGreaterThan(0);
    expect(matches[0].score).toBeGreaterThanOrEqual(matches[1].score);
  });

  it('boosts guidelines that match WCAG codes in the query text', () => {
    const matches = index.search(
      {
        ruleId: 'color-contrast',
        contextSnippet: 'Contrast issue fails WCAG 1.4.3 on text elements',
      },
      3,
    );

    expect(matches[0].wcagCode).toBe('1.4.3');
    expect(matches[0].citation).toContain('WCAG 1.4.3');
  });
});
