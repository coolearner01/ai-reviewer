import { randomBytes } from 'node:crypto';
import { Prisma, type Organization } from '@prisma/client';
import { prisma } from '../../infrastructure/database/client';
import { tokenCrypto } from '../../utils/crypto';
import { AppError } from '../../errors/AppError';
import { assertOwnership } from '../shared/ownership';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { getBitbucketCredentialIssue } from '../../providers/bitbucket';
import type {
  OrganizationRecord,
  OrganizationSetupGuide,
  Provider,
} from '../../types';

/**
 * Build a URL-safe slug from a free-form organization name.
 * Falls back to a random suffix if the input slugifies to nothing.
 */
function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  if (base) return base;
  return 'org-' + randomBytes(3).toString('hex');
}

/** Mask a secret/api key for safe display in the UI: shows only the last 4 chars. */
function mask(value: string): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed.length <= 4) return '••••';
  return '••••' + trimmed.slice(-4);
}

function backendBaseUrl(): string {
  // FRONTEND_URL points to the web app; webhooks must hit the API. The API
  // listens on PORT. In production you'd put a real public URL in an env var,
  // but for local dev we synthesize one from PORT.
  if (config.PUBLIC_API_URL) return config.PUBLIC_API_URL.replace(/\/+$/, '');
  return `http://localhost:${config.PORT}`;
}

export function buildWebhookUrl(webhookSlug: string, provider: Provider): string {
  return `${backendBaseUrl()}/webhooks/${provider}/${webhookSlug}`;
}

/** Provider-specific instructions shown after org creation. */
export function buildSetupGuide(input: {
  provider: Provider;
  webhookSlug: string;
  webhookSecret: string;
}): OrganizationSetupGuide {
  const { provider, webhookSlug, webhookSecret } = input;
  const webhookUrl = buildWebhookUrl(webhookSlug, provider);

  if (provider === 'github') {
    return {
      provider,
      webhookUrl,
      webhookSecret,
      contentType: 'application/json',
      events: ['Pull requests'],
      steps: [
        'Open the target repository on GitHub → Settings → Webhooks → Add webhook.',
        `Payload URL: ${webhookUrl}`,
        'Content type: application/json',
        `Secret: ${webhookSecret}`,
        'SSL verification: Enable',
        'Which events? Select "Let me select individual events" and check only "Pull requests".',
        'Click "Add webhook". GitHub will send a ping event you can ignore.',
      ],
      docsUrl: 'https://docs.github.com/en/webhooks/using-webhooks/creating-webhooks',
    };
  }

  if (provider === 'gitlab') {
    return {
      provider,
      webhookUrl,
      webhookSecret,
      contentType: 'application/json',
      events: ['Merge request events'],
      steps: [
        'Open the project on GitLab → Settings → Webhooks → Add new webhook.',
        `URL: ${webhookUrl}`,
        `Secret token: ${webhookSecret}`,
        'Trigger: enable "Merge request events".',
        'Leave "Enable SSL verification" checked.',
        'Click "Add webhook" — GitLab will offer a "Test" button you can use to verify.',
      ],
      docsUrl: 'https://docs.gitlab.com/ee/user/project/integrations/webhooks.html',
    };
  }

  // Bitbucket
  return {
    provider,
    webhookUrl,
    webhookSecret,
    contentType: 'application/json',
    events: ['Pull request: Created, Updated'],
    steps: [
      'Open the repository on Bitbucket → Repository settings → Workflow → Webhooks → Add webhook.',
      `URL: ${webhookUrl}`,
      `Secret: ${webhookSecret}`,
      'Triggers → Pull Request: check "Created" and "Updated".',
      'Leave "Active" enabled and click Save.',
    ],
    docsUrl:
      'https://support.atlassian.com/bitbucket-cloud/docs/manage-webhooks/',
  };
}

