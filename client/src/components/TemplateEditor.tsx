import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getRepositoryTemplates,
  createOrUpdateTemplate,
  deleteTemplate,
  type TaskTemplate,
  type UserRepository,
  type CreateTemplateRequest,
} from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Trash2, Save, Plus } from 'lucide-react';

interface TemplateEditorProps {
  repositories: UserRepository[];
}

interface TemplateFormData {
  type: string;
  title: string;
  body: string;
  labels: string;
  milestone: string;
}

const DEFAULT_TEMPLATE_TYPES = [
  { id: 'tests', label: 'Tests nachziehen' },
  { id: 'lint', label: 'Lint/Format Fehler' },
  { id: 'types', label: 'TypeScript Typen' },
  { id: 'security', label: 'Dependencies aktualisieren' },
  { id: 'docs', label: 'Dokumentation' },
];

export default function TemplateEditor({ repositories }: TemplateEditorProps) {
  const [selectedRepository, setSelectedRepository] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [formData, setFormData] = useState<TemplateFormData>({
    type: '',
    title: '',
    body: '',
    labels: '',
    milestone: '',
  });
  const [isEditing, setIsEditing] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get templates for selected repository
  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['templates', selectedRepository],
    queryFn: () => getRepositoryTemplates(selectedRepository),
    enabled: !!selectedRepository,
  });

  const templates = templatesData?.templates || [];

  // Create/Update template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: (data: CreateTemplateRequest) =>
      createOrUpdateTemplate(selectedRepository, data),
    onSuccess: () => {
      toast({
        title: 'Template Saved',
        description: 'Template has been saved successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['templates', selectedRepository] });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save template',
        variant: 'destructive',
      });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId: string) =>
      deleteTemplate(selectedRepository, templateId),
    onSuccess: () => {
      toast({
        title: 'Template Deleted',
        description: 'Template has been deleted successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['templates', selectedRepository] });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete template',
        variant: 'destructive',
      });
    },
  });

  // Get default template data
  const getDefaultTemplate = (type: string): Partial<TemplateFormData> => {
    const defaults: Record<string, Partial<TemplateFormData>> = {
      tests: {
        title: 'Tests nachziehen (kritische Pfade)',
        body: 'Bitte Unit Tests für Kernfunktionen ergänzen. Ziel: Abdeckung +10%. Closes after CI green.',
        labels: 'chore, tests',
      },
      lint: {
        title: 'Lint/Format Fehler beheben',
        body: 'Bitte eslint/prettier-Probleme lösen und CI grün machen.',
        labels: 'chore, lint',
      },
      types: {
        title: 'TypeScript Typen härten',
        body: 'Bitte TypeScript-Fehler reduzieren; keine suppressions. CI muss grün sein.',
        labels: 'chore, types',
      },
      security: {
        title: 'Dependencies aktualisieren (Sicherheit)',
        body: 'Bitte Sicherheitsupdates für Dependencies durchführen und CI grün machen.',
        labels: 'chore, security',
      },
      docs: {
        title: 'Dokumentation vervollständigen',
        body: 'Bitte fehlende Dokumentation ergänzen und README aktualisieren.',
        labels: 'chore, docs',
      },
    };
    return defaults[type] || {};
  };

  const resetForm = () => {
    setFormData({
      type: '',
      title: '',
      body: '',
      labels: '',
      milestone: '',
    });
    setSelectedTemplate('');
    setIsEditing(false);
  };

  const loadTemplate = (template: TaskTemplate) => {
    setFormData({
      type: template.type,
      title: template.title,
      body: template.body,
      labels: template.labels?.join(', ') || '',
      milestone: template.milestone || '',
    });
    setSelectedTemplate(template.id);
    setIsEditing(true);
  };

  const createNewTemplate = (type: string) => {
    const defaults = getDefaultTemplate(type);
    setFormData({
      type,
      title: defaults.title || '',
      body: defaults.body || '',
      labels: defaults.labels || '',
      milestone: '',
    });
    setSelectedTemplate('');
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!formData.type || !formData.title || !formData.body) {
      toast({
        title: 'Validation Error',
        description: 'Type, title, and body are required.',
        variant: 'destructive',
      });
      return;
    }

    const labels = formData.labels
      .split(',')
      .map(label => label.trim())
      .filter(label => label.length > 0);

    saveTemplateMutation.mutate({
      type: formData.type,
      title: formData.title,
      body: formData.body,
      labels,
      milestone: formData.milestone || undefined,
    });
  };

  const handleDelete = (templateId: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      deleteTemplateMutation.mutate(templateId);
    }
  };

  if (repositories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Template Editor</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-github-muted">
            No repositories available. Please add repositories first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Template Editor</CardTitle>
        <p className="text-sm text-github-muted">
          Customize task templates for each repository
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Repository Selection */}
          <div>
            <Label htmlFor="repository" className="text-sm font-medium">
              Repository
            </Label>
            <select
              id="repository"
              value={selectedRepository}
              onChange={(e) => {
                setSelectedRepository(e.target.value);
                resetForm();
              }}
              className="w-full mt-1 bg-github-bg border border-github-border rounded-lg px-3 py-2 text-github-text focus:outline-none focus:ring-2 focus:ring-github-blue focus:border-transparent"
            >
              <option value="">Select repository...</option>
              {repositories.map((repo) => (
                <option key={repo.id} value={repo.id}>
                  {repo.owner}/{repo.repo}
                </option>
              ))}
            </select>
          </div>

          {selectedRepository && (
            <Tabs defaultValue="templates" className="w-full">
              <TabsList>
                <TabsTrigger value="templates">Templates</TabsTrigger>
                <TabsTrigger value="editor">Editor</TabsTrigger>
              </TabsList>

              <TabsContent value="templates" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {DEFAULT_TEMPLATE_TYPES.map((templateType) => {
                    const existingTemplate = templates.find(
                      (t) => t.type === templateType.id
                    );

                    return (
                      <Card key={templateType.id} className="border border-github-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                              {templateType.label}
                            </CardTitle>
                            <Badge variant={existingTemplate ? 'default' : 'secondary'}>
                              {existingTemplate ? 'Custom' : 'Default'}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          {existingTemplate ? (
                            <div className="space-y-3">
                              <p className="text-sm font-medium">{existingTemplate.title}</p>
                              <p className="text-xs text-github-muted line-clamp-2">
                                {existingTemplate.body}
                              </p>
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => loadTemplate(existingTemplate)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDelete(existingTemplate.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <p className="text-sm text-github-muted">
                                Using default template
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => createNewTemplate(templateType.id)}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Customize
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="editor" className="space-y-4">
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="type">Template Type</Label>
                        <select
                          id="type"
                          value={formData.type}
                          onChange={(e) =>
                            setFormData({ ...formData, type: e.target.value })
                          }
                          disabled={!!selectedTemplate}
                          className="w-full mt-1 bg-github-bg border border-github-border rounded-lg px-3 py-2 text-github-text focus:outline-none focus:ring-2 focus:ring-github-blue focus:border-transparent disabled:opacity-50"
                        >
                          <option value="">Select type...</option>
                          {DEFAULT_TEMPLATE_TYPES.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Label htmlFor="milestone">Milestone (optional)</Label>
                        <Input
                          id="milestone"
                          value={formData.milestone}
                          onChange={(e) =>
                            setFormData({ ...formData, milestone: e.target.value })
                          }
                          placeholder="GitHub milestone title"
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) =>
                          setFormData({ ...formData, title: e.target.value })
                        }
                        placeholder="Task title"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="body">Description</Label>
                      <Textarea
                        id="body"
                        value={formData.body}
                        onChange={(e) =>
                          setFormData({ ...formData, body: e.target.value })
                        }
                        placeholder="Task description"
                        rows={4}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="labels">Labels (comma-separated)</Label>
                      <Input
                        id="labels"
                        value={formData.labels}
                        onChange={(e) =>
                          setFormData({ ...formData, labels: e.target.value })
                        }
                        placeholder="chore, tests, feature"
                        className="mt-1"
                      />
                    </div>

                    <div className="flex space-x-2">
                      <Button onClick={handleSave} disabled={saveTemplateMutation.isPending}>
                        <Save className="h-4 w-4 mr-2" />
                        Save Template
                      </Button>
                      <Button variant="outline" onClick={resetForm}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-github-muted mb-4">
                      Select a template from the Templates tab to edit, or create a new one.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </CardContent>
    </Card>
  );
}