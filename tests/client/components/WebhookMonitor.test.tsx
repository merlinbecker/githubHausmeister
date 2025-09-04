import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WebhookMonitor from '@/components/WebhookMonitor';
import type { UserRepository, WebhookDelivery } from '@shared/schema';

// Mock the API functions
vi.mock('@/lib/api', () => ({
  getWebhookDeliveries: vi.fn(),
  testWebhook: vi.fn(),
}));

const mockRepositories: UserRepository[] = [
  {
    id: 'repo-1',
    userId: 'user-1',
    owner: 'testowner',
    repo: 'testrepo',
    webhookId: 123,
    isActive: true,
    createdAt: new Date(),
  },
  {
    id: 'repo-2',
    userId: 'user-1',
    owner: 'testowner',
    repo: 'anotherepo',
    webhookId: 456,
    isActive: true,
    createdAt: new Date(),
  },
];

const mockWebhookDeliveries: WebhookDelivery[] = [
  {
    id: 'delivery-1',
    event: 'pull_request',
    processed: true,
    repositoryOwner: 'testowner',
    repositoryName: 'testrepo',
    action: 'opened',
    actorLogin: 'testuser',
    payloadSummary: {
      action: 'opened',
      actorLogin: 'testuser',
      pullRequestNumber: 42,
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
  },
  {
    id: 'delivery-2',
    event: 'check_suite',
    processed: true,
    repositoryOwner: 'testowner',
    repositoryName: 'testrepo',
    action: 'completed',
    actorLogin: 'github-actions[bot]',
    payloadSummary: {
      action: 'completed',
      actorLogin: 'github-actions[bot]',
      conclusion: 'success',
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 2), // 2 minutes ago
  },
];

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('WebhookMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders webhook monitor with repositories', async () => {
    const { getWebhookDeliveries } = await import('@/lib/api');
    vi.mocked(getWebhookDeliveries).mockResolvedValue(mockWebhookDeliveries);

    renderWithQueryClient(
      <WebhookMonitor repositories={mockRepositories} />
    );

    expect(screen.getByText('Webhook Monitor')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /test webhook/i })).toBeInTheDocument();
    expect(screen.getByText(/recent webhook events/i)).toBeInTheDocument();
    
    // Check if repository select has options
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('testowner/testrepo')).toBeInTheDocument();
    expect(screen.getByText('testowner/anotherepo')).toBeInTheDocument();
  });

  it('displays webhook deliveries when loaded', async () => {
    const { getWebhookDeliveries } = await import('@/lib/api');
    vi.mocked(getWebhookDeliveries).mockResolvedValue(mockWebhookDeliveries);

    renderWithQueryClient(
      <WebhookMonitor repositories={mockRepositories} />
    );

    await waitFor(() => {
      expect(screen.getByText('pull_request')).toBeInTheDocument();
      expect(screen.getByText('check_suite')).toBeInTheDocument();
      expect(screen.getByText('opened')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.getByText('PR #42')).toBeInTheDocument();
      expect(screen.getByText('success')).toBeInTheDocument();
    });
  });

  it('allows testing webhooks', async () => {
    const { getWebhookDeliveries, testWebhook } = await import('@/lib/api');
    vi.mocked(getWebhookDeliveries).mockResolvedValue([]);
    vi.mocked(testWebhook).mockResolvedValue({ 
      ok: true,
      json: async () => ({ success: true })
    } as Response);

    renderWithQueryClient(
      <WebhookMonitor repositories={mockRepositories} />
    );

    // Select a repository
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'repo-1' } });

    // Click test webhook button (use getByRole to be more specific)
    const testButton = screen.getByRole('button', { name: /test webhook/i });
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(testWebhook).toHaveBeenCalledWith('repo-1');
    });
  });

  it('shows auto-refresh controls', async () => {
    const { getWebhookDeliveries } = await import('@/lib/api');
    vi.mocked(getWebhookDeliveries).mockResolvedValue([]);

    renderWithQueryClient(
      <WebhookMonitor repositories={mockRepositories} />
    );

    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('handles empty state correctly', async () => {
    const { getWebhookDeliveries } = await import('@/lib/api');
    vi.mocked(getWebhookDeliveries).mockResolvedValue([]);

    renderWithQueryClient(
      <WebhookMonitor repositories={mockRepositories} />
    );

    await waitFor(() => {
      expect(screen.getByText('No Webhook Events')).toBeInTheDocument();
      expect(screen.getByText('Webhook events will appear here as they are received')).toBeInTheDocument();
    });
  });
});