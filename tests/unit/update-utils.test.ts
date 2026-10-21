import { describe, expect, it } from "vitest";

import {
  MAX_RELEASE_NOTES,
  friendlyUpdateError,
  normalizeReleaseNotes,
  parseStoredState,
  planWhatsNew,
  releaseFromApi,
  releaseUrl,
} from "../../electron/update-utils.mjs";

describe("releaseUrl", () => {
  it("builds the tagged GitHub release URL", () => {
    expect(releaseUrl("1.1.0")).toBe(
      "https://github.com/z3dd77/iDespisePDF/releases/tag/v1.1.0",
    );
  });
});

describe("parseStoredState", () => {
  it("parses an object and tolerates a UTF-8 BOM", () => {
    expect(parseStoredState('\uFEFF{"lastRunVersion":"1.1.0"}')).toEqual({
      lastRunVersion: "1.1.0",
    });
  });

  it("falls back to an empty object for damaged state", () => {
    expect(parseStoredState("not json")).toEqual({});
    expect(parseStoredState("[1,2]")).toEqual({});
  });
});

describe("normalizeReleaseNotes", () => {
  it("normalizes line endings and trims surrounding whitespace", () => {
    expect(normalizeReleaseNotes("\r\n  Added updates\r\nFixed bugs  \r\n")).toBe(
      "Added updates\nFixed bugs",
    );
  });

  it("returns an empty string for non-string input", () => {
    expect(normalizeReleaseNotes(null)).toBe("");
    expect(normalizeReleaseNotes(42)).toBe("");
  });

  it("caps very long notes", () => {
    const notes = normalizeReleaseNotes("a".repeat(MAX_RELEASE_NOTES + 50));
    expect(notes.length).toBeLessThan(MAX_RELEASE_NOTES + 20);
    expect(notes.endsWith("…")).toBe(true);
  });
});

describe("releaseFromApi", () => {
  it("uses the release body, name, and html URL", () => {
    expect(
      releaseFromApi("1.1.0", {
        body: "## Changes\n\n- Updates",
        name: "iDespisePDF 1.1.0",
        html_url: "https://github.com/z3dd77/iDespisePDF/releases/tag/v1.1.0",
      }),
    ).toEqual({
      version: "1.1.0",
      notes: "## Changes\n\n- Updates",
      releaseName: "iDespisePDF 1.1.0",
      releaseUrl:
        "https://github.com/z3dd77/iDespisePDF/releases/tag/v1.1.0",
    });
  });

  it("falls back to the tagged URL for untrusted payloads", () => {
    expect(
      releaseFromApi("1.1.0", {
        body: "",
        html_url: "javascript:alert(1)",
        name: " ",
      }),
    ).toEqual({
      version: "1.1.0",
      notes: "",
      releaseName: "v1.1.0",
      releaseUrl:
        "https://github.com/z3dd77/iDespisePDF/releases/tag/v1.1.0",
    });
  });
});

describe("planWhatsNew", () => {
  it("does not show a changelog on first run", () => {
    expect(planWhatsNew({}, "1.1.0")).toEqual({
      whatsNew: null,
      lastRunVersion: "1.1.0",
      needsNotes: false,
    });
  });

  it("does not repeat the changelog for the same version", () => {
    expect(
      planWhatsNew(
        {
          lastRunVersion: "1.1.0",
          pending: { version: "1.1.0", notes: "Downloaded" },
        },
        "1.1.0",
      ),
    ).toEqual({
      whatsNew: null,
      lastRunVersion: "1.1.0",
      needsNotes: false,
    });
  });

  it("uses cached notes after an update", () => {
    const pending = {
      version: "1.1.1",
      notes: "- Fixed a bug",
      releaseUrl:
        "https://github.com/z3dd77/iDespisePDF/releases/tag/v1.1.1",
      releaseName: "v1.1.1",
    };

    expect(
      planWhatsNew(
        { lastRunVersion: "1.1.0", pending },
        "1.1.1",
      ),
    ).toEqual({
      whatsNew: pending,
      lastRunVersion: "1.1.1",
      needsNotes: false,
    });
  });

  it("asks for notes when the version changed without a cached release", () => {
    expect(
      planWhatsNew(
        { lastRunVersion: "1.1.0", pending: { version: "1.0.9" } },
        "1.1.1",
      ),
    ).toEqual({
      whatsNew: {
        version: "1.1.1",
        notes: "",
        releaseUrl:
          "https://github.com/z3dd77/iDespisePDF/releases/tag/v1.1.1",
        releaseName: "v1.1.1",
      },
      lastRunVersion: "1.1.1",
      needsNotes: true,
    });
  });
});

describe("friendlyUpdateError", () => {
  it("maps connectivity failures", () => {
    expect(
      friendlyUpdateError(
        Object.assign(new Error("getaddrinfo ENOTFOUND api.github.com"), {
          code: "ENOTFOUND",
        }),
      ),
    ).toContain("internet connection");
  });

  it("maps missing release metadata", () => {
    expect(
      friendlyUpdateError(new Error("Cannot find latest.yml in the latest release")),
    ).toContain("No update information");
  });

  it("maps signature failures", () => {
    expect(
      friendlyUpdateError(new Error("sha512 checksum mismatch")),
    ).toContain("could not be verified");
  });

  it("falls back to a generic message", () => {
    expect(friendlyUpdateError(new Error("unexpected"))).toBe(
      "Couldn't check for updates. Try again later.",
    );
  });
});
