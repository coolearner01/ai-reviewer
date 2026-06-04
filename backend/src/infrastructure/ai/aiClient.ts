import axios, { AxiosError } from 'axios';
import Anthropic from '@anthropic-ai/sdk';
import { isUsableKey } from '../../config';
import { logger } from '../../utils/logger';
import { AppError } from '../../errors/AppError';
import type { AiProvider } from '../../modules/settings/aiProviderSettings';
import type { ResolvedAiCallConfig, ResolvedAiCredentials } from '../../modules/settings/aiConfigResolver';

/**
 * Unified AI client — Anthropic, Gemini, OpenAI, and OpenRouter.
 *
 * Credentials always come from user/org settings (Settings → Models), passed
 * in as `req.credentials`: the resolved provider is tried first, then its
 * fallbacks. There is no environment-variable fallback.
 */

const MAX_TOKENS = 4096;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Attribution headers OpenRouter shows in its dashboard. Not secret.
const OPENROUTER_SITE_URL = 'http://localhost:3000';
const OPENROUTER_APP_NAME = 'PR Review AI';

export type AiCompletionProvider = AiProvider;

export interface CompletionRequest {
  systemPrompt: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
  /** Per-review credentials from user/org settings. */
  credentials?: ResolvedAiCallConfig;
}

export interface CompletionResult {
  text: string;
  provider: AiCompletionProvider;
  model: string;
}

let lastProviderError: { ts: number; message: string } | null = null;

export const aiHealth = {
  recordError(message: string): void {
    lastProviderError = { ts: Date.now(), message };
  },
  consumeRecent(maxAgeMs = 5 * 60_000): string | null {
    if (!lastProviderError) return null;
    if (Date.now() - lastProviderError.ts > maxAgeMs) {
      lastProviderError = null;
      return null;
    }
    const message = lastProviderError.message;
    lastProviderError = null;
    return message;
  },
  reset(): void {
    lastProviderError = null;
  },
};

export const aiClient = {
  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const maxTokens = req.maxTokens ?? MAX_TOKENS;

    if (!req.credentials?.apiKey) {
      const message =
        'No AI provider configured — add an API key in Settings → Models.';
      aiHealth.recordError(message);
      throw AppError.internal(message);
    }

    return completeWithChain(req, maxTokens, [
      req.credentials,
      ...req.credentials.fallbacks,
    ]);
  },
};

async function completeWithChain(
  req: CompletionRequest,
  maxTokens: number,
  chain: ResolvedAiCredentials[],
): Promise<CompletionResult> {
  const usable = chain.filter((c) => isUsableKey(c.apiKey));
  if (usable.length === 0) {
    const message = 'No AI provider configured — add an API key in Settings → Models.';
    aiHealth.recordError(message);
    throw AppError.internal(message);
  }

  let lastErr: unknown;
  for (let i = 0; i < usable.length; i++) {
    const cred = usable[i]!;
    try {
      const text = await callProvider(cred, req, maxTokens);
      return {
        text,
        provider: cred.provider,
        model: req.model ?? cred.model,
      };
    } catch (err) {
      lastErr = err;
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[ai] provider failed', { provider: cred.provider, error: message });
      aiHealth.recordError(`${cred.provider}: ${message}`);
      if (i < usable.length - 1) continue;
    }
  }
  throw lastErr;
}

async function callProvider(
  cred: ResolvedAiCredentials,
  req: CompletionRequest,
  maxTokens: number,
): Promise<string> {
  const model = req.model ?? cred.model;
  switch (cred.provider) {
    case 'anthropic':
      return callAnthropic(req, maxTokens, cred.apiKey, model);
    case 'gemini':
      return callGemini(req, maxTokens, cred.apiKey, model);
    case 'openai':
      return callOpenAI(req, maxTokens, cred.apiKey, model);
    case 'openrouter':
      return callOpenRouter(req, maxTokens, cred.apiKey, model);
  }
}

async function callAnthropic(
  req: CompletionRequest,
  maxTokens: number,
  apiKey: string,
  model: string,
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: req.systemPrompt,
    messages: [{ role: 'user', content: req.userMessage }],
  });
  return collectAnthropicText(response.content);
}

