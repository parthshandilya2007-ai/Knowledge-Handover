import fs from "fs/promises";
import path from "path";
import { env } from "../config/env.js";
import { TokenCrypto } from "../utils/crypto.js";

export interface NormalizedSourceItem {
  itemType: "readme" | "issue" | "pull_request" | "commit" | "doc";
  itemId: string;
  title: string;
  url: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface GithubRepoData {
  owner: string;
  repo: string;
  fullName: string;
  description?: string;
  defaultBranch?: string;
  htmlUrl: string;
  isFixture?: boolean;
  items: NormalizedSourceItem[];
}

export class GithubService {
  /**
   * Parses repository owner and name from URLs or 'owner/repo' strings.
   */
  static parseRepoIdentifier(input: string): { owner: string; repo: string } {
    const trimmed = input.trim();
    if (!trimmed) {
      throw new Error("Repository URL or 'owner/repo' identifier is required.");
    }

    // Match github.com/owner/repo or owner/repo
    const regex = /(?:github\.com\/|^)([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git|\/|$)/;
    const match = trimmed.match(regex);

    if (!match || !match[1] || !match[2]) {
      throw new Error("Invalid GitHub repository identifier. Use 'owner/repo' or 'https://github.com/owner/repo'.");
    }

    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, "")
    };
  }

