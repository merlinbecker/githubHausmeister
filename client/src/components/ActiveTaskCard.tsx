import { Github, Clock, GitBranch, CheckCircle, User, StopCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActiveTaskCardProps {
  activeTask: any;
  onRefresh: () => void;
}

export default function ActiveTaskCard({ activeTask, onRefresh }: ActiveTaskCardProps) {
  const formatTimeAgo = (date: string | Date) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return "unknown";
    }
  };

  const stopTask = async () => {
    // This would need to be implemented in the API
    console.log("Stop task clicked");
  };

  if (!activeTask) {
    return (
      <section className="bg-github-surface border border-github-border rounded-lg p-6">
        <div className="text-center py-8">
          <div className="text-github-muted mb-2">
            <CheckCircle size={48} className="mx-auto mb-4" />
          </div>
          <h3 className="text-lg font-medium text-github-text mb-2">No Active Tasks</h3>
          <p className="text-github-muted">System is idle. Add tasks to the queue to get started.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-github-surface border border-github-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-github-text">Current Active Task</h2>
        <div className="flex items-center space-x-2">
          <span className="px-2 py-1 bg-github-green/20 text-github-green text-xs rounded-full font-medium">
            Running
          </span>
          <button 
            onClick={stopTask}
            className="px-3 py-1 bg-github-red/20 text-github-red text-xs rounded-full font-medium hover:bg-github-red/30 transition-colors"
            data-testid="button-stop-task"
          >
            <StopCircle size={12} className="mr-1 inline" />
            Stop
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-github-bg rounded-lg border border-github-border">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Github className="text-github-muted" size={16} />
              <span className="font-medium text-github-text" data-testid="text-active-repo">
                {activeTask.owner}/{activeTask.repo}
              </span>
              {activeTask.issueNumber && (
                <>
                  <span className="text-github-muted">#</span>
                  <span className="text-github-blue" data-testid="text-issue-number">
                    {activeTask.issueNumber}
                  </span>
                </>
              )}
            </div>
            <h3 className="font-medium text-github-text" data-testid="text-task-title">
              {activeTask.title}
            </h3>
            <div className="flex items-center space-x-4 text-sm text-github-muted">
              <span>
                <User size={14} className="mr-1 inline" />
                Assigned to Copilot
              </span>
              <span>
                <Clock size={14} className="mr-1 inline" />
                Started {formatTimeAgo(activeTask.createdAt)}
              </span>
            </div>
          </div>
          <div className="mt-4 sm:mt-0 space-y-2">
            {activeTask.pullNumber && (
              <div className="flex items-center space-x-2">
                <GitBranch className="text-github-blue" size={16} />
                <span className="text-sm text-github-text" data-testid="text-pr-number">
                  PR #{activeTask.pullNumber}
                </span>
                <span className="px-2 py-1 bg-github-amber/20 text-github-amber text-xs rounded-full">
                  Review
                </span>
              </div>
            )}
            {activeTask.headSha && (
              <div className="flex items-center space-x-2">
                <CheckCircle className="text-github-green" size={16} />
                <span className="text-sm text-github-muted">CI: In Progress</span>
              </div>
            )}
          </div>
        </div>

        {/* Task Progress Timeline */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-github-muted">Progress Timeline</h4>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-github-green rounded-full"></div>
              <span className="text-sm text-github-text">Issue created and assigned to Copilot</span>
              <span className="text-xs text-github-muted">{formatTimeAgo(activeTask.createdAt)}</span>
            </div>
            
            {activeTask.pullNumber && (
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-github-green rounded-full"></div>
                <span className="text-sm text-github-text">Pull request opened</span>
                <span className="text-xs text-github-muted">{formatTimeAgo(activeTask.updatedAt)}</span>
              </div>
            )}
            
            {activeTask.headSha && (
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-github-amber rounded-full animate-pulse"></div>
                <span className="text-sm text-github-text">CI checks running...</span>
                <span className="text-xs text-github-muted">now</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
