import { Octokit } from 'octokit';

export async function isPRGreen(
  token: string,
  owner: string,
  repo: string,
  sha: string
): Promise<boolean> {
  const octokit = new Octokit({ auth: token });

  try {
    const [statusRes, checksRes] = await Promise.all([
      octokit.rest.repos.getCombinedStatusForRef({ owner, repo, ref: sha }),
      octokit.rest.checks.listForRef({ owner, repo, ref: sha }),
    ]);

    const allStatusesOk =
      statusRes.data.state === 'success' ||
      statusRes.data.statuses.length === 0;
    const allChecksOk = checksRes.data.check_runs.every(
      (cr) => cr.conclusion === 'success' || cr.conclusion === 'neutral'
    );

    return allStatusesOk && allChecksOk;
  } catch (error) {
    console.error('Error checking CI status:', error);
    return false;
  }
}

export async function getCIStatus(
  token: string,
  owner: string,
  repo: string,
  sha: string
) {
  const octokit = new Octokit({ auth: token });

  try {
    const [statusRes, checksRes] = await Promise.all([
      octokit.rest.repos.getCombinedStatusForRef({ owner, repo, ref: sha }),
      octokit.rest.checks.listForRef({ owner, repo, ref: sha }),
    ]);

    return {
      combined: statusRes.data.state,
      statuses: statusRes.data.statuses,
      checks: checksRes.data.check_runs,
    };
  } catch (error) {
    console.error('Error getting CI status:', error);
    return null;
  }
}
