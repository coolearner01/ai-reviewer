import { buildProvider } from '../../providers';
import type { ProviderAdapter } from '../../providers/base';
import { organizationService } from '../organizations/organizationService';
import { AppError } from '../../errors/AppError';
import type { Provider } from '../../types';

export interface ResolveProviderInput {
  organizationId: string | null | undefined;
  provider: Provider;
  /** Context string for log messages (e.g. '[pipeline]'). */
  logContext?: string;
}

const MISSING_CREDENTIALS_MESSAGE =
  'No git provider credentials configured. Connect this repository to an ' +
  'organization and add its API key under Settings → API Keys.';

/**
 * Resolve the Git provider adapter for a repo/review.
 *
 * Credentials always come from the user: the repository's organization holds
 * the encrypted API key (configured in Settings → API Keys). There is no
 * environment-variable fallback — if the repo has no organization or the org
 * has no usable key, we fail with a clear, actionable error.
 */
export async function resolveProviderFor(
  input: ResolveProviderInput,
): Promise<ProviderAdapter> {
  const { organizationId } = input;
  if (!organizationId) {
    throw AppError.badRequest(MISSING_CREDENTIALS_MESSAGE);
  }

  const org = await organizationService.findById(organizationId);
  if (!org) {
    throw AppError.badRequest(MISSING_CREDENTIALS_MESSAGE);
  }

  const { apiKey } = organizationService.getCredentials(org);
  if (!apiKey) {
    throw AppError.badRequest(MISSING_CREDENTIALS_MESSAGE);
  }

  return buildProvider({ provider: org.provider as Provider, token: apiKey });
}
