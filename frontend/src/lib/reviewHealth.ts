import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { ReviewHealth } from '@/types';

/**
 * Health-badge metadata (label, badge classes, icon) for the holistic
 * reviewer's PR-level signal. Shared by the summary panel and the review
 * overview tab so the badge looks identical everywhere it appears.
 */
export const HEALTH_META: Record<
  ReviewHealth,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  good: {
    label: 'Healthy',
    className: 'bg-gh-accent/15 text-[#3fb950] border-gh-accent/40',
    Icon: CheckCircle2,
  },
  needs_work: {
    label: 'Needs work',
    className: 'bg-gh-yellow/15 text-[#e3b341] border-gh-yellow/40',
    Icon: AlertTriangle,
  },
  critical: {
    label: 'Critical',
    className: 'bg-gh-red/15 text-gh-red border-gh-red/40',
    Icon: ShieldAlert,
  },
};
