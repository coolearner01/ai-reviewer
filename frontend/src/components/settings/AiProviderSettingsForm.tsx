'use client';

import { useEffect, useState, type ComponentType } from 'react';
import {
  Bot,
  Brain,
  Check,
  ChevronDown,
  CircleCheck,
  Eye,
  EyeOff,
  Gem,
  Lock,
  Route,
  Sparkles,
} from 'lucide-react';
import { Spinner } from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';
import {
  AI_PROVIDERS,
  AI_PROVIDER_LABELS,
  AI_PROVIDER_SUBLABELS,
  DEFAULT_MODEL_HINTS,
  PROVIDER_MODEL_OPTIONS,
  type AiProvider,
} from '@/lib/constants/aiProviders';

export interface AiKeyStatus {
  configured: boolean;
  masked: string | null;
}

export interface AiProviderSettingsValues {
  aiProvider: AiProvider | '';
  anthropicModel: string;
  geminiModel: string;
  openaiModel: string;
  openrouterModel: string;
  keys: {
    anthropic: AiKeyStatus;
    gemini: AiKeyStatus;
    openai: AiKeyStatus;
    openrouter: AiKeyStatus;
  };
}

export interface AiProviderSettingsPatch {
  aiProvider?: AiProvider | '';
  anthropicApiKey?: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  openrouterApiKey?: string;
  anthropicModel?: string;
  geminiModel?: string;
  openaiModel?: string;
  openrouterModel?: string;
}

type IconType = ComponentType<{ className?: string }>;

const PROVIDER_META: Record<
  AiProvider,
  { icon: IconType; iconWrap: string }
> = {
  anthropic: { icon: Brain, iconWrap: 'bg-[#2a1f35] text-[#a78bfa]' },
  gemini: { icon: Gem, iconWrap: 'bg-[#1a2835] text-[#4f8ef7]' },
  openai: { icon: Bot, iconWrap: 'bg-[#1a2a1a] text-[#4ade80]' },
  openrouter: { icon: Route, iconWrap: 'bg-[#2a2515] text-[#facc15]' },
};

const KEY_PLACEHOLDERS: Record<AiProvider, string> = {
  anthropic: 'sk-ant-...',
  gemini: 'AIza...',
  openai: 'sk-...',
  openrouter: 'sk-or-...',
};

