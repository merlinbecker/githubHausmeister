import { gql } from './github-graphql';

/**
 * @deprecated Use CopilotAssignmentService from './copilot-assignment' instead.
 * This function will be removed in a future version.
 */
export async function getCopilotNodeId(token: string): Promise<string> {
  const configured =
    process.env.COPILOT_ACTOR_ID || process.env.COPILOT_ACTOR_ID_ENV_VAR;

  if (configured && configured.trim()) {
    return configured.trim();
  }

  // Try to find Copilot agent via GraphQL
  const query = `
    query($login: String!) {
      user(login: $login) { id login }
      organization(login: $login) { id login }
    }`;

  const candidates = ['copilot', 'github-copilot', 'copilot-swe-agent'];

  for (const login of candidates) {
    try {
      const data: { user?: { id: string }; organization?: { id: string } } =
        await gql(query, { login }, token);
      if (data?.user?.id) return data.user.id;
      if (data?.organization?.id) return data.organization.id;
    } catch {
      // Continue to next candidate
    }
  }

  throw new Error(
    'COPILOT_ACTOR_ID not configured and Copilot agent ID not found. Please set environment variable.'
  );
}

/**
 * @deprecated Use CopilotAssignmentService.assignViaGraphQL from './copilot-assignment' instead.
 * This function will be removed in a future version.
 */
export async function addAssignee(
  issueNodeId: string,
  assigneeNodeId: string,
  token: string
) {
  const mutation = `
    mutation($assignableId: ID!, $assigneeIds: [ID!]!) {
      addAssigneesToAssignable(input: {assignableId: $assignableId, assigneeIds: $assigneeIds}) {
        assignable { 
          ... on Issue { 
            id 
            number 
            title 
          } 
        }
      }
    }`;

  return gql(
    mutation,
    {
      assignableId: issueNodeId,
      assigneeIds: [assigneeNodeId],
    },
    token
  );
}
