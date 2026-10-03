// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  buildSearchQuery,
  fetchClosedIssues,
  getFixedIssueGroups,
  groupFixedIssues,
  groupLabelKey,
  releaseWindow,
} from "../release/fixed-issues.js";
import {
  generateReleaseData,
  renderReleaseNotes,
} from "../release/generate-notes.js";

const LABELS = {
  bug: { description: "Something isn't working", name: "bug" },
  duplicate: {
    description: "This issue or pull request already exists",
    name: "duplicate",
  },
  ops: { description: "Needs a repository owner", name: "ops" },
  "Q-01": {
    description: "Romper stays responsive as your library grows",
    name: "Q-01",
  },
  sonarcloud: {
    description: "SonarCloud quality gate tracking",
    name: "sonarcloud",
  },
  "UC-07": { description: "Browse kits by bank", name: "UC-07" },
  "UC-19": { description: "Drop WAVs onto a voice", name: "UC-19" },
  "UC-34": { description: "Write kits to the SD card", name: "UC-34" },
};

type LabelName = keyof typeof LABELS;

function issue(
  number: number,
  title: string,
  labels: LabelName[],
  overrides: Record<string, unknown> = {},
) {
  return {
    closed_at: "2026-09-20T12:00:00Z",
    html_url: `https://github.com/peteb4ker/romper/issues/${number}`,
    labels: labels.map((name) => LABELS[name]),
    number,
    state_reason: "completed",
    title,
    ...overrides,
  };
}

const WINDOW = { from: "2026-09-03T16:00:00Z", to: "2026-10-03T18:00:00Z" };

describe("groupLabelKey", () => {
  it("orders use cases before qualities, each numerically", () => {
    expect(groupLabelKey("UC-07")).toEqual([0, 7]);
    expect(groupLabelKey("Q-01")).toEqual([1, 1]);
    expect(groupLabelKey("bug")).toBeNull();
    expect(groupLabelKey("UC-7x")).toBeNull();
  });
});

describe("groupFixedIssues", () => {
  it("groups by use case or quality, headed by the label's description", () => {
    const groups = groupFixedIssues(
      [
        issue(460, "Scrolling a big library stutters", ["bug", "Q-01"]),
        issue(
          435,
          "Arrow keys and Enter don't work in the kit grid until you click a kit",
          ["bug", "UC-07"],
        ),
        issue(440, "Another bank problem", ["UC-07"]),
        issue(390, "WAVs with a JUNK chunk are copied unconverted", ["bug"]),
        issue(456, "A rejected drop isn't shown to you", [
          "bug",
          "UC-34",
          "UC-19",
        ]),
      ],
      WINDOW,
    );

    expect(groups.map((g) => [g.id, g.heading])).toEqual([
      ["UC-07", "Browse kits by bank"],
      ["UC-19", "Drop WAVs onto a voice"],
      ["Q-01", "Romper stays responsive as your library grows"],
      [null, "Other fixes"],
    ]);
    expect(groups[0].issues.map((i) => i.number)).toEqual([435, 440]);
    expect(groups[0].issues[0].line).toBe(
      "[Arrow keys and Enter don't work in the kit grid until you click a kit](https://github.com/peteb4ker/romper/issues/435)",
    );
  });

  it("lists an issue with several use cases once, under the lowest ID", () => {
    const groups = groupFixedIssues(
      [issue(456, "Silent failures", ["UC-34", "UC-19", "Q-01"])],
      WINDOW,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe("UC-19");
  });

  it("leaves out ops, duplicates, not-planned issues and pull requests", () => {
    const groups = groupFixedIssues(
      [
        issue(1, "Owner needs to rotate a secret", ["ops", "UC-07"]),
        issue(2, "Same as #3", ["duplicate", "UC-07"]),
        issue(3, "Won't do this", ["UC-07"], { state_reason: "not_planned" }),
        issue(4, "A pull request", ["UC-07"], { pull_request: {} }),
        issue(5, "Kept", ["UC-07"]),
      ],
      WINDOW,
    );

    expect(groups.flatMap((g) => g.issues.map((i) => i.number))).toEqual([5]);
  });

  it("leaves out SonarCloud quality-gate tracking issues", () => {
    const groups = groupFixedIssues(
      [
        issue(374, "SonarCloud: quality gate failure on main", [
          "bug",
          "sonarcloud",
        ]),
        issue(375, "SonarCloud gate on a use case", ["sonarcloud", "Q-01"]),
        issue(390, "WAVs with a JUNK chunk are copied unconverted", ["bug"]),
      ],
      WINDOW,
    );

    expect(groups.flatMap((g) => g.issues.map((i) => i.number))).toEqual([390]);
  });

  it("keeps issues closed after `from`, up to and including `to`", () => {
    const groups = groupFixedIssues(
      [
        issue(1, "At the previous release", ["UC-07"], {
          closed_at: WINDOW.from,
        }),
        issue(2, "Just after", ["UC-07"], {
          closed_at: "2026-09-03T16:00:01Z",
        }),
        issue(3, "At this release", ["UC-07"], { closed_at: WINDOW.to }),
        issue(4, "After this release", ["UC-07"], {
          closed_at: "2026-10-03T18:00:01Z",
        }),
      ],
      WINDOW,
    );

    expect(groups[0].issues.map((i) => i.number)).toEqual([2, 3]);
  });

  it("escapes titles so they can't break the link", () => {
    const [group] = groupFixedIssues(
      [issue(7, "Names with [brackets] and <tags>", ["UC-07"])],
      WINDOW,
    );

    expect(group.issues[0].line).toBe(
      "[Names with \\[brackets\\] and &lt;tags>](https://github.com/peteb4ker/romper/issues/7)",
    );
  });

  it("falls back to the label name when it has no description", () => {
    const [group] = groupFixedIssues(
      [
        {
          ...issue(8, "Something", []),
          labels: [{ description: "", name: "UC-09" }],
        },
      ],
      WINDOW,
    );

    expect(group.heading).toBe("UC-09");
  });

  it("returns no groups when nothing was fixed", () => {
    expect(groupFixedIssues([], WINDOW)).toEqual([]);
  });
});

describe("releaseWindow", () => {
  it("runs from the previous tag's commit to this tag's, both a few minutes later", () => {
    expect(
      releaseWindow("2026-09-03T08:58:07-07:00", "2026-10-03T10:38:49-07:00"),
    ).toEqual({
      from: "2026-09-03T16:03:07.000Z",
      to: "2026-10-03T17:43:49.000Z",
    });
  });

  it("is open-ended at the start for the first release", () => {
    expect(releaseWindow(null, "2026-10-03T17:38:49Z").from).toBeNull();
  });
});

describe("buildSearchQuery", () => {
  it("asks for issues closed as completed in the window", () => {
    expect(
      buildSearchQuery("peteb4ker/romper", {
        from: "2026-09-03T16:03:07.000Z",
        to: "2026-10-03T17:43:49.000Z",
      }),
    ).toBe(
      "repo:peteb4ker/romper is:issue is:closed reason:completed closed:2026-09-03T16:03:07Z..2026-10-03T17:43:49Z",
    );
  });

  it("has an open start when there's no previous release", () => {
    expect(
      buildSearchQuery("peteb4ker/romper", { to: "2026-10-03T17:43:49Z" }),
    ).toBe(
      "repo:peteb4ker/romper is:issue is:closed reason:completed closed:<=2026-10-03T17:43:49Z",
    );
  });
});

describe("fetchClosedIssues", () => {
  it("pages through the search API with gh and parses one issue per line", () => {
    const gh = vi
      .fn()
      .mockReturnValue(
        `${JSON.stringify(issue(1, "One", ["UC-07"]))}\n${JSON.stringify(
          issue(2, "Two", ["Q-01"]),
        )}\n`,
      );

    const issues = fetchClosedIssues("peteb4ker/romper", WINDOW, { gh });

    expect(issues.map((i: { number: number }) => i.number)).toEqual([1, 2]);
    const args = gh.mock.calls[0][0] as string[];
    expect(args.slice(0, 4)).toEqual([
      "api",
      "--method",
      "GET",
      "search/issues",
    ]);
    expect(args).toContain("--paginate");
    expect(args).toContain(`q=${buildSearchQuery("peteb4ker/romper", WINDOW)}`);
  });
});

describe("getFixedIssueGroups", () => {
  it("returns null and logs a notice when GitHub can't be read", () => {
    const gh = vi.fn(() => {
      throw Object.assign(new Error("Command failed: gh api"), {
        stderr: "gh auth login\n",
      });
    });
    const log = vi.fn();

    expect(
      getFixedIssueGroups("peteb4ker/romper", WINDOW, { gh, log }),
    ).toBeNull();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('leaving out "Fixed in this release"'),
    );
  });

  it("groups what the search returns", () => {
    const gh = vi
      .fn()
      .mockReturnValue(JSON.stringify(issue(435, "Grid keys", ["UC-07"])));

    expect(
      getFixedIssueGroups("peteb4ker/romper", WINDOW, { gh, log: vi.fn() }),
    ).toEqual([
      expect.objectContaining({ heading: "Browse kits by bank", id: "UC-07" }),
    ]);
  });
});

