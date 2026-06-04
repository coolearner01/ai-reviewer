import type { ReviewPrompt as PrismaReviewPrompt } from '@prisma/client';
import { prisma } from '../../infrastructure/database/client';
import { AppError } from '../../errors/AppError';
import { logger } from '../../utils/logger';
import { DEFAULT_PROMPT_SEEDS } from './defaultPrompts';

export interface ReviewPromptDto {
  id: string;
  label: string;
  content: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewPromptInput {
  label: string;
  content: string;
  enabled?: boolean;
}

export interface UpdateReviewPromptInput {
  label?: string;
  content?: string;
  enabled?: boolean;
}

function toDto(row: PrismaReviewPrompt): ReviewPromptDto {
  return {
    id: row.id,
    label: row.label,
    content: row.content,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Seed any built-in default prompts the user is missing (matched by label).
 *
 * This keeps prompt content data-driven (editable/removable) instead of
 * hardcoded in the agent prompts, while preserving out-of-the-box behaviour.
 * Matching by label makes it idempotent and lets new defaults reach users who
 * were already seeded with an earlier set.
 */
async function ensureSeeded(userId: string): Promise<void> {
  const existing = await prisma.reviewPrompt.findMany({
    where: { userId },
    select: { label: true },
  });
  const existingLabels = new Set(existing.map((row) => row.label));
  const missing = DEFAULT_PROMPT_SEEDS.filter((seed) => !existingLabels.has(seed.label));
  if (missing.length === 0) return;
  try {
    await prisma.reviewPrompt.createMany({
      data: missing.map((seed) => ({ ...seed, userId })),
    });
  } catch (err) {
    // A concurrent request may have seeded already — non-fatal.
    logger.warn('[prompts] seed skipped', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export const reviewPromptService = {
  async listForUser(userId: string): Promise<ReviewPromptDto[]> {
    await ensureSeeded(userId);
    const rows = await prisma.reviewPrompt.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDto);
  },

  async create(userId: string, input: CreateReviewPromptInput): Promise<ReviewPromptDto> {
    const row = await prisma.reviewPrompt.create({
      data: {
        userId,
        label: input.label.trim(),
        content: input.content.trim(),
        enabled: input.enabled ?? true,
      },
    });
    return toDto(row);
  },

  async update(
    userId: string,
    id: string,
    input: UpdateReviewPromptInput,
  ): Promise<ReviewPromptDto> {
    await this.assertOwned(userId, id);
    const row = await prisma.reviewPrompt.update({
      where: { id },
      data: {
        ...(input.label !== undefined ? { label: input.label.trim() } : {}),
        ...(input.content !== undefined ? { content: input.content.trim() } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      },
    });
    return toDto(row);
  },

  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwned(userId, id);
    await prisma.reviewPrompt.delete({ where: { id } });
  },

  async assertOwned(userId: string, id: string): Promise<void> {
    const row = await prisma.reviewPrompt.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!row || row.userId !== userId) {
      throw AppError.notFound('Prompt not found');
    }
  },

  /**
   * Concatenated text of every enabled prompt for a user — injected into the
   * review's instructions so the model considers all selected prompts.
   */
  async getEnabledPromptText(userId: string): Promise<string> {
    await ensureSeeded(userId);
    const rows = await prisma.reviewPrompt.findMany({
      where: { userId, enabled: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows
      .map((row) => {
        const label = row.label.trim();
        const content = row.content.trim();
        if (!content) return '';
        return label ? `${label.toUpperCase()}:\n${content}` : content;
      })
      .filter(Boolean)
      .join('\n\n');
  },
};
