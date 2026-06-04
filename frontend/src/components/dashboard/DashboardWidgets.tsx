'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { ReviewsListResponse } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ReviewItem = ReviewsListResponse['reviews'][number];

// ---------------------------------------------------------------------------
// Stats row (4 KPI cards)
// ---------------------------------------------------------------------------

const STAT_ACCENT: Record<string, string> = {
  total: 'text-gh-text',
  avg: 'text-[#e3b341]',
  blocked: 'text-[#f85149]',
  high: 'text-[#f0883e]',
};

export function StatsRow({ reviews }: { reviews: ReviewItem[] }) {
  const completed = reviews.filter((r) => r.review.status === 'completed');
  const avgRisk =
    completed.length > 0
      ? Math.round(
          completed.reduce((s, r) => s + (r.review.riskScore ?? 0), 0) / completed.length,
        )
      : 0;
  const blocked = completed.filter((r) => r.review.mergeRecommendation === 'BLOCK_MERGE').length;
  const critical = completed.reduce(
    (s, r) => s + (r.review.riskScore && r.review.riskScore >= 70 ? 1 : 0),
    0,
  );

  const stats = [
    { key: 'total', label: 'Total Reviews', value: reviews.length },
    { key: 'avg', label: 'Avg Risk Score', value: avgRisk },
    { key: 'blocked', label: 'Issues Blocked', value: blocked },
    { key: 'high', label: 'High Risk PRs', value: critical },
  ] as const;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <Card key={s.key}>
          <CardContent className="py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gh-text-subtle">
              {s.label}
            </p>
            <p className={cn('text-3xl font-semibold mt-1.5', STAT_ACCENT[s.key])}>
              {s.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trend chart
// ---------------------------------------------------------------------------

export function RiskTrendChart({ reviews }: { reviews: ReviewItem[] }) {
  const data = useMemo(() => {
    const byDay = new Map<string, number[]>();
    for (const r of reviews) {
      if (r.review.status !== 'completed' || r.review.riskScore === null) continue;
      const day = r.review.createdAt.slice(0, 10);
      const list = byDay.get(day) ?? [];
      list.push(r.review.riskScore);
      byDay.set(day, list);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, scores]) => ({
        date,
        avgRiskScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      }));
  }, [reviews]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Risk Trend</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gh-text-muted py-8 text-center">
          No completed reviews yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Trend (last 30 days)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#8b949e' }}
              tickFormatter={(d) => d.slice(5)}
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
              labelStyle={{ color: '#8b949e' }}
            />
            <Line
              type="monotone"
              dataKey="avgRiskScore"
              stroke="#388bfd"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// QuickSubmit (compact)
// ---------------------------------------------------------------------------

export function QuickSubmit() {
  const router = useRouter();
  const [url, setUrl] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Submit</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Input
          placeholder="Paste PR URL…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button
          onClick={() => router.push(`/review/new?url=${encodeURIComponent(url)}`)}
          disabled={!url}
        >
          Start Review
        </Button>
      </CardContent>
    </Card>
  );
}
