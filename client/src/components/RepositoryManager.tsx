import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Github, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { getGitHubRepositories, addRepository, removeRepository, type GitHubRepository, type UserRepository } from "@/lib/api";

interface RepositoryManagerProps {
  userRepositories: UserRepository[];
  onRefresh: () => void;
}

export default function RepositoryManager({ userRepositories, onRefresh }: RepositoryManagerProps) {
  const [showAddRepo, setShowAddRepo] = useState(false);
  const { toast } = useToast();

  const { data: githubRepos, isLoading: loadingRepos } = useQuery({
    queryKey: ["/api/repositories"],
    queryFn: getGitHubRepositories,
    enabled: showAddRepo,
  });

  const addMutation = useMutation({
    mutationFn: ({ owner, repo }: { owner: string; repo: string }) => addRepository(owner, repo),
    onSuccess: () => {
      toast({
        title: "Repository Added",
        description: "Repository has been added to monitoring and webhooks have been configured.",
      });
      setShowAddRepo(false);
      onRefresh();
      queryClient.invalidateQueries({ queryKey: ["/api/repositories"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add repository",
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeRepository,
    onSuccess: () => {
      toast({
        title: "Repository Removed",
        description: "Repository has been removed from monitoring and webhooks have been deleted.",
      });
      onRefresh();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove repository",
        variant: "destructive",
      });
    },
  });

  const handleAddRepository = (repo: GitHubRepository) => {
    addMutation.mutate({
      owner: repo.owner.login,
      repo: repo.name,
    });
  };

  const handleRemoveRepository = (repositoryId: string) => {
    if (window.confirm("Are you sure you want to remove this repository from monitoring? This will also delete the webhook.")) {
      removeMutation.mutate(repositoryId);
    }
  };

  // Filter out already added repositories
  const availableRepos = githubRepos?.filter(repo => 
    !userRepositories.some(ur => ur.owner === repo.owner.login && ur.repo === repo.name)
  ) || [];

  return (
    <section className="bg-github-surface border border-github-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-github-text">Repository Management</h2>
        <Button
          onClick={() => setShowAddRepo(!showAddRepo)}
          className="px-4 py-2 bg-github-blue text-white rounded-lg font-medium hover:bg-github-blue/80 transition-colors"
          data-testid="button-toggle-add-repo"
        >
          <Plus size={16} className="mr-2" />
          {showAddRepo ? "Cancel" : "Add Repository"}
        </Button>
      </div>

      {/* Current Repositories */}
      <div className="space-y-3 mb-6">
        <h3 className="text-sm font-medium text-github-muted">Monitored Repositories</h3>
        {userRepositories.length === 0 ? (
          <div className="text-center py-8">
            <Github size={48} className="mx-auto text-github-muted mb-4" />
            <h3 className="text-lg font-medium text-github-text mb-2">No Repositories Added</h3>
            <p className="text-github-muted">Add repositories to start automated maintenance tasks.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {userRepositories.map(repo => (
              <div 
                key={repo.id}
                className="flex items-center justify-between p-3 bg-github-bg rounded-lg border border-github-border"
                data-testid={`repo-item-${repo.id}`}
              >
                <div className="flex items-center space-x-3">
                  <Github className="text-github-blue" size={16} />
                  <div>
                    <span className="font-medium text-github-text">{repo.owner}/{repo.repo}</span>
                    <div className="flex items-center space-x-2 text-xs text-github-muted">
                      <span className={`px-2 py-1 rounded-full ${
                        repo.isActive ? "bg-github-green/20 text-github-green" : "bg-github-red/20 text-github-red"
                      }`}>
                        {repo.isActive ? "Active" : "Inactive"}
                      </span>
                      {repo.webhookId && (
                        <span className="bg-github-blue/20 text-github-blue px-2 py-1 rounded-full">
                          Webhook: #{repo.webhookId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <a
                    href={`https://github.com/${repo.owner}/${repo.repo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-github-muted hover:text-github-blue transition-colors"
                    data-testid={`link-repo-${repo.id}`}
                  >
                    <ExternalLink size={16} />
                  </a>
                  <button
                    onClick={() => handleRemoveRepository(repo.id)}
                    disabled={removeMutation.isPending}
                    className="text-github-muted hover:text-github-red transition-colors disabled:opacity-50"
                    data-testid={`button-remove-repo-${repo.id}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Repository Dialog */}
      {showAddRepo && (
        <div className="border-t border-github-border pt-6">
          <h3 className="text-sm font-medium text-github-muted mb-3">Available Repositories</h3>
          {loadingRepos ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-github-blue mx-auto"></div>
            </div>
          ) : availableRepos.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-github-muted">No more repositories available or all repositories are already added.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {availableRepos.map(repo => (
                <div 
                  key={repo.id}
                  className="flex items-center justify-between p-3 bg-github-bg rounded-lg border border-github-border"
                  data-testid={`available-repo-${repo.id}`}
                >
                  <div className="flex items-center space-x-3">
                    <Github className="text-github-muted" size={16} />
                    <div>
                      <span className="font-medium text-github-text">{repo.full_name}</span>
                      <div className="flex items-center space-x-2 text-xs text-github-muted">
                        {repo.permissions?.admin && (
                          <span className="bg-github-green/20 text-github-green px-2 py-1 rounded-full">Admin</span>
                        )}
                        {repo.permissions?.push && !repo.permissions?.admin && (
                          <span className="bg-github-blue/20 text-github-blue px-2 py-1 rounded-full">Push</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleAddRepository(repo)}
                    disabled={addMutation.isPending}
                    size="sm"
                    className="bg-github-green hover:bg-github-green/80 text-white"
                    data-testid={`button-add-repo-${repo.id}`}
                  >
                    <Plus size={14} className="mr-1" />
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}