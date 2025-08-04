import fetch from 'node-fetch';

export const createGitHubIssue = async (title: string, body: string) => {
  const repo = process.env.GITHUB_REPO!;
  const token = process.env.GITHUB_TOKEN!;

  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
    },
    body: JSON.stringify({ title, body }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`[GitHub] Issue creation failed: ${msg}`);
  }

  return res.json();
};
