'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { OrganizationSetupGuide } from '@/types';

const PROVIDER_LABEL: Record<OrganizationSetupGuide['provider'], string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
};

export function SetupGuide({
  guide,
  secretIsNew = false,
}: {
  guide: OrganizationSetupGuide;
  secretIsNew?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure your {PROVIDER_LABEL[guide.provider]} webhook</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-3">
          <CopyField label="Payload URL" value={guide.webhookUrl} />
          <CopyField
            label="Secret"
            value={guide.webhookSecret}
            sensitive
            highlight={secretIsNew}
          />
          <CopyField label="Content type" value={guide.contentType} />
        </div>

        {secretIsNew && (
          <div className="rounded-md border border-gh-yellow/60 bg-gh-yellow/10 p-3 text-xs text-[#e3b341]">
            <strong>Save this secret now.</strong> For security, the full secret is
            shown only here. After leaving this page you can rotate it but won&apos;t see
            the original value again.
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-gh-text mb-2">Steps</p>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-gh-text-muted marker:text-gh-text-subtle">
            {guide.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>

        <div>
          <p className="text-sm font-medium text-gh-text mb-2">Events to send</p>
          <ul className="list-disc pl-5 text-sm text-gh-text-muted marker:text-gh-text-subtle">
            {guide.events.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>

        <Button asChild variant="outline" size="sm">
          <a href={guide.docsUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            Provider docs
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

function CopyField({
  label,
  value,
  sensitive = false,
  highlight = false,
}: {
  label: string;
  value: string;
  sensitive?: boolean;
  highlight?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!sensitive);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copy failed');
    }
  };

  const displayValue = revealed ? value : '•'.repeat(Math.min(value.length, 32));

  return (
    <div>
      <p className="text-xs font-medium text-gh-text-muted mb-1">{label}</p>
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border bg-gh-canvas px-3 py-2',
          highlight ? 'border-gh-yellow/60 ring-2 ring-gh-yellow/30' : 'border-gh-border',
        )}
      >
        <code className="flex-1 text-xs text-gh-blue-muted break-all font-mono">
          {displayValue}
        </code>
        {sensitive && (
          <button
            type="button"
            className="text-xs text-gh-text-muted hover:text-gh-text"
            onClick={() => setRevealed((v) => !v)}
          >
            {revealed ? 'Hide' : 'Show'}
          </button>
        )}
        <button
          type="button"
          className="text-gh-text-muted hover:text-gh-text"
          onClick={handleCopy}
          aria-label={`Copy ${label}`}
        >
          {copied ? (
            <Check className="h-4 w-4 text-[#3fb950]" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
