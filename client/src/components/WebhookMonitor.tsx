import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Activity, 
  Clock, 
  Play, 
  RefreshCw, 
  GitBranch, 
  User, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { getWebhookDeliveries, testWebhook } from '@/lib/api';
import type { WebhookDelivery, UserRepository, WebhookPayloadSummary } from '@shared/schema';

interface WebhookMonitorProps {
  repositories: UserRepository[];
  onRefresh?: () => void;
}

interface WebhookDeliveryWithTime extends WebhookDelivery {
  timeAgo: string;
}

export default function WebhookMonitor({ repositories, onRefresh }: WebhookMonitorProps) {
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { 
    data: webhookDeliveries = [], 
    isLoading, 
    refetch,
    error 
  } = useQuery({
    queryKey: ['webhook-deliveries'],
    queryFn: () => getWebhookDeliveries(100),
    refetchInterval: autoRefresh ? 5000 : false, // Refetch every 5 seconds if auto-refresh is on
    refetchOnWindowFocus: true,
  });

  // Format webhook deliveries with time ago
  const formattedDeliveries: WebhookDeliveryWithTime[] = (webhookDeliveries || []).map(delivery => ({
    ...delivery,
    timeAgo: formatTimeAgo(new Date(delivery.createdAt)),
  }));

  const handleTestWebhook = async () => {
    if (!selectedRepo) return;
    
    setIsTestingWebhook(true);
    try {
      await testWebhook(selectedRepo);
      // Refresh webhook deliveries to show the test webhook
      setTimeout(() => {
        refetch();
        onRefresh?.();
      }, 1000);
    } catch (error) {
      console.error('Error testing webhook:', error);
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const getEventIcon = (event: string) => {
    switch (event) {
      case 'pull_request':
        return GitBranch;
      case 'issues':
        return User;
      case 'check_suite':
      case 'workflow_run':
      case 'check_run':
        return CheckCircle;
      case 'test':
        return Play;
      default:
        return Activity;
    }
  };

  const getEventColor = (event: string, payloadSummary: any) => {
    if (event === 'test') return 'text-blue-500';
    
    const summary = payloadSummary as WebhookPayloadSummary;
    const conclusion = summary?.conclusion;
    if (conclusion === 'success') return 'text-green-500';
    if (conclusion === 'failure') return 'text-red-500';
    if (conclusion === 'cancelled') return 'text-yellow-500';
    
    switch (event) {
      case 'pull_request':
        return 'text-blue-500';
      case 'issues':
        return 'text-purple-500';
      case 'check_suite':
      case 'workflow_run':
      case 'check_run':
        return 'text-green-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <section className="bg-github-surface border border-github-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-github-text flex items-center gap-2">
          <Activity size={20} />
          Webhook Monitor
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors ${
              autoRefresh 
                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
          >
            <RefreshCw size={14} className={autoRefresh ? 'animate-spin' : ''} />
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1 px-3 py-1 bg-github-blue text-white rounded text-sm hover:bg-github-blue/80 transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Test Webhook Section */}
      <div className="mb-6 p-4 bg-github-bg rounded-lg border border-github-border">
        <h3 className="text-sm font-medium text-github-text mb-3 flex items-center gap-2">
          <Play size={16} />
          Test Webhook
        </h3>
        <div className="flex items-center gap-3">
          <select
            value={selectedRepo}
            onChange={(e) => setSelectedRepo(e.target.value)}
            className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-github-blue focus:border-github-blue"
          >
            <option value="">Select a repository...</option>
            {repositories.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.owner}/{repo.repo}
              </option>
            ))}
          </select>
          <button
            onClick={handleTestWebhook}
            disabled={!selectedRepo || isTestingWebhook}
            className="px-4 py-2 bg-github-blue text-white rounded text-sm font-medium hover:bg-github-blue/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isTestingWebhook ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Play size={14} />
                Test Webhook
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-github-muted mt-2">
          Send a test webhook event to verify notifications and monitoring
        </p>
      </div>

      {/* Webhook Deliveries */}
      <div>
        <h3 className="text-sm font-medium text-github-muted mb-3">
          Recent Webhook Events ({formattedDeliveries.length})
        </h3>
        
        {isLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="animate-spin mx-auto text-github-blue mb-2" size={24} />
            <p className="text-github-muted">Loading webhook events...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertCircle className="mx-auto text-red-500 mb-2" size={24} />
            <p className="text-red-600">Failed to load webhook events</p>
          </div>
        ) : formattedDeliveries.length === 0 ? (
          <div className="text-center py-8">
            <Activity size={48} className="mx-auto text-github-muted mb-4" />
            <h3 className="text-lg font-medium text-github-text mb-2">
              No Webhook Events
            </h3>
            <p className="text-github-muted">
              Webhook events will appear here as they are received
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {formattedDeliveries.map((delivery) => {
              const IconComponent = getEventIcon(delivery.event);
              const iconColor = getEventColor(delivery.event, delivery.payloadSummary);
              
              return (
                <div
                  key={delivery.id}
                  className="flex items-center justify-between p-3 bg-github-bg rounded-lg border border-github-border hover:border-github-blue/50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <IconComponent className={iconColor} size={16} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-github-text">
                          {delivery.event}
                        </span>
                        {delivery.action && (
                          <span className="text-xs px-2 py-1 bg-github-blue/10 text-github-blue rounded">
                            {delivery.action}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-github-muted">
                        {delivery.repositoryOwner && delivery.repositoryName && (
                          <span className="mr-3">
                            {delivery.repositoryOwner}/{delivery.repositoryName}
                          </span>
                        )}
                        {delivery.actorLogin && (
                          <span className="mr-3">by {delivery.actorLogin}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {delivery.timeAgo}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {(delivery.payloadSummary as WebhookPayloadSummary)?.pullRequestNumber && (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                        PR #{(delivery.payloadSummary as WebhookPayloadSummary).pullRequestNumber}
                      </span>
                    )}
                    {(delivery.payloadSummary as WebhookPayloadSummary)?.issueNumber && (
                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                        Issue #{(delivery.payloadSummary as WebhookPayloadSummary).issueNumber}
                      </span>
                    )}
                    {(delivery.payloadSummary as WebhookPayloadSummary)?.conclusion && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        (delivery.payloadSummary as WebhookPayloadSummary).conclusion === 'success' 
                          ? 'bg-green-100 text-green-700'
                          : (delivery.payloadSummary as WebhookPayloadSummary).conclusion === 'failure'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {(delivery.payloadSummary as WebhookPayloadSummary).conclusion}
                      </span>
                    )}
                    <span className="text-xs text-github-muted font-mono">
                      {delivery.id.length > 8 ? `${delivery.id.slice(0, 8)}...` : delivery.id}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  }
}