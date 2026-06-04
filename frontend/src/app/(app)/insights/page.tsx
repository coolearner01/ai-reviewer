'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader, Spinner, ErrorCard, EmptyState } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TopBarActions } from '@/components/layout/TopBarActions';
import { insightsApi } from '@/lib/api/insights';
import { agentLabels, cn, riskScoreClass } from '@/lib/utils';

const WINDOWS = [7, 14, 30, 60, 90] as const;

const SEVERITY_FILL: Record<string, string> = {
  critical: '#f85149',
  high: '#f0883e',
  medium: '#e3b341',
  low: '#58a6ff',
};

const DECISION_FILL: Record<string, string> = {
  APPROVE: '#3fb950',
  APPROVE_WITH_MINOR_SUGGESTIONS: '#58a6ff',
  NEEDS_CHANGES: '#e3b341',
  BLOCK_MERGE: '#f85149',
};

const DECISION_LABEL: Record<string, string> = {
  APPROVE: 'Approve',
  APPROVE_WITH_MINOR_SUGGESTIONS: 'Approve w/ suggestions',
  NEEDS_CHANGES: 'Needs changes',
  BLOCK_MERGE: 'Block merge',
};

export default function InsightsPage() {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['insights', days],
    queryFn: () => insightsApi.get(days),
  });

  const topActions = (
    <TopBarActions>
      <div className="inline-flex gap-1 rounded-lg border border-gh-border bg-gh-surface-2 p-[3px]">
        {WINDOWS.map((w) => (
          <button
            key={w}
            onClick={() => setDays(w)}
            className={cn(
              'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
              days === w
                ? 'bg-[#1c2c3a] text-[#7ab8f5]'
                : 'text-gh-text-muted hover:text-gh-text',
            )}
          >
            {w}d
          </button>
        ))}
      </div>
    </TopBarActions>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <ErrorCard message={error.message} onRetry={() => refetch()} />
      </div>
    );
  }
  if (!data) return null;

  const o = data.overview;
  const noData = o.totalReviews === 0;

  return (
    <div className="px-6 py-6 lg:px-8 max-w-7xl mx-auto">
      {topActions}
      <PageHeader
        title="Insights"
        description={`Review metrics over the last ${data.windowDays} days, computed live from your repos.`}
      />

      {noData ? (
        <EmptyState
          title="No reviews in this window"
          description="Trigger a review (or fire a Simulate PR) to start populating insights."
          action={
            <Button asChild>
              <Link href="/simulate">Simulate a PR</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total reviews" value={o.totalReviews} accent="text-gh-text" />
            <KpiCard
              label="Avg risk score"
              value={o.averageRiskScore ?? '—'}
              accent={
                o.averageRiskScore !== null
                  ? riskScoreClass(o.averageRiskScore).split(' ')[1] ?? 'text-gh-text'
                  : 'text-gh-text-muted'
              }
            />
            <KpiCard
              label="Avg duration"
              value={o.averageDurationMs !== null ? `${Math.round(o.averageDurationMs / 1000)}s` : '—'}
              accent="text-gh-blue-muted"
            />
            <KpiCard
              label="Block-merge calls"
              value={o.blockedMergeCount}
              accent="text-[#f85149]"
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Open PRs" value={o.openPRs} accent="text-[#3fb950]" />
            <KpiCard label="Merged PRs" value={o.mergedPRs} accent="text-gh-purple" />
            <KpiCard label="Closed PRs" value={o.closedPRs} accent="text-[#f85149]" />
            <KpiCard
              label="Completed reviews"
              value={`${o.completedReviews}/${o.totalReviews}`}
              accent="text-gh-text"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Risk trend</CardTitle>
              </CardHeader>
              <CardContent>
                {data.riskTrend.length === 0 ? (
                  <p className="text-sm text-gh-text-muted text-center py-8">No completed reviews yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={data.riskTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11, fill: '#8b949e' }}
                        tickFormatter={(d) => String(d).slice(5)}
                        stroke="#30363d"
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: '#8b949e' }}
                        stroke="#30363d"
                      />
                      <ReferenceLine y={30} stroke="#238636" strokeDasharray="4 4" />
                      <ReferenceLine y={70} stroke="#da3633" strokeDasharray="4 4" />
                      <Tooltip
                        contentStyle={{
                          background: '#161b22',
                          border: '1px solid #30363d',
                          borderRadius: 6,
                          color: '#e6edf3',
                          fontSize: 12,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="averageRiskScore"
                        stroke="#388bfd"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Severity breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {data.severityBreakdown.length === 0 ? (
                  <p className="text-sm text-gh-text-muted text-center py-8">
                    No findings to chart.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.severityBreakdown}
                        dataKey="count"
                        nameKey="severity"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {data.severityBreakdown.map((entry) => (
                          <Cell
                            key={entry.severity}
                            fill={SEVERITY_FILL[entry.severity] ?? '#8b949e'}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: '#161b22',
                          border: '1px solid #30363d',
                          borderRadius: 6,
                          color: '#e6edf3',
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Findings by agent</CardTitle>
              </CardHeader>
              <CardContent>
                {data.agentBreakdown.length === 0 ? (
                  <p className="text-sm text-gh-text-muted text-center py-8">
                    No findings to chart.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={data.agentBreakdown.map((a) => ({
                        ...a,
                        label: agentLabels[a.agentType] ?? a.agentType,
                      }))}
                      layout="vertical"
                      margin={{ left: 70 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#8b949e' }} stroke="#30363d" />
                      <YAxis
                        dataKey="label"
                        type="category"
                        tick={{ fontSize: 11, fill: '#8b949e' }}
                        stroke="#30363d"
                        width={120}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#161b22',
                          border: '1px solid #30363d',
                          borderRadius: 6,
                          color: '#e6edf3',
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" fill="#388bfd" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Merge recommendation mix</CardTitle>
              </CardHeader>
              <CardContent>
                {data.mergeDecisionBreakdown.length === 0 ? (
                  <p className="text-sm text-gh-text-muted text-center py-8">
                    No decisions yet.
                  </p>
                ) : (
                  <div className="space-y-2 py-2">
                    {data.mergeDecisionBreakdown.map((d) => (
                      <div key={d.decision} className="flex items-center gap-3">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: DECISION_FILL[d.decision] ?? '#8b949e' }}
                        />
                        <span className="text-sm text-gh-text flex-1">
                          {DECISION_LABEL[d.decision] ?? d.decision}
                        </span>
                        <span className="text-sm font-mono text-gh-text-muted">{d.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top repositories</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.topRepositories.length === 0 ? (
                <p className="px-6 py-6 text-sm text-gh-text-muted text-center">
                  No repos with activity in this window.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gh-surface-2 border-b border-gh-border">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-gh-text-muted">
                        Repository
                      </th>
                      <th className="text-right px-4 py-2.5 text-xs uppercase tracking-wider text-gh-text-muted">
                        Reviews
                      </th>
                      <th className="text-right px-4 py-2.5 text-xs uppercase tracking-wider text-gh-text-muted">
                        Critical
                      </th>
                      <th className="text-right px-4 py-2.5 text-xs uppercase tracking-wider text-gh-text-muted">
                        Avg risk
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topRepositories.map((r) => (
                      <tr
                        key={r.repositoryId}
                        className="border-b border-gh-border-muted last:border-0 hover:bg-gh-surface-2 transition-colors"
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/repositories`}
                            className="font-medium text-gh-text hover:text-gh-blue-muted"
                          >
                            {r.repoName}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gh-text-muted">{r.reviewCount}</td>
                        <td className="px-4 py-2.5 text-right text-[#f85149]">{r.criticalCount}</td>
                        <td className="px-4 py-2.5 text-right">
                          {r.averageRiskScore !== null ? (
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border',
                                riskScoreClass(r.averageRiskScore),
                              )}
                            >
                              {r.averageRiskScore}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gh-text-subtle">
          {label}
        </p>
        <p className={cn('text-3xl font-semibold mt-1.5', accent)}>{value}</p>
      </CardContent>
    </Card>
  );
}

