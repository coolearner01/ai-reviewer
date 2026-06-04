'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  PageHeader,
  Spinner,
  ErrorCard,
} from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SetupGuide } from '@/components/organizations/SetupGuide';
import {
  organizationsApi,
  type CreateOrganizationInput,
} from '@/lib/api/organizations';
import type { OrganizationRecord, OrganizationSetupGuide, Provider } from '@/types';
import { cn } from '@/lib/utils';

const PROVIDER_OPTIONS: Array<{
  value: Provider;
  label: string;
  description: string;
  keyHint: string;
}> = [
  {
    value: 'github',
    label: 'GitHub',
    description: 'Personal Access Token (classic) or fine-grained PAT with `repo` scope.',
    keyHint: 'ghp_… or github_pat_…',
  },
  {
    value: 'gitlab',
    label: 'GitLab',
    description: 'Personal Access Token with the `api` scope.',
    keyHint: 'glpat-…',
  },
  {
    value: 'bitbucket',
    label: 'Bitbucket Cloud',
    description:
      'Atlassian API token (email + token) or a Workspace / Repository Access Token.',
    keyHint: 'you@company.com:ATATT…',
  },
];

export default function NewOrganizationPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [provider, setProvider] = useState<Provider>('github');
  const [apiKey, setApiKey] = useState('');
  const [bitbucketEmail, setBitbucketEmail] = useState('');
  const [bitbucketToken, setBitbucketToken] = useState('');

  const [result, setResult] = useState<{
    organization: OrganizationRecord;
    setupGuide: OrganizationSetupGuide;
  } | null>(null);

  const create = useMutation({
    mutationFn: (input: CreateOrganizationInput) => organizationsApi.create(input),
    onSuccess: (data) => {
      setResult(data);
      void qc.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Organization created');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resolvedApiKey =
    provider === 'bitbucket' && bitbucketEmail.trim() && bitbucketToken.trim()
      ? `${bitbucketEmail.trim()}:${bitbucketToken.trim()}`
      : apiKey.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !resolvedApiKey) return;
    create.mutate({ name: name.trim(), provider, apiKey: resolvedApiKey });
  };

  if (result) {
    return (
      <div className="px-6 py-6 lg:px-8 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title={`"${result.organization.name}" is ready`}
          description="Now finish wiring up the webhook on your git provider so PRs flow into the reviewer."
        />
        <SetupGuide guide={result.setupGuide} secretIsNew />
        <div className="flex gap-3">
          <Button asChild>
            <Link href={`/organizations/${result.organization.slug}`}>
              Go to organization dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setResult(null);
              setName('');
              setApiKey('');
              router.refresh();
            }}
          >
            Create another
          </Button>
        </div>
      </div>
    );
  }

  const selectedOption = PROVIDER_OPTIONS.find((o) => o.value === provider)!;

  return (
    <div className="px-6 py-6 lg:px-8 max-w-7xl mx-auto">
      <Link
        href="/organizations"
        className="inline-flex items-center gap-1 text-sm text-gh-text-muted hover:text-gh-text mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to organizations
      </Link>

      <PageHeader
        title="Create an organization"
        description="An organization holds the credentials for a git provider account. Once set up, all repos under it share the same key and webhook URL."
      />

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Organization details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label htmlFor="name">Organization name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Corp"
                className="mt-1.5"
                autoFocus
              />
              <p className="text-xs text-gh-text-muted mt-1">
                Display name only — we&apos;ll generate a URL slug for you.
              </p>
            </div>

            <div>
              <Label>Git provider</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {PROVIDER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setProvider(opt.value)}
                    className={cn(
                      'rounded-md border px-3 py-3 text-left text-sm transition-colors',
                      provider === opt.value
                        ? 'border-gh-blue bg-gh-blue/10 ring-1 ring-gh-blue/40 text-gh-text'
                        : 'border-gh-border bg-gh-surface text-gh-text-muted hover:border-gh-text-subtle hover:text-gh-text',
                    )}
                  >
                    <p className="font-medium capitalize">{opt.label}</p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gh-text-muted mt-2">{selectedOption.description}</p>
            </div>

            {provider === 'bitbucket' ? (
              <>
                <div>
                  <Label htmlFor="bitbucketEmail">Atlassian account email</Label>
                  <Input
                    id="bitbucketEmail"
                    type="email"
                    autoComplete="email"
                    value={bitbucketEmail}
                    onChange={(e) => setBitbucketEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="bitbucketToken">API token</Label>
                  <Input
                    id="bitbucketToken"
                    type="password"
                    value={bitbucketToken}
                    onChange={(e) => setBitbucketToken(e.target.value)}
                    placeholder="ATATT…"
                    className="mt-1.5 font-mono"
                  />
                  <p className="text-xs text-gh-text-muted mt-1">
                    From id.atlassian.com → Security → API tokens. Required for repo
                    autocomplete. Workspace Access Tokens can be pasted alone in the
                    field below instead.
                  </p>
                </div>
                <div>
                  <Label htmlFor="apiKey">Or paste one combined value</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={selectedOption.keyHint}
                    className="mt-1.5 font-mono"
                  />
                </div>
              </>
            ) : (
              <div>
                <Label htmlFor="apiKey">API key / Access token</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={selectedOption.keyHint}
                  className="mt-1.5 font-mono"
                />
              </div>
            )}
            <p className="text-xs text-gh-text-muted">
              Stored encrypted at rest with AES-256-GCM. We only show the last 4
              characters after submission.
            </p>

            {create.error && <ErrorCard message={(create.error as Error).message} />}

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={!name.trim() || !resolvedApiKey || create.isPending}
              >
                {create.isPending ? <Spinner /> : 'Create organization'}
              </Button>
              <Button asChild variant="outline">
                <Link href="/organizations">Cancel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
