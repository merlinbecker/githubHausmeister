import { Octokit } from "octokit";

export const octokit = new Octokit({ 
  auth: process.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN_ENV_VAR || "default_key"
});

export async function createIssue(owner: string, repo: string, title: string, body: string, labels: string[] = []) {
  const { data } = await octokit.rest.issues.create({ 
    owner, 
    repo, 
    title, 
    body, 
    labels 
  });
  return data;
}

export async function getIssue(owner: string, repo: string, issue_number: number) {
  return (await octokit.rest.issues.get({ owner, repo, issue_number })).data;
}

export async function createReviewApprove(owner: string, repo: string, pull_number: number, body = "LGTM (auto)") {
  return octokit.rest.pulls.createReview({ 
    owner, 
    repo, 
    pull_number, 
    event: "APPROVE", 
    body 
  });
}

export async function mergePullRequest(owner: string, repo: string, pull_number: number, method: "merge"|"squash"|"rebase" = "squash") {
  return octokit.rest.pulls.merge({ 
    owner, 
    repo, 
    pull_number, 
    merge_method: method 
  });
}

export async function listPRsForIssue(owner: string, repo: string, issue_number: number) {
  const { data } = await octokit.rest.search.issuesAndPullRequests({
    q: `repo:${owner}/${repo} type:pr in:body is:open "${`#${issue_number}`}"`,
  });
  return data.items;
}

export async function registerWebhook(owner: string, repo: string, webhookUrl: string, secret: string) {
  const events = ["issues", "pull_request", "workflow_run", "check_suite"];
  
  try {
    const { data } = await octokit.rest.repos.createWebhook({
      owner,
      repo,
      config: {
        url: webhookUrl,
        content_type: "json",
        secret,
      },
      events,
    });
    return data;
  } catch (error: any) {
    if (error.status === 422) {
      // Webhook might already exist
      const { data: hooks } = await octokit.rest.repos.listWebhooks({ owner, repo });
      const existingHook = hooks.find(hook => hook.config?.url === webhookUrl);
      if (existingHook) {
        return existingHook;
      }
    }
    throw error;
  }
}
