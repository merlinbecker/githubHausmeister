import { GitBranch, CheckCircle, UserPlus, Edit } from 'lucide-react';

import type { WebhookConfig } from '@shared/schema';

export default function WebhookStatus() {
  // This component will show webhook configuration info
  const webhookConfig: WebhookConfig = {
    url: `${window.location.origin}/api/webhook`,

    status: 'Active',
    events: [
      'pull_request',
      'issues',
      'check_suite',
      'workflow_run',
      'check_run',
    ],
    token: '***',
    copilotAgent: 'github-copilot',
    monitoredRepos: 0,
  };

  return (
    <section className="bg-github-surface border border-github-border rounded-lg p-6">
      <h2 className="text-lg font-semibold text-github-text mb-4">
        Webhook Status
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-github-muted mb-3">
            Monitored Events
          </h3>
          <div className="space-y-2">
            {webhookConfig.events.map((eventType, index) => {
              const getEventIcon = (type: string) => {
                switch (type) {
                  case 'pull_request':
                    return GitBranch;
                  case 'issues':
                    return UserPlus;
                  case 'check_suite':
                    return CheckCircle;
                  case 'workflow_run':
                    return CheckCircle;
                  case 'check_run':
                    return CheckCircle;
                  default:
                    return Edit;
                }
              };

              const IconComponent = getEventIcon(eventType);
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-github-bg rounded-lg border border-github-border"
                  data-testid={`event-type-${eventType}`}
                >
                  <div className="flex items-center space-x-3">
                    <IconComponent className="text-github-blue" size={16} />
                    <div>
                      <span className="text-sm font-medium text-github-text">
                        {eventType}
                      </span>
                      <p className="text-xs text-github-muted">
                        Webhook event enabled
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-github-green">Active</span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-github-muted mb-3">
            Configuration
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-github-bg rounded-lg border border-github-border">
              <div>
                <span className="text-sm font-medium text-github-text">
                  Webhook URL
                </span>
                <p className="text-xs text-github-muted font-mono">
                  {webhookConfig.url}
                </p>
              </div>
              <CheckCircle className="text-github-green" size={16} />
            </div>

            <div className="flex items-center justify-between p-3 bg-github-bg rounded-lg border border-github-border">
              <div>
                <span className="text-sm font-medium text-github-text">
                  GitHub Token
                </span>
                <p className="text-xs text-github-muted">
                  {webhookConfig.token}
                </p>
              </div>
              <CheckCircle className="text-github-green" size={16} />
            </div>

            <div className="flex items-center justify-between p-3 bg-github-bg rounded-lg border border-github-border">
              <div>
                <span className="text-sm font-medium text-github-text">
                  Copilot Agent
                </span>
                <p className="text-xs text-github-muted">
                  {webhookConfig.copilotAgent}
                </p>
              </div>
              <CheckCircle className="text-github-green" size={16} />
            </div>

            <div className="flex items-center justify-between p-3 bg-github-bg rounded-lg border border-github-border">
              <div>
                <span className="text-sm font-medium text-github-text">
                  Monitored Repos
                </span>
                <p className="text-xs text-github-muted">
                  {webhookConfig.monitoredRepos} repositories
                </p>
              </div>
              <button
                className="text-github-blue hover:text-github-blue/80 transition-colors"
                data-testid="button-edit-repos"
              >
                <Edit size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