export function AiProviderSettingsForm({
  values,
  onSave,
  saving,
  description,
}: {
  values: AiProviderSettingsValues;
  onSave: (patch: AiProviderSettingsPatch) => void;
  saving: boolean;
  description?: string;
}) {
  const [provider, setProvider] = useState<AiProvider | ''>(values.aiProvider);
  const [models, setModels] = useState({
    anthropic: values.anthropicModel,
    gemini: values.geminiModel,
    openai: values.openaiModel,
    openrouter: values.openrouterModel,
  });
  const [keyInputs, setKeyInputs] = useState({
    anthropic: '',
    gemini: '',
    openai: '',
    openrouter: '',
  });

  const reset = () => {
    setProvider(values.aiProvider);
    setModels({
      anthropic: values.anthropicModel,
      gemini: values.geminiModel,
      openai: values.openaiModel,
      openrouter: values.openrouterModel,
    });
    setKeyInputs({ anthropic: '', gemini: '', openai: '', openrouter: '' });
  };

  useEffect(reset, [values]);

  const handleSave = () => {
    const patch: AiProviderSettingsPatch = {
      aiProvider: provider,
      anthropicModel: models.anthropic,
      geminiModel: models.gemini,
      openaiModel: models.openai,
      openrouterModel: models.openrouter,
    };
    if (keyInputs.anthropic.trim()) patch.anthropicApiKey = keyInputs.anthropic.trim();
    if (keyInputs.gemini.trim()) patch.geminiApiKey = keyInputs.gemini.trim();
    if (keyInputs.openai.trim()) patch.openaiApiKey = keyInputs.openai.trim();
    if (keyInputs.openrouter.trim()) patch.openrouterApiKey = keyInputs.openrouter.trim();
    onSave(patch);
  };

  const providerSub = (p: AiProvider): string => {
    const model = models[p].trim() || DEFAULT_MODEL_HINTS[p];
    const keyState = values.keys[p].configured ? 'Active key' : 'No key';
    return `${model} · ${keyState}`;
  };

  return (
    <div className="space-y-8">
      {description && (
        <p className="rounded-lg border border-gh-border-muted bg-gh-surface-2 px-4 py-3 text-sm text-gh-text-muted">
          {description}
        </p>
      )}

      {/* Active provider */}
      <section>
        <h3 className="text-base font-medium text-gh-text">Active AI provider</h3>
        <p className="text-sm text-gh-text-muted mt-1 mb-4">
          Reviews use this provider&apos;s model. Other configured providers are used as fallbacks
          if the primary fails.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <ProviderCard
            active={provider === ''}
            onClick={() => setProvider('')}
            icon={Sparkles}
            iconWrap="bg-gh-surface-2 text-gh-text-muted"
            name={
              <span className="flex items-center gap-2">
                Auto
                <span className="text-[10px] rounded-full bg-gh-surface-2 border border-gh-border px-2 py-0.5 text-gh-text-muted font-medium">
                  first key found
                </span>
              </span>
            }
            sub="Automatically selects an available provider"
          />
          {AI_PROVIDERS.map((p) => {
            const meta = PROVIDER_META[p];
            return (
              <ProviderCard
                key={p}
                active={provider === p}
                onClick={() => setProvider(p)}
                icon={meta.icon}
                iconWrap={meta.iconWrap}
                name={AI_PROVIDER_LABELS[p]}
                sub={p === 'openrouter' ? AI_PROVIDER_SUBLABELS[p] : providerSub(p)}
              />
            );
          })}
        </div>
      </section>

      <div className="h-px bg-gh-border-muted" />

      {/* Models per provider */}
      <section>
        <h3 className="text-base font-medium text-gh-text">Models (per provider)</h3>
        <p className="text-sm text-gh-text-muted mt-1 mb-4">
          Select which model each provider uses. Leave on server default to inherit the backend
          configuration.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {AI_PROVIDERS.map((p) => (
            <ModelSelect
              key={p}
              provider={p}
              value={models[p]}
              onChange={(v) => setModels((prev) => ({ ...prev, [p]: v }))}
              active={provider === p}
            />
          ))}
        </div>
      </section>

      <div className="h-px bg-gh-border-muted" />

      {/* API keys */}
      <section>
        <h3 className="text-base font-medium text-gh-text">API keys</h3>
        <p className="text-sm text-gh-text-muted mt-1 mb-4">
          Add a key for each provider you want to use. Encrypted at rest and used for every review.
        </p>

        <div className="space-y-4">
          {AI_PROVIDERS.map((p) => (
            <KeyField
              key={p}
              provider={p}
              status={values.keys[p]}
              value={keyInputs[p]}
              onChange={(v) => setKeyInputs((prev) => ({ ...prev, [p]: v }))}
            />
          ))}
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-[#2a3a4a] bg-[#1f2730] px-4 py-3">
          <Lock className="h-4 w-4 text-gh-blue-muted mt-0.5 shrink-0" />
          <p className="text-xs text-[#7a9ab5] leading-relaxed">
            Leave blank to keep an existing key. Keys are encrypted at rest and never shown in full
            after saving.
          </p>
        </div>
      </section>

      <div className="flex justify-end gap-2.5 pt-1">
        <button
          type="button"
          onClick={reset}
          disabled={saving}
          className="rounded-md border border-gh-border bg-gh-surface px-4 py-2 text-sm text-gh-text-muted hover:text-gh-text hover:border-gh-text-subtle transition-colors disabled:opacity-50"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-gh-blue px-4 py-2 text-sm font-medium text-white hover:bg-gh-blue/90 transition-colors disabled:opacity-60"
        >
          {saving ? <Spinner /> : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

function ProviderCard({
  active,
  onClick,
  icon: Icon,
  iconWrap,
  name,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: IconType;
  iconWrap: string;
  name: React.ReactNode;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
        active
          ? 'border-gh-blue bg-gh-blue/10'
          : 'border-gh-border bg-gh-surface hover:border-gh-text-subtle hover:bg-gh-surface-2',
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          iconWrap,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 min-w-0">
        <span
          className={cn(
            'block text-sm font-medium',
            active ? 'text-gh-blue-muted' : 'text-gh-text',
          )}
        >
          {name}
        </span>
        <span className="block text-xs text-gh-text-muted truncate font-mono">{sub}</span>
      </span>
      <span
        className={cn(
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          active ? 'border-gh-blue bg-gh-blue text-white' : 'border-gh-border',
        )}
      >
        {active && <Check className="h-2.5 w-2.5" />}
      </span>
    </button>
  );
}

function ModelSelect({
  provider,
  value,
  onChange,
  active,
}: {
  provider: AiProvider;
  value: string;
  onChange: (v: string) => void;
  active: boolean;
}) {
  const meta = PROVIDER_META[provider];
  const Icon = meta.icon;
  const options = PROVIDER_MODEL_OPTIONS[provider];
  const hint = DEFAULT_MODEL_HINTS[provider];

  // If the saved value isn't a known preset, surface it so it stays selectable.
  const showsCustom = value.trim() !== '' && !options.includes(value);

  return (
    <div
      className={cn(
        'rounded-lg p-3 -mx-1 transition-colors',
        active && 'bg-gh-blue/5 ring-1 ring-gh-blue/30',
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gh-text-muted mb-2">
        <Icon className="h-3.5 w-3.5 text-gh-text-subtle" />
        {AI_PROVIDER_LABELS[provider].replace(/\s*\(.*\)/, '')} model
      </div>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-md border border-gh-border bg-gh-surface px-3 py-2 pr-9 text-sm font-mono text-gh-text outline-none focus:border-gh-blue focus:ring-2 focus:ring-ring"
        >
          <option value="">Server default ({hint})</option>
          {options.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          {showsCustom && <option value={value}>{value}</option>}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gh-text-muted" />
      </div>
      <p className="text-xs text-gh-text-muted mt-1.5">
        Default: <span className="font-mono text-gh-blue-muted">{hint}</span>
      </p>
    </div>
  );
}

function KeyField({
  provider,
  status,
  value,
  onChange,
}: {
  provider: AiProvider;
  status: AiKeyStatus;
  value: string;
  onChange: (v: string) => void;
}) {
  const [reveal, setReveal] = useState(false);
  const meta = PROVIDER_META[provider];
  const Icon = meta.icon;

  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gh-text-muted mb-2">
        <Icon className="h-3.5 w-3.5 text-gh-text-subtle" />
        {AI_PROVIDER_LABELS[provider].replace(/\s*\(.*\)/, '')} API key
        {status.configured ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#2d4f2d] bg-[#1a2e1a] px-2 py-0.5 text-[10px] normal-case tracking-normal text-[#4caf50]">
            <CircleCheck className="h-3 w-3" />
            {status.masked ?? 'Active'}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-gh-border bg-gh-surface-2 px-2 py-0.5 text-[10px] normal-case tracking-normal text-gh-text-muted">
            Not set
          </span>
        )}
      </div>
      <div className="relative flex items-center">
        <input
          type={reveal ? 'text' : 'password'}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            status.configured
              ? `Replace key — current ${status.masked ?? '••••'}`
              : KEY_PLACEHOLDERS[provider]
          }
          className="w-full rounded-md border border-gh-border bg-gh-surface px-3.5 py-2.5 pr-11 text-sm font-mono text-gh-text placeholder:text-gh-text-subtle outline-none focus:border-gh-blue focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          aria-label={reveal ? 'Hide key' : 'Show key'}
          className="absolute right-3 text-gh-text-muted hover:text-gh-text"
        >
          {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
