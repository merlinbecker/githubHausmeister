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
  const query = `
    query {
      viewer {
        organization(login: "github") {
          membersWithRole(first: 1, query: "github-copilot[bot]") {
            nodes {
              id
            }
          }
        }
      }
    }`;
  
  const data: any = await gql(query, {}, token);
  const members = data.viewer?.organization?.membersWithRole?.nodes;
  if (!members || members.length === 0) {
    throw new Error("Copilot agent not found");
  }
  return members[0].id;
}

export async function addAssignee(token: string, issueNodeId: string, assigneeNodeId: string): Promise<void> {
  const mutation = `
    mutation($input: AddAssigneesToAssignableInput!) {
      addAssigneesToAssignable(input: $input) {
        assignable {
          id
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
