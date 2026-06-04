'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Copy, Eye, EyeOff, Key, Plus, Save } from 'lucide-react';
import { EmptyState, Spinner, ErrorCard } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useActiveOrg } from '@/lib/hooks/useActiveOrg';
import { organizationsApi } from '@/lib/api/organizations';
import { cn } from '@/lib/utils';

const PROVIDER_HINT: Record<string, { label: string; helper: string; href: string }> = {
  github: {
    label: 'GitHub PAT',
    helper: 'Classic PAT with `repo` scope, or a fine-grained PAT with PR read/write.',
    href: 'https://github.com/settings/tokens',
  },
  gitlab: {
    label: 'GitLab PAT',
    helper: 'Personal access token with `api` scope.',
    href: 'https://gitlab.com/-/profile/personal_access_tokens',
  },
  bitbucket: {
    label: 'Bitbucket access token',
    helper: 'Repository access token with PR read/write.',
    href: 'https://bitbucket.org/account/settings/app-passwords/',
  },
};

/**
 * Lists every organization's git-provider access token with the ability to
 * rotate it. Shared by the standalone /api-keys page and the Settings tab.
 */
export function ApiKeysPanel() {
  const { organizations, isLoading } = useActiveOrg();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <EmptyState
        title="No API keys yet"
        description="Create an organization to attach a GitHub / GitLab / Bitbucket access token."
        action={
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="h-3.5 w-3.5" />
              Create your first organization
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {organizations.map((org) => (
        <ApiKeyRow key={org.id} orgId={org.id} />
      ))}
    </div>
  );
}

function ApiKeyRow({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['organization-setup', orgId],
    queryFn: () => organizationsApi.get(orgId),
  });

  const update = useMutation({
    mutationFn: (apiKey: string) => organizationsApi.update(orgId, { apiKey }),
    onSuccess: () => {
      toast.success('API key updated');
      setEditing(false);
      setNewKey('');
      void qc.invalidateQueries({ queryKey: ['organization-setup', orgId] });
      void qc.invalidateQueries({ queryKey: ['organizations'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Spinner />
        </CardContent>
      </Card>
    );
  }
  if (error) {
    return <ErrorCard message={error.message} onRetry={() => refetch()} />;
  }
  if (!data) return null;

  const org = data.organization;
  const provider = PROVIDER_HINT[org.provider] ?? PROVIDER_HINT.github;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(org.apiKeyMasked);
      setCopied(true);
      toast.success('Masked key copied (this is a preview only)');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Key className="h-4 w-4 text-gh-blue-muted" />
          <span>{org.name}</span>
          <Badge variant="outline" className="capitalize ml-2">
            {org.provider}
          </Badge>
        </CardTitle>
        <Link
          href={`/organizations/${org.slug}`}
          className="text-xs text-gh-blue-muted hover:underline"
        >
          Manage org →
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs text-gh-text-muted uppercase tracking-wider">
            {provider.label}
          </Label>
          <div className="mt-1.5 flex items-center gap-2 rounded-md border border-gh-border bg-gh-canvas px-3 py-2">
            <code
              className={cn(
                'flex-1 text-xs font-mono break-all',
                reveal ? 'text-gh-text' : 'text-gh-blue-muted',
              )}
            >
              {reveal ? org.apiKeyMasked : '•'.repeat(24)}
            </code>
            <button
              type="button"
              className="text-gh-text-muted hover:text-gh-text"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? 'Hide' : 'Show'}
            >
              {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              type="button"
              className="text-gh-text-muted hover:text-gh-text"
              onClick={handleCopy}
              aria-label="Copy"
            >
              {copied ? <Check className="h-4 w-4 text-[#3fb950]" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-gh-text-subtle mt-1.5">
            {provider.helper}{' '}
            <a
              href={provider.href}
              target="_blank"
              rel="noreferrer"
              className="text-gh-blue-muted hover:underline"
            >
              Generate one
            </a>
            .
          </p>
        </div>

        {!editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Replace key
          </Button>
        ) : (
          <div className="space-y-3 rounded-md border border-gh-border-muted bg-gh-surface-2 p-3">
            <Label htmlFor={`new-key-${org.id}`}>New {provider.label}</Label>
            <Input
              id={`new-key-${org.id}`}
              value={newKey}
              type="password"
              autoComplete="off"
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Paste the new token…"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => update.mutate(newKey.trim())}
                disabled={!newKey.trim() || update.isPending}
              >
                <Save className="h-3.5 w-3.5" />
                Save key
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setNewKey('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
