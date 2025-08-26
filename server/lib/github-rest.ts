import { Octokit } from "octokit";

export async function createIssue(token: string, owner: string, repo: string, title: string, body: string, labels: string[] = []) {
  const octokit = new Octokit({ auth: token });
  const { data } = await octokit.rest.issues.create({ 
    owner, 
    repo, 
    title, 
    body, 
    labels 
  });
  return data;
}

export async function getIssue(token: string, owner: string, repo: string, issue_number: number) {
  const octokit = new Octokit({ auth: token });
  return (await octokit.rest.issues.get({ owner, repo, issue_number })).data;
}

export async function createReviewApprove(token: string, owner: string, repo: string, pull_number: number, body = "LGTM (auto)") {
  const octokit = new Octokit({ auth: token });
  return octokit.rest.pulls.createReview({ 
    owner, 
    repo, 
    pull_number, 
    event: "APPROVE", 
    body 
  });
}

export async function mergePullRequest(token: string, owner: string, repo: string, pull_number: number, method: "merge"|"squash"|"rebase" = "squash") {
  const octokit = new Octokit({ auth: token });
  return octokit.rest.pulls.merge({ 
    owner, 
    repo, 
    pull_number, 
    merge_method: method 
  });
}

export async function listPRsForIssue(token: string, owner: string, repo: string, issue_number: number) {
  const octokit = new Octokit({ auth: token });
  const { data } = await octokit.rest.search.issuesAndPullRequests({
    q: `repo:${owner}/${repo} type:pr in:body is:open "${`#${issue_number}`}"`,
  });
  return data.items;
}

export async function registerWebhook(token: string, owner: string, repo: string, webhookUrl: string, secret: string) {
  const octokit = new Octokit({ auth: token });
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

export async function deleteWebhook(token: string, owner: string, repo: string, hookId: number) {
  const octokit = new Octokit({ auth: token });
  return octokit.rest.repos.deleteWebhook({
    owner,
    repo,
    hook_id: hookId,
  });
}
