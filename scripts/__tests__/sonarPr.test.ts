// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { checkPullRequest, formatIssue } from "../sonar-pr.mjs";

const HEAD = "cf80464ff4e327afd05c4f47d43c7bdb31376077";

/** SonarCloud's two answers: the analyzed PRs, and the PR's open issues */
function sonar(analyzed: object[], issues: object[] = []) {
  return vi.fn(async (url: string) => ({
    json: async () =>
      url.includes("project_pull_requests/list")
        ? { pullRequests: analyzed }
        : { issues, total: issues.length },
    ok: true,
    status: 200,
  }));
}

const analysis = (sha = HEAD) => ({ commit: { sha }, key: "655" });

const issue = {
  component: "peteb4ker_romper:electron/main/services/syncService.ts",
  line: 42,
  message: "Refactor this function to reduce its Cognitive Complexity",
  rule: "typescript:S3776",
  severity: "CRITICAL",
};

describe("[Q-07] sonar:pr, the pre-handover SonarCloud check (#658)", () => {
  it("passes a PR whose latest analysis has no open issues", async () => {
    const fetchImpl = sonar([analysis()]);

    const result = await checkPullRequest("655", {
      fetchImpl,
      headSha: HEAD,
    });

    expect(result).toEqual({
      code: 0,
      lines: ["PR #655: 0 new SonarCloud issues (analysis of cf80464f)."],
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://sonarcloud.io/api/issues/search?componentKeys=peteb4ker_romper&pullRequest=655&resolved=false&ps=500",
    );
  });

  it("fails a PR with new issues, listing each", async () => {
    const result = await checkPullRequest("655", {
      fetchImpl: sonar([analysis()], [issue]),
      headSha: HEAD,
    });

    expect(result.code).toBe(1);
    expect(result.lines).toContain(
      "  CRITICAL\ttypescript:S3776\telectron/main/services/syncService.ts:42\tRefactor this function to reduce its Cognitive Complexity",
    );
  });

  it("can't judge a PR SonarCloud hasn't analyzed", async () => {
    const result = await checkPullRequest("655", { fetchImpl: sonar([]) });

    expect(result.code).toBe(2);
    expect(result.lines[0]).toMatch(/hasn't analyzed PR #655/);
  });

  it("can't judge an analysis of an older commit than the head", async () => {
    const result = await checkPullRequest("655", {
      fetchImpl: sonar([analysis("0123456789abcdef")]),
      headSha: HEAD,
    });

    expect(result.code).toBe(2);
    expect(result.lines[0]).toMatch(/is of 01234567, not the head cf80464f/);
  });

  it("asks for a PR number", async () => {
    const fetchImpl = sonar([]);

    expect((await checkPullRequest(undefined, { fetchImpl })).code).toBe(2);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("formats an issue without a line as just its file", () => {
    expect(formatIssue({ ...issue, line: undefined })).toBe(
      "  CRITICAL\ttypescript:S3776\telectron/main/services/syncService.ts\tRefactor this function to reduce its Cognitive Complexity",
    );
  });
});
