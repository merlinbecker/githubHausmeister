import { GitBranch, CheckCircle, UserPlus, Edit, Wifi } from "lucide-react";
import { useState, useEffect } from "react";

export default function WebhookStatus() {
  const [recentEvents, setRecentEvents] = useState([
    {
      id: 1,
      type: "pull_request.opened",
      description: "my-org/frontend-app #145",
      time: "2m ago",
      icon: GitBranch,
      color: "text-github-blue"
    },
    {
      id: 2,
      type: "check_suite.completed",
      description: "CI passed for commit abc123",
      time: "5m ago", 
      icon: CheckCircle,
      color: "text-github-green"
    },
    {
      id: 3,
      type: "issues.assigned",
      description: "Issue #142 assigned to copilot",
      time: "2h ago",
      icon: UserPlus,
      color: "text-github-amber"
    }
  ]);

  const webhookConfig = {
    url: "https://your-app.replit.dev/api/webhook",
    token: "ghp_****...****",
    copilotAgent: "copilot-swe-agent",
    monitoredRepos: 4
  };

  return (
    <section className="bg-github-surface border border-github-border rounded-lg p-6">
      <h2 className="text-lg font-semibold text-github-text mb-4">Webhook Status</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-github-muted mb-3">Recent Events</h3>
          <div className="space-y-2">
            {recentEvents.map(event => {
              const IconComponent = event.icon;
              return (
                <div 
                  key={event.id}
                  className="flex items-center justify-between p-3 bg-github-bg rounded-lg border border-github-border"
                  data-testid={`event-${event.id}`}
                >
                  <div className="flex items-center space-x-3">
                    <IconComponent className={event.color} size={16} />
                    <div>
                      <span className="text-sm font-medium text-github-text">
                        {event.type}
                      </span>
                      <p className="text-xs text-github-muted">{event.description}</p>
                    </div>
                  </div>
                  <span className="text-xs text-github-muted">{event.time}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-github-muted mb-3">Configuration</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-github-bg rounded-lg border border-github-border">
              <div>
                <span className="text-sm font-medium text-github-text">Webhook URL</span>
                <p className="text-xs text-github-muted font-mono">{webhookConfig.url}</p>
              </div>
              <CheckCircle className="text-github-green" size={16} />
            </div>

            <div className="flex items-center justify-between p-3 bg-github-bg rounded-lg border border-github-border">
              <div>
                <span className="text-sm font-medium text-github-text">GitHub Token</span>
                <p className="text-xs text-github-muted">{webhookConfig.token}</p>
              </div>
              <CheckCircle className="text-github-green" size={16} />
            </div>

            <div className="flex items-center justify-between p-3 bg-github-bg rounded-lg border border-github-border">
              <div>
                <span className="text-sm font-medium text-github-text">Copilot Agent</span>
                <p className="text-xs text-github-muted">{webhookConfig.copilotAgent}</p>
              </div>
              <CheckCircle className="text-github-green" size={16} />
            </div>

            <div className="flex items-center justify-between p-3 bg-github-bg rounded-lg border border-github-border">
              <div>
                <span className="text-sm font-medium text-github-text">Monitored Repos</span>
                <p className="text-xs text-github-muted">{webhookConfig.monitoredRepos} repositories</p>
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
