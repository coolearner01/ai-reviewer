import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../providers', () => ({
  buildProvider: vi.fn(() => ({ name: 'org' })),
}));

vi.mock('../organizations/organizationService', () => ({
  organizationService: {
    findById: vi.fn(),
    getCredentials: vi.fn(() => ({ apiKey: 'token', webhookSecret: 'secret' })),
  },
}));

import { buildProvider } from '../../providers';
import { organizationService } from '../organizations/organizationService';
import { resolveProviderFor } from './providerResolver';

const ORG_ROW = {
  id: 'org-1',
  userId: 'u1',
  name: 'Acme',
  slug: 'acme',
  provider: 'github',
  apiKeyEncrypted: 'x',
  webhookSecretEncrypted: 'y',
  webhookSlug: 'slug',
  createdAt: new Date(),
};

describe('resolveProviderFor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when there is no organization', async () => {
    await expect(
      resolveProviderFor({ organizationId: null, provider: 'github' }),
    ).rejects.toThrow(/credentials/i);
    expect(buildProvider).not.toHaveBeenCalled();
  });

  it('uses org credentials when organization exists', async () => {
    vi.mocked(organizationService.findById).mockResolvedValue(ORG_ROW);
    const adapter = await resolveProviderFor({
      organizationId: 'org-1',
      provider: 'github',
    });
    expect(buildProvider).toHaveBeenCalledWith({ provider: 'github', token: 'token' });
    expect(adapter).toEqual({ name: 'org' });
  });

  it('throws when the org row is missing', async () => {
    vi.mocked(organizationService.findById).mockResolvedValue(null);
    await expect(
      resolveProviderFor({ organizationId: 'org-missing', provider: 'gitlab' }),
    ).rejects.toThrow(/credentials/i);
    expect(buildProvider).not.toHaveBeenCalled();
  });

  it('throws when the org has no usable api key', async () => {
    vi.mocked(organizationService.findById).mockResolvedValue(ORG_ROW);
    vi.mocked(organizationService.getCredentials).mockReturnValueOnce({
      apiKey: '',
      webhookSecret: 'secret',
    });
    await expect(
      resolveProviderFor({ organizationId: 'org-1', provider: 'github' }),
    ).rejects.toThrow(/credentials/i);
  });
});
