
import { ListChecks, List, TrendingUp, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { AppState } from "@/lib/api";
import type { StatsData } from "@/lib/api";

interface StatusOverviewProps {
  appState?: AppState;
}

export default function StatusOverview({ appState }: StatusOverviewProps) {

  const { data: stats } = useQuery<StatsData>({
    queryKey: ['/api/stats'],

    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const maxTasks = stats?.maxMonthlyTasks || 50;
  const usagePercentage = appState
    ? (appState.monthlyDone / maxTasks) * 100
    : 0;

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-github-surface border border-github-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-github-muted">
            Active Tasks
          </h3>
          <ListChecks className="text-github-blue" size={20} />
        </div>
        <div
          className="text-2xl font-bold text-github-text"
          data-testid="text-active-tasks"
        >
          {appState?.activeTask ? 1 : 0}
        </div>
        <p className="text-xs text-github-muted">of 1 max concurrent</p>
      </div>

      <div className="bg-github-surface border border-github-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-github-muted">
            Queue Length
          </h3>
          <List className="text-github-amber" size={20} />
        </div>
        <div
          className="text-2xl font-bold text-github-text"
          data-testid="text-queue-length"
        >
          {appState?.queue?.length || 0}
        </div>
        <p className="text-xs text-github-muted">pending tasks</p>
      </div>

      <div className="bg-github-surface border border-github-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-github-muted">
            Monthly Usage
          </h3>
          <TrendingUp className="text-github-green" size={20} />
        </div>
        <div
          className="text-2xl font-bold text-github-text"
          data-testid="text-monthly-usage"
        >
          {appState?.monthlyDone || 0}
        </div>
        <div className="w-full bg-github-border rounded-full h-1.5 mt-2">
          <div
            className="bg-github-green h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            data-testid="progress-usage"
          ></div>
        </div>
        <p className="text-xs text-github-muted">of {maxTasks} limit</p>
      </div>

      <div className="bg-github-surface border border-github-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-github-muted">
            Success Rate
          </h3>
          <CheckCircle className="text-github-green" size={20} />
        </div>
        <div
          className="text-2xl font-bold text-github-text"
          data-testid="text-success-rate"
        >
          {stats?.successRate || 0}%
        </div>
        <p className="text-xs text-github-muted">last 30 days</p>
      </div>
    </section>
  );
}
