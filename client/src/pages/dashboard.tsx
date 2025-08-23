import { useQuery } from "@tanstack/react-query";
import { getStatus } from "@/lib/api";
import StatusOverview from "@/components/StatusOverview";
import ActiveTaskCard from "@/components/ActiveTaskCard";
import TaskQueue from "@/components/TaskQueue";
import TaskCreationForm from "@/components/TaskCreationForm";
import WebhookStatus from "@/components/WebhookStatus";
import SystemControls from "@/components/SystemControls";
import { Github, Settings, Wifi } from "lucide-react";

export default function Dashboard() {
  const { data: appState, isLoading, refetch } = useQuery({
    queryKey: ["/api/status"],
    queryFn: getStatus,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-github-bg text-github-text flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-github-blue mx-auto mb-4"></div>
          <p className="text-github-muted">Loading GitHub Hausmeister...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-github-bg text-github-text font-sans">
      {/* Header */}
      <header className="bg-github-surface border-b border-github-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Github className="text-2xl text-github-blue" size={32} />
            <h1 className="text-xl font-bold text-github-text">GitHub Hausmeister</h1>
            <span className="px-2 py-1 bg-github-blue/20 text-github-blue text-xs rounded-full font-medium">
              v1.0
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-github-green rounded-full animate-pulse"></div>
              <span className="text-sm text-github-muted">GitHub Connected</span>
            </div>
            <button 
              className="p-2 text-github-muted hover:text-github-text transition-colors"
              data-testid="button-settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <StatusOverview appState={appState} />
        
        {appState?.activeTask && (
          <ActiveTaskCard activeTask={appState.activeTask} onRefresh={refetch} />
        )}
        
        <TaskQueue queue={appState?.queue || []} onRefresh={refetch} />
        
        <TaskCreationForm onRefresh={refetch} />
        
        <WebhookStatus />
        
        <SystemControls 
          systemRunning={appState?.systemRunning || false} 
          onRefresh={refetch} 
        />
      </main>

      {/* Footer */}
      <footer className="bg-github-surface border-t border-github-border mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-github-muted">
            GitHub Hausmeister • Automated Repository Maintenance • 
            <a href="#" className="text-github-blue hover:underline ml-1">Documentation</a> • 
            <a href="#" className="text-github-blue hover:underline ml-1">Support</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
