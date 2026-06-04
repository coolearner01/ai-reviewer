import { GitHubProvider } from './github';
import { GitLabProvider } from './gitlab';
import { BitbucketProvider } from './bitbucket';
import { AppError } from '../errors/AppError';
import type { Provider } from '../types';
import type { ProviderAdapter } from './base';

/**
 * Build a provider adapter with an explicit API token, resolved from the
 * organization's encrypted credential (see `providerResolver`). Pass an
 * empty/undefined token only for token-less operations such as verifying a
 * webhook signature or extracting a PR URL from a webhook payload.
 */
export function buildProvider(input: {
  provider: Provider;
  token?: string;
}): ProviderAdapter {
  switch (input.provider) {
    case 'github':
      return input.token ? new GitHubProvider(input.token) : new GitHubProvider();
    case 'gitlab':
      return input.token ? new GitLabProvider(input.token) : new GitLabProvider();
    case 'bitbucket':
      return input.token ? new BitbucketProvider(input.token) : new BitbucketProvider();
    default:
      throw AppError.badRequest(`Unknown provider: ${input.provider as string}`);
  }
}

export type { ProviderAdapter };
