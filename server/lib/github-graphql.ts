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

export async function getCopilotNodeId(token: string, owner: string, repo: string): Promise<string> {
  // Method 1: Check suggested actors for repository (most reliable)
  try {
    const suggestedActorsQuery = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          assignableUsers(first: 100) {
            nodes {
              id
              login
              __typename
            }
          }
        }
      }`;
    
    const actorsData: any = await gql(suggestedActorsQuery, { owner, repo }, token);
    const assignableUsers = actorsData.repository?.assignableUsers?.nodes || [];
    
    // Look for Copilot agents
    for (const user of assignableUsers) {
      if (user.login === "copilot-swe-agent" || user.login === "github-copilot[bot]" || user.login.includes("copilot")) {
        console.log("Found Copilot agent via assignable users:", user.login);
        return user.id;
      }
    }
  } catch (error) {
    console.log("Suggested actors method failed:", error);
  }

  // Method 2: Direct search for copilot-swe-agent
  try {
    const searchQuery = `
      query {
        search(query: "copilot-swe-agent in:login type:user", type: USER, first: 5) {
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
      if (node.login === "copilot-swe-agent" || node.login === "github-copilot[bot]") {
        console.log("Found Copilot agent via search:", node.login);
        return node.id;
      }
    }
  } catch (error) {
    console.log("Search method failed:", error);
  }

  // Method 3: Try REST API with correct bot username
  try {
    const octokit = await import("octokit");
    const client = new octokit.Octokit({ auth: token });
    
    const botUsernames = ["copilot-swe-agent", "github-copilot[bot]"];
    
    for (const username of botUsernames) {
      try {
        const { data: copilotUser } = await client.rest.users.getByUsername({
          username: username
        });
        
        // Get proper GraphQL node ID
        const nodeIdQuery = `
          query($login: String!) {
            user(login: $login) {
              id
              login
            }
          }`;
        
        const nodeData: any = await gql(nodeIdQuery, { login: username }, token);
        if (nodeData.user) {
          console.log("Found Copilot agent via REST + GraphQL:", nodeData.user.login);
          return nodeData.user.id;
        }
      } catch (restError) {
        console.log(`REST method failed for ${username}:`, restError);
      }
    }
  } catch (error) {
    console.log("REST fallback failed:", error);
  }

  // Method 4: Fallback to current user
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
