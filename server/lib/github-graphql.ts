const GQL = "https://api.github.com/graphql";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN_ENV_VAR || "default_key";

export async function gql<T>(query: string, variables: Record<string, any> = {}): Promise<T> {
  const res = await fetch(GQL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
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

export async function getIssueNodeId(owner: string, repo: string, issueNumber: number): Promise<string> {
  const query = `
    query($owner: String!, $repo: String!, $issueNumber: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $issueNumber) {
          id
        }
      }
    }`;
  
  const data: any = await gql(query, { owner, repo, issueNumber });
  return data.repository.issue.id;
}
