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

export async function checkCopilotAvailability(token: string, owner: string, repo: string): Promise<{ available: boolean; username?: string }> {
  const octokit = new Octokit({ auth: token });
  
  // Check if copilot-swe-agent can be assigned to this repository
  const copilotUsernames = ["copilot-swe-agent", "github-copilot[bot]"];
  
  for (const username of copilotUsernames) {
    try {
      // Check if user exists and can be assigned to repository
      const response = await octokit.rest.repos.checkCollaborator({
        owner,
        repo,
        username
      });
      
      if (response.status === 204) {
        console.log(`Found assignable Copilot agent: ${username}`);
        return { available: true, username };
      }
    } catch (error: any) {
      // Check if user exists at all
      try {
        await octokit.rest.users.getByUsername({ username });
        console.log(`Copilot agent ${username} exists but not assignable to ${owner}/${repo}`);
      } catch (userError) {
        console.log(`Copilot agent ${username} does not exist`);
      }
    }
  }
  
  return { available: false };
}

export async function assignCopilotToIssue(token: string, owner: string, repo: string, issueNumber: number): Promise<{ success: boolean; assignedAgent?: string; error?: string }> {
  const octokit = new Octokit({ auth: token });
  
  // First, check if Copilot is available
  const copilotCheck = await checkCopilotAvailability(token, owner, repo);
  
  if (!copilotCheck.available) {
    return { 
      success: false, 
      error: "Copilot agent not available for this repository. Repository may not have Copilot enabled or agent not configured." 
    };
  }
  
  try {
    // Use REST API to assign the issue
    const response = await octokit.rest.issues.addAssignees({
      owner,
      repo,
      issue_number: issueNumber,
      assignees: [copilotCheck.username!]
    });
    
    // Verify assignment was successful
    const assignees = response.data.assignees || [];
    const copilotAssigned = assignees.some(assignee => 
      assignee.login === copilotCheck.username
    );
    
    if (copilotAssigned) {
      console.log(`✓ Successfully assigned ${copilotCheck.username} to issue #${issueNumber}`);
      return { success: true, assignedAgent: copilotCheck.username };
    } else {
      return { 
        success: false, 
        error: `Assignment API call succeeded but ${copilotCheck.username} not found in assignees list` 
      };
    }
    
  } catch (error: any) {
    console.error("Error assigning Copilot to issue:", error);
    return { 
      success: false, 
      error: `Assignment failed: ${error.message}` 
    };
  }
}

export async function verifyCopilotAssignment(token: string, owner: string, repo: string, issueNumber: number): Promise<{ isAssigned: boolean; assignedCopilot?: string }> {
  const octokit = new Octokit({ auth: token });
  
  try {
    const { data: issue } = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber
    });
    
    const assignees = issue.assignees || [];
    const copilotUsernames = ["copilot-swe-agent", "github-copilot[bot]"];
    
    for (const assignee of assignees) {
      if (copilotUsernames.includes(assignee.login)) {
        return { isAssigned: true, assignedCopilot: assignee.login };
      }
    }
    
    return { isAssigned: false };
  } catch (error) {
    console.error("Error verifying Copilot assignment:", error);
    return { isAssigned: false };
  }
}

export async function findSimilarOpenIssues(token: string, owner: string, repo: string, title: string, labels: string[] = []): Promise<any[]> {
  const octokit = new Octokit({ auth: token });
  
  // Extract keywords from title for search
  const keywords = title.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3)
    .slice(0, 3); // Use first 3 meaningful words
  
  // Search for similar open issues
  const queries = [
    // Search by title keywords
    keywords.length > 0 ? `repo:${owner}/${repo} type:issue state:open ${keywords.join(' ')}` : null,
    // Search by labels if provided
    labels.length > 0 ? `repo:${owner}/${repo} type:issue state:open label:"${labels[0]}"` : null
  ].filter(Boolean);
  
  const allResults: any[] = [];
  
  for (const query of queries) {
    try {
      const { data } = await octokit.rest.search.issuesAndPullRequests({
        q: query!,
        per_page: 10
      });
      allResults.push(...data.items);
    } catch (error) {
      console.warn("Error searching for similar issues:", error);
    }
  }
  
  // Remove duplicates and filter out PRs
  const uniqueIssues = allResults
    .filter(item => !item.pull_request) // Only issues, not PRs
    .filter((issue, index, array) => 
      index === array.findIndex(i => i.id === issue.id) // Remove duplicates
    );
  
  return uniqueIssues;
}

export async function checkForDuplicateIssue(token: string, owner: string, repo: string, title: string, labels: string[] = []): Promise<{ isDuplicate: boolean; existingIssue?: any }> {
  const similarIssues = await findSimilarOpenIssues(token, owner, repo, title, labels);
  
  if (similarIssues.length === 0) {
    return { isDuplicate: false };
  }
  
  // Check for exact or very similar titles
  const titleLower = title.toLowerCase();
  const exactMatch = similarIssues.find(issue => 
    issue.title.toLowerCase() === titleLower
  );
  
  if (exactMatch) {
    return { isDuplicate: true, existingIssue: exactMatch };
  }
  
  // Check for similar titles (60% similarity threshold)
  const similarMatch = similarIssues.find(issue => {
    const similarity = calculateSimilarity(titleLower, issue.title.toLowerCase());
    return similarity > 0.6;
  });
  
  if (similarMatch) {
    return { isDuplicate: true, existingIssue: similarMatch };
  }
  
  return { isDuplicate: false };
}

function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);
  
  const allWords = new Set([...words1, ...words2]);
  const commonWords = words1.filter(word => words2.includes(word));
  
  return commonWords.length / allWords.size;
}
