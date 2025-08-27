import { useMutation } from "@tanstack/react-query";
import { pauseSystem, resumeSystem, clearQueue } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Pause, Play, Trash2, Download } from "lucide-react";

interface SystemControlsProps {
  systemRunning: boolean;
  onRefresh: () => void;
}

export default function SystemControls({ systemRunning, onRefresh }: SystemControlsProps) {
  const { toast } = useToast();

  const pauseMutation = useMutation({
    mutationFn: pauseSystem,
    onSuccess: () => {
      toast({
        title: "System Paused",
        description: "The system has been paused. No new tasks will be processed.",
      });
      onRefresh();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to pause system",
        variant: "destructive",
      });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: resumeSystem,
    onSuccess: () => {
      toast({
        title: "System Resumed",
        description: "The system has been resumed. Task processing will continue.",
      });
      onRefresh();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resume system",
        variant: "destructive",
      });
    },
  });

  const clearMutation = useMutation({
    mutationFn: clearQueue,
    onSuccess: () => {
      toast({
        title: "Queue Cleared",
        description: "All pending tasks have been removed from the queue.",
      });
      onRefresh();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clear queue",
        variant: "destructive",
      });
    },
  });

  const handleToggleSystem = () => {
    if (systemRunning) {
      pauseMutation.mutate();
    } else {
      resumeMutation.mutate();
    }
  };

  const handleClearQueue = () => {
    if (window.confirm("Are you sure you want to clear all pending tasks?")) {
      clearMutation.mutate();
    }
  };

  const exportLogsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/logs/export", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to export logs");
      }
      return response.blob();
    },
    onSuccess: (blob) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `github-hausmeister-logs-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Export Complete",
        description: "Your logs have been downloaded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export logs",
        variant: "destructive",
      });
    },
  });

  const handleExportLogs = () => {
    exportLogsMutation.mutate();
  };

  return (
    <section className="bg-github-surface border border-github-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-github-text">System Controls</h2>
        <div className="flex items-center space-x-2">
          <span 
            className={`px-3 py-1 text-sm rounded-full font-medium ${
              systemRunning 
                ? "bg-github-green/20 text-github-green" 
                : "bg-github-red/20 text-github-red"
            }`}
            data-testid="text-system-status"
          >
            {systemRunning ? "System Running" : "System Paused"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button 
          onClick={handleToggleSystem}
          disabled={pauseMutation.isPending || resumeMutation.isPending}
          className="p-4 bg-github-bg border border-github-border rounded-lg hover:border-github-blue transition-colors group disabled:opacity-50"
          data-testid="button-toggle-system"
        >
          <div className="flex flex-col items-center space-y-2">
            {systemRunning ? (
              <>
                <Pause className="text-2xl text-github-amber group-hover:text-github-blue transition-colors" size={32} />
                <span className="font-medium text-github-text">Pause System</span>
                <span className="text-xs text-github-muted text-center">Stop processing new tasks</span>
              </>
            ) : (
              <>
                <Play className="text-2xl text-github-green group-hover:text-github-blue transition-colors" size={32} />
                <span className="font-medium text-github-text">Resume System</span>
                <span className="text-xs text-github-muted text-center">Start processing tasks</span>
              </>
            )}
          </div>
        </button>

        <button 
          onClick={handleClearQueue}
          disabled={clearMutation.isPending}
          className="p-4 bg-github-bg border border-github-border rounded-lg hover:border-github-blue transition-colors group disabled:opacity-50"
          data-testid="button-clear-queue"
        >
          <div className="flex flex-col items-center space-y-2">
            <Trash2 className="text-2xl text-github-red group-hover:text-github-blue transition-colors" size={32} />
            <span className="font-medium text-github-text">Clear Queue</span>
            <span className="text-xs text-github-muted text-center">Remove all pending tasks</span>
          </div>
        </button>

        <button 
          onClick={handleExportLogs}
          disabled={exportLogsMutation.isPending}
          className="p-4 bg-github-bg border border-github-border rounded-lg hover:border-github-blue transition-colors group disabled:opacity-50"
          data-testid="button-export-logs"
        >
          <div className="flex flex-col items-center space-y-2">
            <Download className="text-2xl text-github-muted group-hover:text-github-blue transition-colors" size={32} />
            <span className="font-medium text-github-text">Export Logs</span>
            <span className="text-xs text-github-muted text-center">Download activity logs</span>
          </div>
        </button>
      </div>

      <div className="mt-6 p-4 bg-github-bg rounded-lg border border-github-border">
        <h3 className="text-sm font-medium text-github-text mb-2">Quick Stats</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-github-text" data-testid="text-total-tasks">127</div>
            <div className="text-xs text-github-muted">Total Tasks</div>
          </div>
          <div>
            <div className="text-lg font-bold text-github-green" data-testid="text-successful-tasks">119</div>
            <div className="text-xs text-github-muted">Successful</div>
          </div>
          <div>
            <div className="text-lg font-bold text-github-red" data-testid="text-failed-tasks">8</div>
            <div className="text-xs text-github-muted">Failed</div>
          </div>
          <div>
            <div className="text-lg font-bold text-github-text" data-testid="text-avg-time">2.3h</div>
            <div className="text-xs text-github-muted">Avg Time</div>
          </div>
        </div>
      </div>
    </section>
  );
}