  /**
   * Helper to perform authenticated/unauthenticated GitHub API requests with rate limit checks.
   */
  private static async githubFetch(url: string, token?: string): Promise<any> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Knowledge-Handover-Platform"
    };

    const effectiveToken = token || env.GITHUB_TOKEN;
    if (effectiveToken) {
      headers.Authorization = `Bearer ${effectiveToken}`;
    }

    const res = await fetch(url, { headers });

    // Handle rate-limits
    const remaining = res.headers.get("x-ratelimit-remaining");
    const resetTime = res.headers.get("x-ratelimit-reset");

    if (res.status === 403 && remaining === "0") {
      const resetDate = resetTime ? new Date(parseInt(resetTime, 10) * 1000).toLocaleTimeString() : "soon";
      throw new Error(`GitHub API rate limit exceeded. Resets at ${resetDate}. Please provide a Personal Access Token.`);
    }

    if (res.status === 401) {
      throw new Error("GitHub authentication failed. The Personal Access Token is invalid or expired.");
    }

    if (res.status === 404) {
      throw new Error("Repository not found. Check that the repository exists and is either public or accessible with your token.");
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`GitHub API error (HTTP ${res.status}): ${errBody || res.statusText}`);
    }

    return res.json();
  }

  /**
   * Fetches real repository data from GitHub REST API and normalizes it.
   */
  static async fetchRepoData(repoIdentifier: string, token?: string): Promise<GithubRepoData> {
    const { owner, repo } = this.parseRepoIdentifier(repoIdentifier);
    const fullName = `${owner}/${repo}`;
    const apiBase = "https://api.github.com";

    // 1. Fetch Repo Info
    const repoInfo = await this.githubFetch(`${apiBase}/repos/${owner}/${repo}`, token);
    const defaultBranch = repoInfo.default_branch || "main";
    const htmlUrl = repoInfo.html_url || `https://github.com/${owner}/${repo}`;

    const items: NormalizedSourceItem[] = [];

    // 2. Fetch README
    try {
      const readmeData = await this.githubFetch(`${apiBase}/repos/${owner}/${repo}/readme`, token);
      if (readmeData && readmeData.content) {
        const decodedContent = Buffer.from(readmeData.content, "base64").toString("utf-8");
        items.push({
          itemType: "readme",
          itemId: readmeData.name || "README.md",
          title: `README (${fullName})`,
          url: readmeData.html_url || `${htmlUrl}/blob/${defaultBranch}/README.md`,
          text: decodedContent,
          metadata: { path: readmeData.path, size: readmeData.size }
        });
      }
    } catch {
      // README is optional; continue if absent
    }

    // 3. Fetch Commits (recent 25)
    try {
      const commits = await this.githubFetch(`${apiBase}/repos/${owner}/${repo}/commits?per_page=25`, token);
      if (Array.isArray(commits)) {
        for (const c of commits) {
          const sha = c.sha;
          const shortSha = sha.slice(0, 7);
          const authorName = c.commit?.author?.name || c.author?.login || "Unknown";
          const date = c.commit?.author?.date || "";
          const msg = c.commit?.message || "";
          const commitUrl = c.html_url || `${htmlUrl}/commit/${sha}`;

          items.push({
            itemType: "commit",
            itemId: shortSha,
            title: `Commit ${shortSha}: ${msg.split("\n")[0]}`,
            url: commitUrl,
            text: `Commit [${shortSha}]: ${msg}\nAuthor: ${authorName}\nDate: ${date}\nCommit URL: ${commitUrl}`,
            metadata: { sha, author: authorName, date }
          });
        }
      }
    } catch {
      // Commits optional
    }

    // 4. Fetch Pull Requests (recent 25)
    try {
      const pulls = await this.githubFetch(`${apiBase}/repos/${owner}/${repo}/pulls?state=all&per_page=25`, token);
      if (Array.isArray(pulls)) {
        for (const pr of pulls) {
          const number = pr.number;
          const prTitle = pr.title || "";
          const prBody = pr.body || "";
          const state = pr.state || "open";
          const author = pr.user?.login || "Unknown";
          const prUrl = pr.html_url || `${htmlUrl}/pull/${number}`;

          items.push({
            itemType: "pull_request",
            itemId: `#${number}`,
            title: `PR #${number}: ${prTitle}`,
            url: prUrl,
            text: `Pull Request #${number} [${state}]: ${prTitle}\nAuthor: ${author}\nState: ${state}\nBody:\n${prBody}\nURL: ${prUrl}`,
            metadata: { number, state, author, mergedAt: pr.merged_at }
          });
        }
      }
    } catch {
      // PRs optional
    }

    // 5. Fetch Issues (excluding PRs)
    try {
      const issues = await this.githubFetch(`${apiBase}/repos/${owner}/${repo}/issues?state=all&per_page=25`, token);
      if (Array.isArray(issues)) {
        for (const issue of issues) {
          // GitHub issues endpoint includes pull requests; ignore if pull_request key exists
          if (issue.pull_request) continue;

          const number = issue.number;
          const issueTitle = issue.title || "";
          const issueBody = issue.body || "";
          const state = issue.state || "open";
          const author = issue.user?.login || "Unknown";
          const issueUrl = issue.html_url || `${htmlUrl}/issues/${number}`;

          items.push({
            itemType: "issue",
            itemId: `#${number}`,
            title: `Issue #${number}: ${issueTitle}`,
            url: issueUrl,
            text: `Issue #${number} [${state}]: ${issueTitle}\nAuthor: ${author}\nState: ${state}\nBody:\n${issueBody}\nURL: ${issueUrl}`,
            metadata: { number, state, author, closedAt: issue.closed_at }
          });
        }
      }
    } catch {
      // Issues optional
    }

    // 6. Fetch Branches
    try {
      const branches = await this.githubFetch(`${apiBase}/repos/${owner}/${repo}/branches?per_page=25`, token);
      if (Array.isArray(branches)) {
        for (const branch of branches) {
          const bName = branch.name;
          const bUrl = `${htmlUrl}/tree/${bName}`;
          items.push({
            itemType: "doc",
            itemId: `branch-${bName}`,
            title: `Branch: ${bName}`,
            url: bUrl,
            text: `Branch: ${bName}\nCommit SHA: ${branch.commit?.sha || "Unknown"}\nURL: ${bUrl}`,
            metadata: { name: bName, sha: branch.commit?.sha }
          });
        }
      }
    } catch {
      // Branches optional
    }

    return {
      owner,
      repo,
      fullName,
      description: repoInfo.description || "",
      defaultBranch,
      htmlUrl,
      isFixture: false,
      items
    };
  }

  /**
   * Reads demo-data/github-fixture.json and normalizes it through the exact same structure.
   */
  static async loadDemoFixture(): Promise<GithubRepoData> {
    const fixturePath = path.resolve(process.cwd(), "../demo-data/github-fixture.json");
    let content = "";
    try {
      content = await fs.readFile(fixturePath, "utf-8");
    } catch {
      // Try local path if running from root
      const fallbackPath = path.resolve(process.cwd(), "demo-data/github-fixture.json");
      content = await fs.readFile(fallbackPath, "utf-8");
    }

    const raw = JSON.parse(content);
    const repo = raw.repository;
    const items: NormalizedSourceItem[] = [];

    // 1. README
    if (raw.readme) {
      items.push({
        itemType: "readme",
        itemId: raw.readme.filename || "README.md",
        title: `README (${repo.fullName})`,
        url: raw.readme.htmlUrl,
        text: raw.readme.content,
        metadata: { path: raw.readme.filename }
      });
    }

    // 2. Commits
    if (Array.isArray(raw.commits)) {
      for (const c of raw.commits) {
        items.push({
          itemType: "commit",
          itemId: c.shortSha,
          title: `Commit ${c.shortSha}: ${c.message}`,
          url: c.htmlUrl,
          text: `Commit [${c.shortSha}]: ${c.message}\nAuthor: ${c.author}\nDate: ${c.date}\nCommit URL: ${c.htmlUrl}`,
          metadata: { sha: c.sha, author: c.author, date: c.date }
        });
      }
    }

    // 3. Pull Requests
    if (Array.isArray(raw.pullRequests)) {
      for (const pr of raw.pullRequests) {
        items.push({
          itemType: "pull_request",
          itemId: `#${pr.number}`,
          title: `PR #${pr.number}: ${pr.title}`,
          url: pr.htmlUrl,
          text: `Pull Request #${pr.number} [${pr.state}]: ${pr.title}\nAuthor: ${pr.author}\nState: ${pr.state}\nBody:\n${pr.body}\nURL: ${pr.htmlUrl}`,
          metadata: { number: pr.number, state: pr.state, author: pr.author, createdAt: pr.createdAt }
        });
      }
    }

    // 4. Issues
    if (Array.isArray(raw.issues)) {
      for (const issue of raw.issues) {
        items.push({
          itemType: "issue",
          itemId: `#${issue.number}`,
          title: `Issue #${issue.number}: ${issue.title}`,
          url: issue.htmlUrl,
          text: `Issue #${issue.number} [${issue.state}]: ${issue.title}\nAuthor: ${issue.author}\nState: ${issue.state}\nBody:\n${issue.body}\nURL: ${issue.htmlUrl}`,
          metadata: { number: issue.number, state: issue.state, author: issue.author, closedAt: issue.closedAt }
        });
      }
    }

    // 5. Branches
    if (Array.isArray(raw.branches)) {
      for (const b of raw.branches) {
        const isStale = b.stale === true;
        items.push({
          itemType: "doc",
          itemId: `branch-${b.name}`,
          title: `Branch: ${b.name} ${isStale ? "(Stale)" : ""}`,
          url: b.htmlUrl,
          text: `Branch: ${b.name}\nStatus: ${isStale ? "stale" : "active"}\nLast Commit Date: ${b.lastCommitDate}\n${b.description || ""}\nURL: ${b.htmlUrl}`,
          metadata: { name: b.name, stale: isStale, lastCommitDate: b.lastCommitDate }
        });
      }
    }

    const { owner, repo: repoName } = this.parseRepoIdentifier(repo.fullName);

    return {
      owner,
      repo: repoName,
      fullName: repo.fullName,
      description: repo.description,
      defaultBranch: repo.defaultBranch || "main",
      htmlUrl: repo.htmlUrl,
      isFixture: true,
      items
    };
  }

  /**
   * Helper to encrypt token if saving in DB.
   */
  static encryptToken(token: string): string {
    return TokenCrypto.encrypt(token);
  }

  /**
   * Helper to decrypt token when retrieving from DB.
   */
  static decryptToken(encrypted: string): string {
    return TokenCrypto.decrypt(encrypted);
  }
}

