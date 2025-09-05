import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  GitPullRequest, 
  User, 
  Calendar,
  GitBranch,
  CheckCircle,
  AlertCircle,
  Bot
} from 'lucide-react';
import { 
  getRepositoryIssues, 
  assignIssueToCopilot,
  type Issue,
  type UserRepository 
} from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface IssueListProps {
  repository: UserRepository;
}

export default function IssueList({ repository }: IssueListProps) {
  const { toast } = useToast();
  const _queryClient = useQueryClient();
  const [assigningIssue, setAssigningIssue] = useState<number | null>(null);

  const { 
    data: issues, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['repository-issues', repository.owner, repository.repo],
    queryFn: () => getRepositoryIssues(repository.owner, repository.repo),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 0, // Always fetch fresh data on app startup - GitHub is single source of truth
    refetchOnWindowFocus: true, // Refetch when window comes into focus to stay synced with GitHub
  });

  const assignMutation = useMutation({
    mutationFn: (issueNumber: number) => 
      assignIssueToCopilot(repository.owner, repository.repo, issueNumber),
    onMutate: (issueNumber) => {
      setAssigningIssue(issueNumber);
    },
    onSuccess: (result, issueNumber) => {
      toast({
        title: 'Issue Assigned',
        description: `Issue #${issueNumber} has been assigned to ${result.assignedAgent}`,
      });
      refetch();
      setAssigningIssue(null);
    },
    onError: (error: Error, _issueNumber) => {
      toast({
        title: 'Assignment Failed',
        description: error.message || 'Failed to assign issue to Copilot',
        variant: 'destructive',
      });
      setAssigningIssue(null);
    },
  });

  const handleAssignToCopilot = (issueNumber: number) => {
    assignMutation.mutate(issueNumber);
  };

  const getStateIcon = (state: string, hasOpenPR: boolean) => {
    if (hasOpenPR) {
      return <GitPullRequest className="h-4 w-4 text-github-blue" />;
    }
    if (state === 'open') {
      return <AlertCircle className="h-4 w-4 text-github-green" />;
    }
    return <CheckCircle className="h-4 w-4 text-github-purple" />;
  };

  const getStateBadgeVariant = (state: string, hasOpenPR: boolean) => {
    if (hasOpenPR) return 'default';
    return state === 'open' ? 'default' : 'secondary';
  };

  const getStateBadgeText = (state: string, hasOpenPR: boolean) => {
    if (hasOpenPR) return 'In Progress';
    return state === 'open' ? 'Open' : 'Closed';
  };

  const isCopilotAssigned = (issue: Issue) => {
    return issue.assignees?.some(assignee => 
      assignee.login.toLowerCase().includes('copilot') || 
      assignee.login.toLowerCase().includes('github-actions') ||
      assignee.login.toLowerCase().includes('swe-agent')
    );
  };

  const getCopilotAssignee = (issue: Issue) => {
    return issue.assignees?.find(assignee => 
      assignee.login.toLowerCase().includes('copilot') || 
      assignee.login.toLowerCase().includes('github-actions') ||
      assignee.login.toLowerCase().includes('swe-agent')
    );
  };

  const getWorkflowStatus = (issue: Issue) => {
    if (issue.hasOpenPR && issue.openPRs && issue.openPRs.length > 0) {
      return {
        status: 'in_progress',
        text: 'PR in progress',
        icon: GitPullRequest,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 border-blue-200'
      };
    }
    
    const copilotAssignee = getCopilotAssignee(issue);
    if (copilotAssignee) {
      return {
        status: 'assigned',
        text: `Assigned to ${copilotAssignee.login}`,
        icon: Bot,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50 border-purple-200'
      };
    }
    
    if (issue.assignees && issue.assignees.length > 0) {
      return {
        status: 'assigned_human',
        text: `Assigned to ${issue.assignees[0].login}`,
        icon: User,
        color: 'text-green-600',
        bgColor: 'bg-green-50 border-green-200'
      };
    }
    
    return {
      status: 'unassigned',
      text: 'Available for assignment',
      icon: AlertCircle,
      color: 'text-gray-500',
      bgColor: 'bg-gray-50 border-gray-200'
    };
  };

  const renderIssueCard = (issue: Issue) => {
    const workflowStatus = getWorkflowStatus(issue);
    const StatusIcon = workflowStatus.icon;
    
    return (
      <Card key={issue.id} className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              {getStateIcon(issue.state, issue.hasOpenPR || false)}
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg leading-6 mb-2">
                  <a 
                    href={issue.html_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:underline text-github-text"
                  >
                    #{issue.number}: {issue.title}
                  </a>
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2 text-sm text-github-text-secondary mb-2">
                  <Badge variant={getStateBadgeVariant(issue.state, issue.hasOpenPR || false)}>
                    {getStateBadgeText(issue.state, issue.hasOpenPR || false)}
                  </Badge>
                  {issue.labels.map(label => (
                    <Badge 
                      key={label.id}
                      variant="outline" 
                      className="text-xs"
                      style={{ borderColor: `#${label.color}`, color: `#${label.color}` }}
                    >
                      {label.name}
                    </Badge>
                  ))}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(issue.created_at).toLocaleDateString()}
                  </span>
                </div>
                
                {/* Enhanced workflow status display */}
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${workflowStatus.bgColor} ${workflowStatus.color}`}>
                  <StatusIcon className="h-4 w-4" />
                  {workflowStatus.text}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {issue.assignees && issue.assignees.length > 0 && (
                <div className="flex items-center gap-1">
                  {issue.assignees.map(assignee => (
                    <Avatar key={assignee.id} className="h-6 w-6">
                      <AvatarImage src={assignee.avatar_url} alt={assignee.login} />
                      <AvatarFallback>{assignee.login[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              )}
              {issue.state === 'open' && !isCopilotAssigned(issue) && !issue.hasOpenPR && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAssignToCopilot(issue.number)}
                  disabled={assigningIssue === issue.number}
                  className="text-xs"
                >
                  {assigningIssue === issue.number ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1"></div>
                      Assigning...
                    </>
                  ) : (
                    <>
                      <Bot className="h-3 w-3 mr-1" />
                      Assign to Copilot
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {issue.hasOpenPR && issue.openPRs && issue.openPRs.length > 0 && (
          <CardContent className="pt-0">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm text-blue-800">
                <p className="flex items-center gap-1 mb-2 font-medium">
                  <GitBranch className="h-3 w-3" />
                  {issue.openPRs.length === 1 ? 'Open Pull Request:' : `${issue.openPRs.length} Open Pull Requests:`}
                </p>
                {issue.openPRs.map(pr => (
                  <div key={pr.id} className="ml-4 flex items-center gap-2 py-1">
                    <GitPullRequest className="h-3 w-3" />
                    <a 
                      href={pr.html_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:underline font-medium"
                    >
                      #{pr.number}: {pr.title}
                    </a>
                    <span className="text-xs bg-blue-100 px-2 py-1 rounded">by {pr.user.login}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Repository Issues</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-github-accent-emphasis"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Repository Issues</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-github-text-secondary">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>Failed to load issues</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!issues) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          Issues for {repository.owner}/{repository.repo}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="open" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="open" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Open ({issues.open.length})
            </TabsTrigger>
            <TabsTrigger value="closed" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Recent Closed ({issues.closed.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="open" className="mt-4">
            {issues.open.length === 0 ? (
              <div className="text-center py-8 text-github-text-secondary">
                <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                <p>No open issues</p>
                <p className="text-sm">All caught up! 🎉</p>
              </div>
            ) : (
              <div className="space-y-4">
                {issues.open.map(renderIssueCard)}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="closed" className="mt-4">
            {issues.closed.length === 0 ? (
              <div className="text-center py-8 text-github-text-secondary">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p>No recent closed issues</p>
              </div>
            ) : (
              <div className="space-y-4">
                {issues.closed.map(renderIssueCard)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}