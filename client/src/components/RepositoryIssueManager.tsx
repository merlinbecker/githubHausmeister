import { useState } from 'react';
import { GitBranch } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import IssueList from './IssueList';
import Collaborators from './Collaborators';
import type { UserRepository } from '@/lib/api';

interface RepositoryIssueManagerProps {
  repositories: UserRepository[];
}

export default function RepositoryIssueManager({
  repositories,
}: RepositoryIssueManagerProps) {
  const [selectedRepository, setSelectedRepository] =
    useState<UserRepository | null>(null);
  const [showCollaborators, setShowCollaborators] = useState(false);

  if (!repositories || repositories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Repository Issue Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-github-text-secondary">
            <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No repositories configured</p>
            <p className="text-sm">
              Add repositories to the system to manage their issues
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Repository Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Repository Issue Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1 min-w-0">
              <Select
                value={selectedRepository?.id || ''}
                onValueChange={(value) => {
                  const repo = repositories.find((r) => r.id === value);
                  setSelectedRepository(repo || null);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a repository to manage issues..." />
                </SelectTrigger>
                <SelectContent>
                  {repositories.map((repo) => (
                    <SelectItem key={repo.id} value={repo.id}>
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4" />
                        {repo.owner}/{repo.repo}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedRepository && (
              <div className="flex gap-2">
                <Button
                  variant={showCollaborators ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowCollaborators(!showCollaborators)}
                >
                  {showCollaborators ? 'Hide' : 'Show'} Collaborators
                </Button>
              </div>
            )}
          </div>

          {selectedRepository && (
            <div className="mt-4 p-3 bg-github-canvas-subtle border border-github-border-default rounded-lg">
              <p className="text-sm text-github-text-secondary">
                <strong>Selected:</strong> {selectedRepository.owner}/
                {selectedRepository.repo}
              </p>
              <p className="text-xs text-github-text-secondary mt-1">
                View and manage issues for this repository. You can assign open
                issues to GitHub Copilot for automated processing. Issues with
                open pull requests are already being worked on.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Repository Details */}
      {selectedRepository && (
        <div
          className={
            showCollaborators
              ? 'grid grid-cols-1 lg:grid-cols-3 gap-6'
              : 'grid grid-cols-1 gap-6'
          }
        >
          <div className={showCollaborators ? 'lg:col-span-2' : 'col-span-1'}>
            <IssueList repository={selectedRepository} />
          </div>
          {showCollaborators && (
            <div className="lg:col-span-1">
              <Collaborators repository={selectedRepository} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