function collectAnthropicText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .map((block) => {
      if (
        block &&
        typeof block === 'object' &&
        'type' in block &&
        (block as { type: string }).type === 'text'
      ) {
        return (block as { text: string }).text;
      }
      return '';
    })
    .join('\n');
}

async function callGemini(
  req: CompletionRequest,
  maxTokens: number,
  apiKey: string,
  model: string,
): Promise<string> {
  const url = `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`;
  const res = await axios.post(
    url,
    {
      systemInstruction: { parts: [{ text: req.systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: req.userMessage }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    },
    {
      timeout: 120_000,
      params: { key: apiKey },
      headers: { 'Content-Type': 'application/json' },
    },
  );

  const parts = res.data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    logger.warn('[ai] gemini returned no text', {
      preview: JSON.stringify(res.data).slice(0, 200),
    });
    return '';
  }
  return parts
    .map((p: { text?: string }) => (typeof p?.text === 'string' ? p.text : ''))
    .join('\n');
}

async function callOpenAI(
  req: CompletionRequest,
  maxTokens: number,
  apiKey: string,
  model: string,
): Promise<string> {
  const res = await axios.post(
    OPENAI_URL,
    {
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userMessage },
      ],
    },
    {
      timeout: 120_000,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    },
  );

  const choice = res.data?.choices?.[0]?.message?.content;
  if (typeof choice !== 'string') {
    logger.warn('[ai] openai returned no text', {
      preview: JSON.stringify(res.data).slice(0, 200),
    });
    return '';
  }
  return choice;
}

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const OPENROUTER_MAX_ATTEMPTS = 3;

async function callOpenRouter(
  req: CompletionRequest,
  maxTokens: number,
  apiKey: string,
  model: string,
): Promise<string> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= OPENROUTER_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await axios.post(
        OPENROUTER_URL,
        {
          model,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: req.systemPrompt },
            { role: 'user', content: req.userMessage },
          ],
        },
        {
          timeout: 120_000,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': OPENROUTER_SITE_URL,
            'X-Title': OPENROUTER_APP_NAME,
          },
        },
      );

      const choice = res.data?.choices?.[0]?.message?.content;
      if (typeof choice !== 'string') {
        logger.warn('[ai] openrouter returned no text', {
          preview: JSON.stringify(res.data).slice(0, 200),
        });
        return '';
      }
      return choice;
    } catch (err) {
      lastErr = err;
      const status = err instanceof AxiosError ? err.response?.status : undefined;
      const isRetryable = status === undefined || RETRYABLE_STATUSES.has(status);

      if (isRetryable && attempt < OPENROUTER_MAX_ATTEMPTS) {
        const delayMs = (attempt === 1 ? 1_000 : 3_000) + Math.floor(Math.random() * 500);
        logger.warn('[ai] openrouter transient failure — retrying', {
          attempt,
          status: status ?? 'network',
        });
        await sleep(delayMs);
        continue;
      }

      if (status === 404 && model !== 'openrouter/free') {
        logger.warn('[ai] openrouter model not found — trying openrouter/free', { model });
        return callOpenRouter(req, maxTokens, apiKey, 'openrouter/free');
      }
      break;
    }
  }

  if (lastErr instanceof AxiosError) {
    const status = lastErr.response?.status;
    throw AppError.external(buildOpenRouterErrorMessage(status, lastErr.message, model));
  }
  throw lastErr;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildOpenRouterErrorMessage(
  status: number | undefined,
  fallback: string,
  model: string,
): string {
  if (status === 402) {
    return (
      'OpenRouter request rejected (402 Payment Required) — account is out of credit. ' +
      'Add credit at https://openrouter.ai/credits or switch to a free model.'
    );
  }
  if (status === 401) {
    return 'OpenRouter request rejected (401 Unauthorized) — API key is missing or invalid.';
  }
  if (status === 429) {
    return 'OpenRouter rate-limited (429) — try again or pick a different model.';
  }
  if (status === 404) {
    return `OpenRouter model not found (404) — "${model}" has no live endpoint. See https://openrouter.ai/models`;
  }
  if (status === 503) {
    return 'OpenRouter upstream unavailable (503) — retries exhausted; try again shortly.';
  }
  return `OpenRouter request failed (${status ?? 'network'}): ${fallback}`;
}
