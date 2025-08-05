import fetch from 'node-fetch';
import { GITHUB_REPO, GITHUB_TOKEN } from '../config.js';

export const createGitHubIssue = async (title: string, body: string) => {
  const repo = GITHUB_REPO;
  const token = GITHUB_TOKEN;

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
