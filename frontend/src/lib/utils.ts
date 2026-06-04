import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow } from 'date-fns';

/** Merge Tailwind classes without conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

/**
 * Risk score → Tailwind classes. Tuned for the GitHub-dark canvas:
 * green/amber/red translucent fills with matching foreground text.
 */
export function riskScoreClass(score: number): string {
  if (score >= 70) return 'bg-gh-red/15 text-[#f85149] border-gh-red/50';
  if (score >= 40) return 'bg-gh-yellow/15 text-[#e3b341] border-gh-yellow/50';
  return 'bg-gh-accent/20 text-[#3fb950] border-gh-accent/60';
}

export const severityColors = {
  critical: {
    bg: 'bg-gh-red/10',
    border: 'border-gh-red/50',
    text: 'text-[#f85149]',
    badge: 'bg-gh-red/15 text-[#f85149] border border-gh-red/50',
    dot: 'bg-[#f85149]',
  },
  high: {
    bg: 'bg-gh-orange/10',
    border: 'border-gh-orange/50',
    text: 'text-[#f0883e]',
    badge: 'bg-gh-orange/15 text-[#f0883e] border border-gh-orange/50',
    dot: 'bg-[#f0883e]',
  },
  medium: {
    bg: 'bg-gh-yellow/10',
    border: 'border-gh-yellow/50',
    text: 'text-[#e3b341]',
    badge: 'bg-gh-yellow/15 text-[#e3b341] border border-gh-yellow/50',
    dot: 'bg-[#e3b341]',
  },
  low: {
    bg: 'bg-gh-blue/10',
    border: 'border-gh-blue/50',
    text: 'text-[#58a6ff]',
    badge: 'bg-gh-blue/15 text-[#58a6ff] border border-gh-blue/50',
    dot: 'bg-[#58a6ff]',
  },
} as const;

export const mergeColors = {
  APPROVE: {
    bg: 'bg-gh-accent/15',
    border: 'border-gh-accent/60',
    text: 'text-[#3fb950]',
    label: '✓ Approve',
  },
  APPROVE_WITH_MINOR_SUGGESTIONS: {
    bg: 'bg-gh-blue/15',
    border: 'border-gh-blue/60',
    text: 'text-[#58a6ff]',
    label: '~ Approve with suggestions',
  },
  NEEDS_CHANGES: {
    bg: 'bg-gh-yellow/15',
    border: 'border-gh-yellow/60',
    text: 'text-[#e3b341]',
    label: '⚠ Needs changes',
  },
  BLOCK_MERGE: {
    bg: 'bg-gh-red/15',
    border: 'border-gh-red/60',
    text: 'text-[#f85149]',
    label: '✕ Block merge',
  },
} as const;

export const agentLabels: Record<string, string> = {
  security: 'Security',
  performance: 'Performance',
  architecture: 'Architecture',
  concurrency: 'Concurrency',
  scalability: 'Scalability',
  business_logic: 'Business Logic',
  test_quality: 'Test Quality',
  api_contract: 'API Contract',
  database: 'Database',
  frontend_quality: 'Frontend Quality',
  holistic_review: 'Code Review',
};
