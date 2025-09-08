import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Link, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWebhookForwardUrl, setWebhookForwardUrl } from '@/lib/api';

export function WebhookSettings() {
  const [forwardUrl, setLocalForwardUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    data: currentUrl,
    isLoading,
  } = useQuery({
    queryKey: ['webhook-forward-url'],
    queryFn: getWebhookForwardUrl,
  });

  const mutation = useMutation({
    mutationFn: setWebhookForwardUrl,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-forward-url'] });
      setError(null);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  useEffect(() => {
    if (currentUrl) {
      setLocalForwardUrl(currentUrl.forwardUrl || '');
    }
  }, [currentUrl]);

  const handleSave = () => {
    // Basic URL validation
    if (forwardUrl) {
      try {
        new URL(forwardUrl);
        if (!forwardUrl.startsWith('https://') && !forwardUrl.startsWith('http://localhost')) {
          setError('Only HTTPS URLs are allowed (except localhost for development)');
          return;
        }
      } catch {
        setError('Please enter a valid URL');
        return;
      }
    }

    mutation.mutate(forwardUrl || null);
  };

  const hasChanges = forwardUrl !== (currentUrl?.forwardUrl || '');
  const isSaving = mutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link size={20} />
          Webhook Forwarding
        </CardTitle>
        <CardDescription>
          Configure a URL to receive webhook notifications from your monitored repositories
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="webhook-url">Forward URL</Label>
          <Input
            id="webhook-url"
            type="url"
            placeholder="https://example.com/webhook"
            value={forwardUrl}
            onChange={(e) => {
              setLocalForwardUrl(e.target.value);
              setError(null);
            }}
            disabled={isSaving || isLoading}
          />
          <p className="text-xs text-github-muted">
            All webhook events from your monitored repositories will be forwarded to this URL
            with a simplified payload format.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {currentUrl?.forwardUrl && !hasChanges && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle size={16} />
            Webhook forwarding is configured and active
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-sm font-medium text-github-text">Forwarded Payload Format</h4>
          <pre className="text-xs bg-github-bg p-3 rounded-md border border-github-border overflow-x-auto">
{`{
  "repository": "owner/repo-name",
  "title": "Pull Request opened: #123 Fix bug",
  "text": "opened by username in owner/repo-name"
}`}
          </pre>
        </div>

        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving || isLoading}
          className="w-full"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save size={16} className="mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}