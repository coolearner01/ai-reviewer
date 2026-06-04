import { apiFetch } from './client';

export interface InsightsResponse {
  windowDays: number;
  overview: {
    totalReviews: number;
    completedReviews: number;
    failedReviews: number;
    averageRiskScore: number | null;
    averageDurationMs: number | null;
    blockedMergeCount: number;
    openPRs: number;
    mergedPRs: number;
    closedPRs: number;
  };
  severityBreakdown: Array<{ severity: string; count: number }>;
  topRepositories: Array<{
    repositoryId: string;
    repoName: string;
    reviewCount: number;
    averageRiskScore: number | null;
    criticalCount: number;
  }>;
  agentBreakdown: Array<{ agentType: string; count: number }>;
  riskTrend: Array<{
    day: string;
    averageRiskScore: number | null;
    reviewCount: number;
  }>;
  mergeDecisionBreakdown: Array<{ decision: string; count: number }>;
}

export const insightsApi = {
  get: (days = 30) => apiFetch<InsightsResponse>(`/insights?days=${days}`),
};