export const organizationService = {
  /**
   * Create a new organization for the calling user. Generates a unique
   * webhook_slug + webhook secret and stores the api key encrypted at rest.
   */
  async create(input: {
    userId: string;
    name: string;
    provider: Provider;
    apiKey: string;
  }): Promise<{ organization: OrganizationRecord; setupGuide: OrganizationSetupGuide }> {
    const trimmedKey = input.apiKey.trim();
    if (trimmedKey.length < 8) {
      throw AppError.badRequest('API key looks too short — please paste the full token');
    }
    if (input.provider === 'bitbucket') {
      const issue = getBitbucketCredentialIssue(trimmedKey);
      if (issue) throw AppError.badRequest(issue);
    }

    const slug = await this.allocateSlug(input.userId, input.name);
    const webhookSlug = randomBytes(12).toString('hex');
    const webhookSecret = randomBytes(24).toString('hex');

    const apiKeyEncrypted = tokenCrypto.encrypt(trimmedKey);
    const webhookSecretEncrypted = tokenCrypto.encrypt(webhookSecret);

    const inserted = await prisma.organization.create({
      data: {
        userId: input.userId,
        name: input.name.trim(),
        slug,
        provider: input.provider,
        apiKeyEncrypted,
        webhookSecretEncrypted,
        webhookSlug,
      },
    });

    const org = toRecord(inserted, { apiKeyPlain: trimmedKey });
    const setupGuide = buildSetupGuide({
      provider: input.provider,
      webhookSlug,
      webhookSecret,
    });
    return { organization: org, setupGuide };
  },

  async list(userId: string): Promise<OrganizationRecord[]> {
    const rows = await prisma.organization.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => toRecord(row, { apiKeyPlain: safeDecrypt(row.apiKeyEncrypted) }));
  },

  async findById(id: string): Promise<Organization | null> {
    return prisma.organization.findUnique({ where: { id } });
  },

  async findBySlug(userId: string, slug: string): Promise<Organization | null> {
    return prisma.organization.findUnique({
      where: { userId_slug: { userId, slug } },
    });
  },

  async findByWebhookSlug(webhookSlug: string): Promise<Organization | null> {
    return prisma.organization.findUnique({ where: { webhookSlug } });
  },

  async assertOwned(id: string, userId: string): Promise<Organization> {
    return assertOwnership(await this.findById(id), userId, 'Organization not found');
  },

  /**
   * Server-only — returns the DECRYPTED api key + webhook secret.
   * Never expose this through an HTTP route.
   */
  getCredentials(row: Organization): { apiKey: string; webhookSecret: string } {
    return {
      apiKey: tokenCrypto.decrypt(row.apiKeyEncrypted),
      webhookSecret: tokenCrypto.decrypt(row.webhookSecretEncrypted),
    };
  },

  toPublic(row: Organization): OrganizationRecord {
    return toRecord(row, { apiKeyPlain: safeDecrypt(row.apiKeyEncrypted) });
  },

  buildSetupGuide(row: Organization): OrganizationSetupGuide {
    return buildSetupGuide({
      provider: row.provider as Provider,
      webhookSlug: row.webhookSlug,
      webhookSecret: tokenCrypto.decrypt(row.webhookSecretEncrypted),
    });
  },

  /**
   * Permanently delete an organization and **all** of its data.
   *
   * The database FKs cascade from organizations → repositories → pull_requests
   * → (pr_commits, pr_checks, pr_timeline, reviews → review_comments) and
   * organization_settings, so a single DELETE on the org row clears every
   * relational record the user could see in the UI.
   */
  async remove(id: string, userId: string): Promise<void> {
    const row = await this.assertOwned(id, userId);

    await prisma.organization.delete({ where: { id: row.id } });

    logger.info('[organizations] removed', {
      organizationId: row.id,
      userId,
    });
  },

  /**
   * Patch the org's display name and/or rotate the API key.
   *
   * Each field is optional — pass only what you want to change. Returns the
   * updated public record (no secrets).
   */
  async update(input: {
    id: string;
    userId: string;
    name?: string;
    apiKey?: string;
  }): Promise<OrganizationRecord> {
    const row = await this.assertOwned(input.id, input.userId);

    const data: Prisma.OrganizationUpdateInput = {};

    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (!trimmed) throw AppError.badRequest('Name cannot be empty');
      data.name = trimmed;
    }

    if (input.apiKey !== undefined) {
      const trimmedKey = input.apiKey.trim();
      if (trimmedKey.length < 8) {
        throw AppError.badRequest('API key looks too short — please paste the full token');
      }
      if (row.provider === 'bitbucket') {
        const issue = getBitbucketCredentialIssue(trimmedKey);
        if (issue) throw AppError.badRequest(issue);
      }
      data.apiKeyEncrypted = tokenCrypto.encrypt(trimmedKey);
    }

    if (Object.keys(data).length === 0) {
      return toRecord(row, { apiKeyPlain: safeDecrypt(row.apiKeyEncrypted) });
    }

    const updatedRow = await prisma.organization.update({ where: { id: row.id }, data });
    const apiKeyPlain = input.apiKey ?? safeDecrypt(updatedRow.apiKeyEncrypted);
    return toRecord(updatedRow, { apiKeyPlain });
  },

  /** Rotate the webhook secret — useful if the user accidentally leaked it. */
  async rotateWebhookSecret(id: string, userId: string): Promise<OrganizationSetupGuide> {
    const row = await this.assertOwned(id, userId);
    const newSecret = randomBytes(24).toString('hex');
    await prisma.organization.update({
      where: { id: row.id },
      data: { webhookSecretEncrypted: tokenCrypto.encrypt(newSecret) },
    });
    return buildSetupGuide({
      provider: row.provider as Provider,
      webhookSlug: row.webhookSlug,
      webhookSecret: newSecret,
    });
  },

  /**
   * Find a slug that doesn't already exist for this user. Appends -2, -3, ...
   * until it lands on one that's free.
   */
  async allocateSlug(userId: string, name: string): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    let suffix = 2;
    // Worst case we'll exit after a handful of tries; the unique index is the
    // ultimate safety net.
    while (await this.findBySlug(userId, candidate)) {
      candidate = `${base}-${suffix++}`;
      if (suffix > 50) {
        candidate = `${base}-${randomBytes(3).toString('hex')}`;
        break;
      }
    }
    return candidate;
  },
};

function toRecord(row: Organization, opts: { apiKeyPlain: string }): OrganizationRecord {
  const provider = row.provider as Provider;
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    slug: row.slug,
    provider,
    webhookSlug: row.webhookSlug,
    webhookUrl: buildWebhookUrl(row.webhookSlug, provider),
    apiKeyMasked: mask(opts.apiKeyPlain),
    createdAt: row.createdAt.toISOString(),
  };
}

/** Decrypt that swallows errors (returns '') so a bad row doesn't break list endpoints. */
function safeDecrypt(encrypted: string): string {
  try {
    return tokenCrypto.decrypt(encrypted);
  } catch {
    return '';
  }
}