describe("release notes template", () => {
  const BASE = {
    commitCount: 2,
    date: "2026-10-03",
    features: ["**kits**: a new feature"],
    previous_version: "v1.3.1",
    version: "1.3.2",
  };

  it("puts Fixed in this release above the commit sections", () => {
    const notes = renderReleaseNotes({
      ...BASE,
      fixed_issues: groupFixedIssues(
        [
          issue(435, "Arrow keys don't work in the kit grid", ["UC-07"]),
          issue(460, "Scrolling stutters", ["Q-01"]),
        ],
        WINDOW,
      ),
    });

    const fixed = notes.indexOf("## ✅ Fixed in this release");
    expect(fixed).toBeGreaterThan(-1);
    expect(fixed).toBeLessThan(notes.indexOf("## ✨ New Features"));
    expect(notes).toContain(
      "### Browse kits by bank\n\n- [Arrow keys don't work in the kit grid](https://github.com/peteb4ker/romper/issues/435)\n",
    );
    expect(notes.indexOf("### Browse kits by bank")).toBeLessThan(
      notes.indexOf("### Romper stays responsive as your library grows"),
    );
    expect(notes).toContain("This release fixes all of them.");
  });

  it("leaves the section out when there are no fixed issues", () => {
    const notes = renderReleaseNotes({ ...BASE, fixed_issues: null });

    expect(notes).not.toContain("Fixed in this release");
    expect(notes).toContain("## ✨ New Features");
  });
});

describe("generateReleaseData", () => {
  it("passes the previous tag to the injected issue source", () => {
    const getFixedIssues = vi.fn().mockReturnValue([]);

    const data = generateReleaseData("1.3.2", {}, { getFixedIssues });

    expect(getFixedIssues).toHaveBeenCalledTimes(1);
    expect(data.fixed_issues).toBeNull();
  });

  it("hands the grouped issues to the template", () => {
    const groups = groupFixedIssues(
      [issue(435, "Grid keys", ["UC-07"])],
      WINDOW,
    );

    const data = generateReleaseData(
      "1.3.2",
      {},
      { getFixedIssues: () => groups },
    );

    expect(data.fixed_issues).toBe(groups);
  });
});
