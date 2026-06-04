import { apiFetch } from './client';
import type { AgentType, ReviewDepth } from '@/types';
import type {
  AiProviderSettingsPatch,
  AiProviderSettingsValues,
} from '@/components/settings/AiProviderSettingsForm';

export interface UserSettings extends AiProviderSettingsValues {
  defaultReviewDepth: ReviewDepth;
  defaultFocusAreas: AgentType[];
  ignoredPaths: string[];
  customInstructions: string;
  securityPolicies: string;
  architectureRules: string;
  codingGuidelines: string;
  updatedAt: string;
}

export type UserSettingsPatch = Partial<
  Omit<UserSettings, 'keys' | 'updatedAt'>
> &
  AiProviderSettingsPatch;

export const settingsApi = {
  get: () => apiFetch<{ settings: UserSettings }>('/settings'),
  update: (patch: UserSettingsPatch) =>
    apiFetch<{ settings: UserSettings }>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
};
