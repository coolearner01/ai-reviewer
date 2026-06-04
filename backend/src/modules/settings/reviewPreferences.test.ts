import { describe, it, expect } from 'vitest';
import { buildPromptAdditions, mapReviewPreferenceRow } from './reviewPreferences';

describe('buildPromptAdditions', () => {
  it('joins non-empty policy sections', () => {
    const result = buildPromptAdditions({
      defaultReviewDepth: 'standard',
      defaultFocusAreas: [],
      ignoredPaths: [],
      customInstructions: 'Be strict',
      securityPolicies: 'No secrets in code',
      architectureRules: '',
      codingGuidelines: 'Use TypeScript',
    });
    expect(result).toContain('SECURITY POLICIES');
    expect(result).toContain('No secrets in code');
    expect(result).toContain('Be strict');
    expect(result).not.toContain('ARCHITECTURE RULES');
  });

  it('prefixes org labels', () => {
    const result = buildPromptAdditions(
      {
        defaultReviewDepth: 'standard',
        defaultFocusAreas: [],
        ignoredPaths: [],
        customInstructions: '',
        securityPolicies: 'Org rule',
        architectureRules: '',
        codingGuidelines: '',
      },
      'ORG ',
    );
    expect(result).toContain('ORG SECURITY POLICIES');
  });
});

describe('mapReviewPreferenceRow', () => {
  it('maps snake_case to camelCase', () => {
    expect(
      mapReviewPreferenceRow({
        default_review_depth: 'deep',
        default_focus_areas: ['security'],
        ignored_paths: ['dist/'],
        custom_instructions: 'x',
        security_policies: 'y',
        architecture_rules: 'z',
        coding_guidelines: 'w',
      }),
    ).toEqual({
      defaultReviewDepth: 'deep',
      defaultFocusAreas: ['security'],
      ignoredPaths: ['dist/'],
      customInstructions: 'x',
      securityPolicies: 'y',
      architectureRules: 'z',
      codingGuidelines: 'w',
    });
  });
});
