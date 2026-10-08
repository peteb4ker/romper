#!/usr/bin/env node
/**
 * Does SonarCloud's analysis of a PR show 0 new issues? Part of the
 * pre-handover checklist in the ship-pr skill (#658): a passing quality
 * gate isn't enough, because the gate lets new code smells through.
 *
 *   npm run sonar:pr -- <pr-number>
 *
 * Exits 0 when the analysis of the PR's head commit has no open issues,
 * 1 when it has some (each is listed), and 2 when there's nothing to judge
 * yet: SonarCloud hasn't analyzed the PR, or its analysis is of an older
 * commit than the PR's head (read with `gh`; without it, that check is
 * skipped). The project is public, so no token is needed. The same count,
 * by hand:
 *
 *   curl -s "https://sonarcloud.io/api/issues/search?componentKeys=peteb4ker_romper&pullRequest=<N>&resolved=false" | jq .total
 */
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const API = "https://sonarcloud.io/api";
const PROJECT = "peteb4ker_romper";

/**
 * The part of `fetch` the check uses, so tests can answer for SonarCloud
 * @typedef {(url: string) => Promise<{ json(): Promise<unknown>, ok: boolean, status: number }>} Fetch
 *
 * @typedef {{ commit?: { sha?: string }, key: string }} SonarPullRequest
 *
 * @typedef {object} SonarIssue
 * @property {string} [component] `<project>:<path>`
 * @property {number} [line]
 * @property {string} message
 * @property {string} rule
 * @property {string} severity
 */

/**
 * Check one PR; resolves to { code, lines }.
 * @param {string | undefined} pr the PR number
 * @param {{ fetchImpl?: Fetch, headSha?: string }} options headSha
 *   is the PR's head commit, when known
 * @returns {Promise<{ code: 0 | 1 | 2, lines: string[] }>}
 */
export async function checkPullRequest(
  pr,
  { fetchImpl = fetch, headSha } = {},
) {
  if (!/^\d+$/.test(String(pr ?? ""))) {
    return { code: 2, lines: ["Usage: npm run sonar:pr -- <pr-number>"] };
  }
  /** @param {string} path */
  const get = async (path) => {
    const response = await fetchImpl(`${API}/${path}`);
    if (!response.ok) {
      throw new Error(`SonarCloud answered ${response.status} for ${path}`);
    }
    return response.json();
  };

  const { pullRequests = [] } =
    /** @type {{ pullRequests?: SonarPullRequest[] }} */ (
      await get(`project_pull_requests/list?project=${PROJECT}`)
    );
  const analysis = pullRequests.find((p) => p.key === String(pr));
  if (!analysis) {
    return {
      code: 2,
      lines: [
        `SonarCloud hasn't analyzed PR #${pr} yet. Wait for CI's analysis job.`,
      ],
    };
  }
  const analyzed = analysis.commit?.sha;
  if (headSha && analyzed && analyzed !== headSha) {
    return {
      code: 2,
      lines: [
        `SonarCloud's analysis of PR #${pr} is of ${analyzed.slice(0, 8)}, not the head ${headSha.slice(0, 8)}. Wait for CI's analysis job on the latest push.`,
      ],
    };
  }

  const { issues = [], total = 0 } =
    /** @type {{ issues?: SonarIssue[], total?: number }} */ (
      await get(
        `issues/search?componentKeys=${PROJECT}&pullRequest=${pr}&resolved=false&ps=500`,
      )
    );
  const at = analyzed ? ` (analysis of ${analyzed.slice(0, 8)})` : "";
  if (total === 0) {
    return { code: 0, lines: [`PR #${pr}: 0 new SonarCloud issues${at}.`] };
  }
  return {
    code: 1,
    lines: [
      `PR #${pr}: ${total} new SonarCloud ${total === 1 ? "issue" : "issues"}${at}. Fix them, or mark a deliberate one in SonarCloud with a reason:`,
      ...issues.map(formatIssue),
      `https://sonarcloud.io/project/issues?id=${PROJECT}&pullRequest=${pr}&resolved=false`,
    ],
  };
}

/**
 * One issue as `SEVERITY rule path:line message`
 * @param {SonarIssue} issue
 */
export function formatIssue(issue) {
  const file = String(issue.component ?? "").replace(`${PROJECT}:`, "");
  const where = issue.line ? `${file}:${issue.line}` : file;
  return `  ${issue.severity}\t${issue.rule}\t${where}\t${issue.message}`;
}

/**
 * The PR's head commit, from gh; undefined if gh can't say
 * @param {string} pr
 */
function readHeadSha(pr) {
  try {
    return execFileSync(
      "gh",
      ["pr", "view", String(pr), "--json", "headRefOid", "-q", ".headRefOid"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
  } catch {
    return undefined;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const pr = process.argv[2];
  try {
    const result = await checkPullRequest(pr, {
      headSha: /^\d+$/.test(pr ?? "") ? readHeadSha(pr) : undefined,
    });
    for (const line of result.lines) {
      (result.code === 0 ? console.log : console.error)(line);
    }
    process.exit(result.code);
  } catch (error) {
    console.error(
      `Couldn't read SonarCloud: ${/** @type {Error} */ (error).message}`,
    );
    process.exit(2);
  }
}
