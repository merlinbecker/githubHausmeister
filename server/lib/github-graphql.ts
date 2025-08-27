const GQL = "https://api.github.com/graphql";
export async function gql<T>(query: string, variables: Record<string, any> = {}, token: string): Promise<T> {
  const res = await fetch(GQL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  
  if (!res.ok) {
    throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`);
  }
  
  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  
  return json.data as T;
}

export async function getIssueNodeId(token: string, owner: string, repo: string, issueNumber: number): Promise<string> {
  const query = `
    query($owner: String!, $repo: String!, $issueNumber: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $issueNumber) {
          id
        }
      }
    }`;
  
  const data: any = await gql(query, { owner, repo, issueNumber }, token);
  return data.repository.issue.id;
}

export async function getCopilotNodeId(token: string): Promise<string> {
  // Method 1: Try direct search for github-copilot bot
  try {
    const searchQuery = `
      query {
        search(query: "github-copilot in:login type:user", type: USER, first: 5) {
          nodes {
            ... on User {
              id
              login
            }
          }
        }
      }`;
    
    const searchData: any = await gql(searchQuery, {}, token);
    const searchNodes = searchData.search?.nodes || [];
    
    for (const node of searchNodes) {
      if (node.login === "github-copilot[bot]" || node.login === "github-copilot") {
        console.log("Found Copilot agent via search:", node.login);
        return node.id;
      }
    }
  } catch (error) {
    console.log("Search method failed:", error);
  }

  // Method 2: Try to use REST API to find the bot
  try {
    const octokit = await import("octokit");
    const client = new octokit.Octokit({ auth: token });
    
    // Get user's organizations to search for Copilot
    const { data: user } = await client.rest.users.getAuthenticated();
    
    // Check if user has access to Copilot
    try {
      const { data: copilotUser } = await client.rest.users.getByUsername({
        username: "github-copilot[bot]"
      });
      
      // Convert to GraphQL node ID (approximate)
      const nodeId = Buffer.from(`04:User${copilotUser.id}`).toString('base64');
      console.log("Found Copilot agent via REST API");
      return nodeId;
    } catch (restError) {
      console.log("REST method failed:", restError);
    }
  } catch (error) {
    console.log("REST fallback failed:", error);
  }

  // Method 3: Fallback to current user
  console.log("Using current user as assignee fallback");
  const fallbackQuery = `
    query {
      viewer {
        login
        id
      }
    }`;
  
  const fallbackData: any = await gql(fallbackQuery, {}, token);
  console.log("Using fallback assignee (current user):", fallbackData.viewer.login);
  return fallbackData.viewer.id;
}

export async function addAssignee(token: string, issueNodeId: string, assigneeNodeId: string): Promise<void> {
  const mutation = `
    mutation($input: AddAssigneesToAssignableInput!) {
      addAssigneesToAssignable(input: $input) {
        assignable {
          __typename
        }
      }
    }`;
  
  await gql(mutation, {
    input: {
      assignableId: issueNodeId,
      assigneeIds: [assigneeNodeId]
    }
  }, token);
}
