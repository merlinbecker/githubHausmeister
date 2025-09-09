import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  createTasks,
  getRepositoryTemplates,
  type CreateTasksRequest,
  type UserRepository,
  type TaskTemplate,
} from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Plus, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface TaskCreationFormProps {
  repositories: UserRepository[];
  onRefresh: () => void;
}

export default function TaskCreationForm({
  repositories,
  onRefresh,
}: TaskCreationFormProps) {
  const [selectedRepositoryId, setSelectedRepositoryId] = useState('');
  const [taskCount, setTaskCount] = useState(1);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: createTasks,
    onSuccess: () => {
      toast({
        title: 'Tasks Created',
        description: 'Tasks have been added to the queue successfully.',
      });
      setSelectedTemplates([]);
      setSelectedRepositoryId('');
      setTaskCount(1);
      onRefresh();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create tasks',
        variant: 'destructive',
      });
    },
  });

  // Use only active repositories
  const activeRepositories = repositories.filter((repo) => repo.isActive);

  // Load custom templates for selected repository
  const { data: templatesData } = useQuery({
    queryKey: ['templates', selectedRepositoryId],
    queryFn: () => getRepositoryTemplates(selectedRepositoryId),
    enabled: !!selectedRepositoryId,
  });

  const customTemplates = templatesData?.templates || [];

  // Default template types with labels
  const defaultTemplateTypes = [
    {
      id: 'tests',
      label: 'Tests nachziehen (kritische Pfade)',
      type: 'tests',
    },
    {
      id: 'lint',
      label: 'Lint/Format Fehler beheben',
      type: 'lint',
    },
    {
      id: 'types',
      label: 'TypeScript Typen härten',
      type: 'types',
    },
    {
      id: 'security',
      label: 'Dependencies aktualisieren (Sicherheit)',
      type: 'security',
    },
    {
      id: 'docs',
      label: 'Dokumentation vervollständigen',
      type: 'docs',
    },
  ];

  // Create template display list combining custom and default templates
  const templates = defaultTemplateTypes.map(defaultTemplate => {
    const customTemplate = customTemplates.find(ct => ct.type === defaultTemplate.type);
    return {
      id: defaultTemplate.id,
      label: customTemplate ? customTemplate.title : defaultTemplate.label,
      type: defaultTemplate.type,
      isCustom: !!customTemplate,
      customTemplate,
    };
  });

  const handleTemplateChange = (templateId: string, checked: boolean) => {
    if (checked) {
      setSelectedTemplates([...selectedTemplates, templateId]);
    } else {
      setSelectedTemplates(selectedTemplates.filter((id) => id !== templateId));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRepositoryId) {
      toast({
        title: 'Repository Required',
        description: 'Please select a repository.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedTemplates.length === 0) {
      toast({
        title: 'Templates Required',
        description: 'Please select at least one task template.',
        variant: 'destructive',
      });
      return;
    }

    const data: CreateTasksRequest = {
      repositoryId: selectedRepositoryId,
      templates: selectedTemplates,
      count: taskCount,
    };

    createMutation.mutate(data);
  };

  return (
    <section className="bg-github-surface border border-github-border rounded-lg p-6">
      <h2 className="text-lg font-semibold text-github-text mb-4">
        Create New Tasks
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label
              htmlFor="repository"
              className="block text-sm font-medium text-github-text mb-2"
            >
              Repository
            </Label>
            {activeRepositories.length === 0 ? (
              <div className="p-3 bg-github-bg border border-github-border rounded-lg text-github-muted text-center">
                No repositories added. Please add repositories first in the
                Repository Management section.
              </div>
            ) : (
              <select
                id="repository"
                value={selectedRepositoryId}
                onChange={(e) => {
                  setSelectedRepositoryId(e.target.value);
                  setSelectedTemplates([]); // Reset template selection when repository changes
                }}
                className="w-full bg-github-bg border border-github-border rounded-lg px-3 py-2 text-github-text focus:outline-none focus:ring-2 focus:ring-github-blue focus:border-transparent"
                data-testid="select-repository"
              >
                <option value="">Select repository...</option>
                {activeRepositories.map((repo) => (
                  <option key={repo.id} value={repo.id}>
                    {repo.owner}/{repo.repo}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <Label
              htmlFor="taskCount"
              className="block text-sm font-medium text-github-text mb-2"
            >
              Number of Tasks
            </Label>
            <Input
              id="taskCount"
              type="number"
              min="1"
              max="10"
              value={taskCount}
              onChange={(e) => setTaskCount(Number(e.target.value))}
              className="w-full bg-github-bg border border-github-border rounded-lg px-3 py-2 text-github-text focus:outline-none focus:ring-2 focus:ring-github-blue focus:border-transparent"
              data-testid="input-task-count"
            />
          </div>
        </div>

        <div>
          <Label className="block text-sm font-medium text-github-text mb-2">
            Task Templates
          </Label>
          <div className="space-y-3">
            {templates.map((template) => (
              <div key={template.id} className="border border-github-border rounded-lg p-3">
                <label className="flex items-start space-x-3">
                  <Checkbox
                    checked={selectedTemplates.includes(template.id)}
                    onCheckedChange={(checked) =>
                      handleTemplateChange(template.id, checked as boolean)
                    }
                    className="w-4 h-4 mt-1 text-github-blue bg-github-bg border-github-border rounded focus:ring-github-blue focus:ring-2"
                    data-testid={`checkbox-${template.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-medium text-github-text">
                        {template.label}
                      </span>
                      <Badge variant={template.isCustom ? 'default' : 'secondary'} className="text-xs">
                        {template.isCustom ? 'Custom' : 'Default'}
                      </Badge>
                      <span className="px-2 py-1 bg-github-border text-github-muted text-xs rounded-full">
                        {template.type}
                      </span>
                    </div>
                    {template.customTemplate && (
                      <div className="text-xs text-github-muted space-y-1">
                        <p className="line-clamp-2">{template.customTemplate.body}</p>
                        {template.customTemplate.milestone && (
                          <p className="text-github-blue">
                            📌 Milestone: {template.customTemplate.milestone}
                          </p>
                        )}
                        {template.customTemplate.labels && template.customTemplate.labels.length > 0 && (
                          <p>
                            🏷️ Labels: {template.customTemplate.labels.join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-github-muted flex items-center">
            <Info size={16} className="mr-1" />
            Tasks will be queued and processed sequentially
          </div>
          <Button
            type="submit"
            disabled={
              createMutation.isPending || activeRepositories.length === 0
            }
            className="px-6 py-2 bg-github-blue text-white rounded-lg font-medium hover:bg-github-blue/80 transition-colors disabled:opacity-50"
            data-testid="button-add-tasks"
          >
            <Plus size={16} className="mr-2" />
            {createMutation.isPending ? 'Adding...' : 'Add to Queue'}
          </Button>
        </div>
      </form>
    </section>
  );
}
