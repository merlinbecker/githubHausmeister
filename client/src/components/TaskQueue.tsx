import React from 'react';
import { Plus, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { deleteTask } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { Task } from '@shared/schema';

interface TaskQueueProps {
  queue: Task[];
  onRefresh: () => void;
}

export default function TaskQueue({ queue, onRefresh }: TaskQueueProps) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      toast({
        title: 'Task Removed',
        description: 'Task has been removed from the queue.',
      });
      onRefresh();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove task',
        variant: 'destructive',
      });
    },
  });

  const handleRemoveTask = (taskId: string) => {
    deleteMutation.mutate(taskId);
  };

  const getTypeColor = (labels: string[]) => {
    if (labels.includes('tests')) return 'bg-github-blue/20 text-github-blue';
    if (labels.includes('lint')) return 'bg-github-amber/20 text-github-amber';
    if (labels.includes('types')) return 'bg-github-green/20 text-github-green';
    if (labels.includes('security')) return 'bg-github-red/20 text-github-red';
    if (labels.includes('docs')) return 'bg-github-muted/20 text-github-muted';
    return 'bg-github-border text-github-muted';
  };

  const getTypeLabel = (labels: string[]) => {
    return (
      labels.find((label) =>
        ['tests', 'lint', 'types', 'security', 'docs'].includes(label)
      ) || 'chore'
    );
  };

  return (
    <section className="bg-github-surface border border-github-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-github-text">Task Queue</h2>
        <span
          className="text-sm text-github-muted"
          data-testid="text-queue-count"
        >
          {queue.length} tasks
        </span>
      </div>

      {queue.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-github-muted mb-4">
            <Plus size={48} className="mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-github-text mb-2">
            Queue is Empty
          </h3>
          <p className="text-github-muted">
            Add new tasks using the form below to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((task, index) => (
            <div
              key={task.id}
              className="flex items-center justify-between p-4 bg-github-bg rounded-lg border border-github-border"
              data-testid={`card-task-${task.id}`}
            >
              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-github-muted/20 rounded-full flex items-center justify-center text-sm font-medium text-github-muted">
                  {index + 1}
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span
                      className="font-medium text-github-text"
                      data-testid={`text-repo-${task.id}`}
                    >
                      {task.owner}/{task.repo}
                    </span>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${getTypeColor(task.labels)}`}
                    >
                      {getTypeLabel(task.labels)}
                    </span>
                  </div>
                  <h3
                    className="text-sm text-github-text"
                    data-testid={`text-title-${task.id}`}
                  >
                    {task.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => handleRemoveTask(task.id)}
                disabled={deleteMutation.isPending}
                className="text-github-muted hover:text-github-red transition-colors disabled:opacity-50"
                data-testid={`button-remove-${task.id}`}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {queue.length > 0 && (
        <div className="mt-4 text-center">
          <p className="text-sm text-github-muted">
            Next task will start automatically when current task completes
          </p>
        </div>
      )}
    </section>
  );
}
