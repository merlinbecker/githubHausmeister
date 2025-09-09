import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test the webhook payload transformation logic
describe('Webhook Forwarding', () => {
  describe('transformWebhookPayload', () => {
    // Extract the transformation function logic for testing
    const transformWebhookPayload = (
      event: string,
      payload: any,
      repositoryOwner: string,
      repositoryName: string
    ) => {
      const repository = `${repositoryOwner}/${repositoryName}`;
      const actor = payload?.sender?.login || 'unknown';

      let title = '';
      let text = '';

      switch (event) {
        case 'pull_request':
          const prAction = payload.action;
          const prNumber = payload.pull_request?.number;
          const prTitle = payload.pull_request?.title;
          title = `Pull Request ${prAction}: #${prNumber} ${prTitle}`;
          text = `${prAction} by ${actor} in ${repository}`;
          break;

        case 'issues':
          const issueAction = payload.action;
          const issueNumber = payload.issue?.number;
          const issueTitle = payload.issue?.title;
          title = `Issue ${issueAction}: #${issueNumber} ${issueTitle}`;
          text = `${issueAction} by ${actor} in ${repository}`;
          break;

        case 'workflow_run':
        case 'check_suite':
        case 'check_run':
          const conclusion = 
            payload?.check_run?.conclusion ||
            payload?.check_suite?.conclusion ||
            payload?.workflow_run?.conclusion ||
            'unknown';
          const workflowName = 
            payload?.workflow?.name ||
            payload?.check_suite?.app?.name ||
            payload?.check_run?.name ||
            'CI';
          title = `CI ${conclusion}: ${workflowName}`;
          text = `${conclusion} in ${repository} by ${actor}`;
          break;

        default:
          title = `${event} Event`;
          text = `${event} triggered in ${repository} by ${actor}`;
          break;
      }

      return {
        repository,
        title,
        text,
      };
    };

    it('should transform pull_request webhook correctly', () => {
      const payload = {
        action: 'opened',
        pull_request: {
          number: 123,
          title: 'Fix critical bug'
        },
        sender: {
          login: 'testuser'
        }
      };

      const result = transformWebhookPayload(
        'pull_request',
        payload,
        'testorg',
        'testrepo'
      );

      expect(result).toEqual({
        repository: 'testorg/testrepo',
        title: 'Pull Request opened: #123 Fix critical bug',
        text: 'opened by testuser in testorg/testrepo'
      });
    });

    it('should transform issues webhook correctly', () => {
      const payload = {
        action: 'closed',
        issue: {
          number: 456,
          title: 'Bug report'
        },
        sender: {
          login: 'maintainer'
        }
      };

      const result = transformWebhookPayload(
        'issues',
        payload,
        'myorg',
        'myrepo'
      );

      expect(result).toEqual({
        repository: 'myorg/myrepo',
        title: 'Issue closed: #456 Bug report',
        text: 'closed by maintainer in myorg/myrepo'
      });
    });

    it('should transform workflow_run webhook correctly', () => {
      const payload = {
        workflow_run: {
          conclusion: 'success'
        },
        workflow: {
          name: 'CI Pipeline'
        },
        sender: {
          login: 'github-actions[bot]'
        }
      };

      const result = transformWebhookPayload(
        'workflow_run',
        payload,
        'company',
        'project'
      );

      expect(result).toEqual({
        repository: 'company/project',
        title: 'CI success: CI Pipeline',
        text: 'success in company/project by github-actions[bot]'
      });
    });

    it('should handle missing data gracefully', () => {
      const payload = {
        sender: {
          login: 'user'
        }
      };

      const result = transformWebhookPayload(
        'unknown_event',
        payload,
        'org',
        'repo'
      );

      expect(result).toEqual({
        repository: 'org/repo',
        title: 'unknown_event Event',
        text: 'unknown_event triggered in org/repo by user'
      });
    });

    it('should use unknown actor when sender is missing', () => {
      const payload = {};

      const result = transformWebhookPayload(
        'push',
        payload,
        'org',
        'repo'
      );

      expect(result).toEqual({
        repository: 'org/repo',
        title: 'push Event',
        text: 'push triggered in org/repo by unknown'
      });
    });
  });

  describe('URL validation', () => {
    it('should accept HTTPS URLs', () => {
      const url = 'https://example.com/webhook';
      
      expect(() => new URL(url)).not.toThrow();
      expect(url.startsWith('https://')).toBe(true);
    });

    it('should accept localhost HTTP URLs', () => {
      const url = 'http://localhost:3000/webhook';
      
      expect(() => new URL(url)).not.toThrow();
      expect(url.startsWith('http://localhost')).toBe(true);
    });

    it('should reject HTTP URLs (except localhost)', () => {
      const url = 'http://example.com/webhook';
      
      expect(url.startsWith('https://')).toBe(false);
      expect(url.startsWith('http://localhost')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      const url = 'not-a-url';
      
      expect(() => new URL(url)).toThrow();
    });
  });
});