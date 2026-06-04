'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { organizationsApi } from '@/lib/api/organizations';
import type { OrganizationRecord } from '@/types';

/**
 * Per-org settings form. Scoped to a single organization — the org owner sets
 * the org's display name and rotates the git provider API key here. Review
 * rules and AI model/key configuration live in the main Settings page.
 */
export function OrganizationSettingsForm({
  organization,
  onOrgUpdated,
}: {
  organization: OrganizationRecord;
  onOrgUpdated?: (org: OrganizationRecord) => void;
}) {
  const qc = useQueryClient();

  const [name, setName] = useState(organization.name);
  const [apiKey, setApiKey] = useState('');
  const [bitbucketEmail, setBitbucketEmail] = useState('');
  const [bitbucketToken, setBitbucketToken] = useState('');

  const isBitbucket = organization.provider === 'bitbucket';
  const resolvedApiKey =
    isBitbucket && bitbucketEmail.trim() && bitbucketToken.trim()
      ? `${bitbucketEmail.trim()}:${bitbucketToken.trim()}`
      : apiKey.trim();

  useEffect(() => setName(organization.name), [organization.name]);

  const updateOrg = useMutation({
    mutationFn: (patch: { name?: string; apiKey?: string }) =>
      organizationsApi.update(organization.id, patch),
    onSuccess: ({ organization: org }) => {
      toast.success('Organization updated');
      setApiKey('');
      onOrgUpdated?.(org);
      void qc.invalidateQueries({ queryKey: ['organizations'] });
      void qc.invalidateQueries({ queryKey: ['organization', org.slug] });
      void qc.invalidateQueries({ queryKey: ['organization-provider-repos', organization.id] });
      setBitbucketEmail('');
      setBitbucketToken('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="org-name">Display name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
            />
          </div>
          {isBitbucket ? (
            <>
              <div>
                <Label htmlFor="org-bitbucket-email">Atlassian account email</Label>
                <Input
                  id="org-bitbucket-email"
                  type="email"
                  autoComplete="email"
                  value={bitbucketEmail}
                  onChange={(e) => setBitbucketEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="org-bitbucket-token">New API token</Label>
                <Input
                  id="org-bitbucket-token"
                  type="password"
                  value={bitbucketToken}
                  onChange={(e) => setBitbucketToken(e.target.value)}
                  placeholder="ATATT…"
                  className="mt-1.5 font-mono"
                />
                <p className="mt-1 text-xs text-gh-text-muted">
                  Required if you use an Atlassian API token from id.atlassian.com. We store{' '}
                  <span className="font-mono">email:token</span> together. Current key ends with{' '}
                  {organization.apiKeyMasked}.
                </p>
              </div>
              <div>
                <Label htmlFor="org-key">Or paste combined email:token</Label>
                <Input
                  id="org-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="you@company.com:ATATT…"
                  className="mt-1.5 font-mono"
                />
              </div>
            </>
          ) : (
            <div>
              <Label htmlFor="org-key">
                {organization.provider.charAt(0).toUpperCase() + organization.provider.slice(1)}{' '}
                API key
              </Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  id="org-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={`Current: ${organization.apiKeyMasked}`}
                />
              </div>
            </div>
          )}
          <p className="text-xs text-gh-text-muted">
            Leave credential fields blank to keep the existing key. New keys are stored encrypted
            at rest.
          </p>
          <div className="flex justify-end">
            <Button
              onClick={() =>
                updateOrg.mutate({
                  name: name !== organization.name ? name : undefined,
                  apiKey: resolvedApiKey ? resolvedApiKey : undefined,
                })
              }
              disabled={
                updateOrg.isPending ||
                (name === organization.name && !resolvedApiKey)
              }
            >
              <Save className="h-3.5 w-3.5" />
              Save organization
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
