'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Settings as SettingsIcon } from 'lucide-react';
import { PageHeader, Spinner, ErrorCard } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/hooks/useAuth';
import { useActiveOrg } from '@/lib/hooks/useActiveOrg';
import { TopBarActions } from '@/components/layout/TopBarActions';
import { settingsApi, type UserSettings, type UserSettingsPatch } from '@/lib/api/settings';
import { AiProviderSettingsForm } from '@/components/settings/AiProviderSettingsForm';
import { ApiKeysPanel } from '@/components/settings/ApiKeysPanel';
import { PromptsPanel } from '@/components/settings/PromptsPanel';
import type { AgentType, ReviewDepth } from '@/types';
import {
  CustomInstructionsField,
  FocusAreasPicker,
  IgnoredPathsField,
  ReviewDepthPicker,
} from '@/components/settings/ReviewPreferenceFields';
import { useSettings } from '@/lib/hooks/useSettings';

const TABS = ['rules', 'prompts', 'policies', 'models', 'api-keys', 'account'] as const;

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const { user } = useAuth();
  const { activeOrg } = useActiveOrg();
  const qc = useQueryClient();
  const searchParams = useSearchParams();

  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = useState<string>(
    requestedTab && (TABS as readonly string[]).includes(requestedTab) ? requestedTab : 'rules',
  );

  useEffect(() => {
    if (requestedTab && (TABS as readonly string[]).includes(requestedTab)) {
      setTab(requestedTab);
    }
  }, [requestedTab]);

  const { data, isLoading, error, refetch } = useSettings();

  const topActions = activeOrg ? (
    <TopBarActions>
      <Button asChild size="sm" variant="outline">
        <Link href={`/organizations/${activeOrg.slug}`}>
          <SettingsIcon className="h-3.5 w-3.5" />
          Org-level settings
        </Link>
      </Button>
    </TopBarActions>
  ) : null;

  const mutate = useMutation({
    mutationFn: (patch: UserSettingsPatch) => settingsApi.update(patch),
    onSuccess: ({ settings }) => {
      qc.setQueryData(['settings'], { settings });
      toast.success('Settings saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="px-6 py-8 max-w-7xl mx-auto">
        <ErrorCard message={error.message} onRetry={() => refetch()} />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="px-6 py-6 lg:px-8 max-w-7xl mx-auto">
      {topActions}
      <PageHeader title="Settings" description="Review rules, security policies, and account" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="rules">Review Rules</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="policies">Security Policies</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <RulesTab
            settings={data.settings}
            onSave={(patch) => mutate.mutate(patch)}
            saving={mutate.isPending}
          />
        </TabsContent>

        <TabsContent value="prompts">
          <PromptsPanel />
        </TabsContent>

        <TabsContent value="policies">
          <PoliciesTab
            settings={data.settings}
            onSave={(patch) => mutate.mutate(patch)}
            saving={mutate.isPending}
          />
        </TabsContent>

        <TabsContent value="models">
          <Card>
            <CardHeader>
              <CardTitle>AI models &amp; API keys</CardTitle>
            </CardHeader>
            <CardContent>
              <AiProviderSettingsForm
                values={data.settings}
                saving={mutate.isPending}
                onSave={(patch) => mutate.mutate(patch)}
                description="Your keys override organization defaults. If you belong to an org, configure shared keys under Org-level settings."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-keys">
          <div className="space-y-4">
            <p className="text-sm text-gh-text-muted">
              One git provider access token per organization, encrypted on disk and used for every
              review.
            </p>
            <ApiKeysPanel />
          </div>
        </TabsContent>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-gh-border-muted pb-2">
                <span className="text-gh-text-muted">Name</span>
                <span className="font-medium text-gh-text">{user?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gh-text-muted">Email</span>
                <span className="font-medium text-gh-text">{user?.email}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RulesTab({
  settings,
  onSave,
  saving,
}: {
  settings: UserSettings;
  onSave: (patch: Partial<UserSettings>) => void;
  saving: boolean;
}) {
  const [depth, setDepth] = useState<ReviewDepth>(settings.defaultReviewDepth);
  const [focus, setFocus] = useState<AgentType[]>(settings.defaultFocusAreas);
  const [paths, setPaths] = useState(settings.ignoredPaths.join(', '));
  const [instructions, setInstructions] = useState(settings.customInstructions);

  useEffect(() => {
    setDepth(settings.defaultReviewDepth);
    setFocus(settings.defaultFocusAreas);
    setPaths(settings.ignoredPaths.join(', '));
    setInstructions(settings.customInstructions);
  }, [settings]);

  const handleSave = () =>
    onSave({
      defaultReviewDepth: depth,
      defaultFocusAreas: focus,
      ignoredPaths: paths.split(',').map((s) => s.trim()).filter(Boolean),
      customInstructions: instructions,
    });

  return (
    <Card>
      <CardContent className="pt-5 space-y-6">
        <ReviewDepthPicker value={depth} onChange={setDepth} />
        <FocusAreasPicker value={focus} onChange={setFocus} />
        <IgnoredPathsField value={paths} onChange={setPaths} />
        <CustomInstructionsField value={instructions} onChange={setInstructions} />

        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Spinner /> : 'Save changes'}
        </Button>
      </CardContent>
    </Card>
  );
}

function PoliciesTab({
  settings,
  onSave,
  saving,
}: {
  settings: UserSettings;
  onSave: (patch: Partial<UserSettings>) => void;
  saving: boolean;
}) {
  const [security, setSecurity] = useState(settings.securityPolicies);
  const [architecture, setArchitecture] = useState(settings.architectureRules);
  const [coding, setCoding] = useState(settings.codingGuidelines);

  useEffect(() => {
    setSecurity(settings.securityPolicies);
    setArchitecture(settings.architectureRules);
    setCoding(settings.codingGuidelines);
  }, [settings]);

  return (
    <Card>
      <CardContent className="pt-5 space-y-5">
        <p className="text-sm text-gh-text-muted">
          These are <strong className="text-gh-text">injected into the custom prompt of every review</strong>. Use them to
          encode company-wide rules the agents should always check against.
        </p>

        <PolicyField
          label="Security policies"
          value={security}
          onChange={setSecurity}
          placeholder="No raw SQL strings. All user-controlled URLs must be validated against an allowlist…"
        />
        <PolicyField
          label="Architecture rules"
          value={architecture}
          onChange={setArchitecture}
          placeholder="Routes never call the DB directly. Services own all business logic…"
        />
        <PolicyField
          label="Coding guidelines"
          value={coding}
          onChange={setCoding}
          placeholder="No `any` in production code. Always use parameterised queries…"
        />

        <Button
          onClick={() =>
            onSave({
              securityPolicies: security,
              architectureRules: architecture,
              codingGuidelines: coding,
            })
          }
          disabled={saving}
        >
          {saving ? <Spinner /> : 'Save policies'}
        </Button>
      </CardContent>
    </Card>
  );
}

function PolicyField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <textarea
        rows={4}
        className="mt-1.5 w-full rounded-md border border-gh-border bg-gh-surface px-3 py-2 text-sm font-mono text-gh-text placeholder:text-gh-text-subtle focus:outline-none focus:ring-2 focus:ring-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
