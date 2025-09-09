import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GripVertical, ArrowUp, ArrowDown, Hash } from 'lucide-react';
import {
  getIssuePriorities,
  updateIssuePriorities,
  type Issue,
  type UserRepository,
  type IssuePriority,
} from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface DraggableIssueListProps {
  repository: UserRepository;
  issues: Issue[];
  onOrderChange?: (orderedIssueNumbers: number[]) => void;
}

interface IssueWithPriority extends Issue {
  priority: number;
  hasPriority: boolean;
}

export default function DraggableIssueList({
  repository,
  issues,
  onOrderChange,
}: DraggableIssueListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [orderedIssues, setOrderedIssues] = useState<IssueWithPriority[]>([]);

  // Get issue priorities from the server
  const { data: priorities = [] } = useQuery({
    queryKey: ['issue-priorities', repository.owner, repository.repo],
    queryFn: () => getIssuePriorities(repository.owner, repository.repo),
  });

  // Update priorities on the server
  const updatePrioritiesMutation = useMutation({
    mutationFn: (newPriorities: Array<{ issueNumber: number; priority: number }>) =>
      updateIssuePriorities(repository.owner, repository.repo, newPriorities),
    onSuccess: () => {
      toast({
        title: 'Priorities Updated',
        description: 'Issue priorities have been saved successfully',
      });
      queryClient.invalidateQueries({
        queryKey: ['issue-priorities', repository.owner, repository.repo],
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update issue priorities',
        variant: 'destructive',
      });
    },
  });

  // Merge issues with their priorities and sort them
  useEffect(() => {
    const priorityMap = new Map<number, number>();
    priorities.forEach((p) => {
      priorityMap.set(p.issueNumber, p.priority);
    });

    const issuesWithPriorities: IssueWithPriority[] = issues.map((issue) => ({
      ...issue,
      priority: priorityMap.get(issue.number) ?? 999999, // Default high number for no priority
      hasPriority: priorityMap.has(issue.number),
    }));

    // Sort: prioritized issues first (by priority), then unprioritized issues (by issue number)
    issuesWithPriorities.sort((a, b) => {
      if (a.hasPriority && b.hasPriority) {
        return a.priority - b.priority;
      }
      if (a.hasPriority && !b.hasPriority) {
        return -1;
      }
      if (!a.hasPriority && b.hasPriority) {
        return 1;
      }
      // Both have no priority, sort by issue number (newest first)
      return b.number - a.number;
    });

    setOrderedIssues(issuesWithPriorities);
  }, [issues, priorities]);

  const handleDragStart = (e: React.DragEvent, issueNumber: number) => {
    setDraggedItem(issueNumber);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIssueNumber: number) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem === targetIssueNumber) {
      return;
    }

    const draggedIndex = orderedIssues.findIndex(issue => issue.number === draggedItem);
    const targetIndex = orderedIssues.findIndex(issue => issue.number === targetIssueNumber);

    if (draggedIndex === -1 || targetIndex === -1) {
      return;
    }

    // Create new array with reordered issues
    const newOrderedIssues = [...orderedIssues];
    const [draggedIssue] = newOrderedIssues.splice(draggedIndex, 1);
    newOrderedIssues.splice(targetIndex, 0, draggedIssue);

    // Update priorities based on new order
    const updatedIssues = newOrderedIssues.map((issue, index) => ({
      ...issue,
      priority: index,
      hasPriority: true,
    }));

    setOrderedIssues(updatedIssues);

    // Save to server
    const priorityUpdates = updatedIssues.map((issue, index) => ({
      issueNumber: issue.number,
      priority: index,
    }));

    updatePrioritiesMutation.mutate(priorityUpdates);

    // Notify parent component
    onOrderChange?.(updatedIssues.map(issue => issue.number));
  };

  const moveIssue = (issueNumber: number, direction: 'up' | 'down') => {
    const currentIndex = orderedIssues.findIndex(issue => issue.number === issueNumber);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= orderedIssues.length) return;

    const newOrderedIssues = [...orderedIssues];
    const [movedIssue] = newOrderedIssues.splice(currentIndex, 1);
    newOrderedIssues.splice(newIndex, 0, movedIssue);

    // Update priorities
    const updatedIssues = newOrderedIssues.map((issue, index) => ({
      ...issue,
      priority: index,
      hasPriority: true,
    }));

    setOrderedIssues(updatedIssues);

    const priorityUpdates = updatedIssues.map((issue, index) => ({
      issueNumber: issue.number,
      priority: index,
    }));

    updatePrioritiesMutation.mutate(priorityUpdates);
    onOrderChange?.(updatedIssues.map(issue => issue.number));
  };

  if (orderedIssues.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-gray-500">No issues available for prioritization</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="h-5 w-5" />
          Issue Priority Management
        </CardTitle>
        <p className="text-sm text-gray-600">
          Drag and drop issues to set their priority for Copilot assignment
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {orderedIssues.map((issue, index) => (
            <div
              key={issue.number}
              draggable
              onDragStart={(e) => handleDragStart(e, issue.number)}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, issue.number)}
              className={`
                flex items-center gap-3 p-3 bg-white border rounded-lg transition-all
                cursor-move hover:shadow-md hover:border-blue-300
                ${draggedItem === issue.number ? 'opacity-50 shadow-lg border-blue-500' : ''}
                ${issue.hasPriority ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-gray-200'}
              `}
            >
              {/* Drag handle */}
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-gray-400" />
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <span className="font-mono">{index + 1}</span>
                </div>
              </div>

              {/* Issue info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">#{issue.number}</span>
                  <span className="text-sm text-gray-600 truncate">{issue.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  {issue.labels.slice(0, 3).map((label) => (
                    <Badge
                      key={label.id}
                      variant="outline"
                      className="text-xs"
                      style={{
                        borderColor: `#${label.color}`,
                        color: `#${label.color}`,
                      }}
                    >
                      {label.name}
                    </Badge>
                  ))}
                  {issue.assignees.length > 0 && (
                    <div className="flex -space-x-1">
                      {issue.assignees.slice(0, 2).map((assignee) => (
                        <Avatar key={assignee.id} className="h-5 w-5 border border-white">
                          <AvatarImage src={assignee.avatar_url} alt={assignee.login} />
                          <AvatarFallback className="text-xs">
                            {assignee.login[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Priority status */}
              <div className="flex items-center gap-1">
                {issue.hasPriority ? (
                  <Badge variant="secondary" className="text-xs">
                    Priority: {issue.priority + 1}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    Not prioritized
                  </Badge>
                )}
              </div>

              {/* Move buttons */}
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveIssue(issue.number, 'up')}
                  disabled={index === 0 || updatePrioritiesMutation.isPending}
                  className="h-6 w-6 p-0"
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveIssue(issue.number, 'down')}
                  disabled={index === orderedIssues.length - 1 || updatePrioritiesMutation.isPending}
                  className="h-6 w-6 p-0"
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        {updatePrioritiesMutation.isPending && (
          <div className="flex items-center justify-center gap-2 mt-4 p-2 text-sm text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
            Saving priorities...
          </div>
        )}
      </CardContent>
    </Card>
  );
}