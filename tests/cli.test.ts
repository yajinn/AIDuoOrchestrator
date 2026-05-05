import { describe, expect, it } from "vitest";
import { parseCliArgs, resolveWrapperArgs } from "../src/cli";

describe("parseCliArgs", () => {
  it("parses wrapper commands as passthrough", () => {
    const parsed = parseCliArgs(["claude", "--resume"]);
    expect(parsed.kind).toBe("wrap");
    expect(parsed.agent).toBe("claude");
    expect(parsed.passthroughArgs).toEqual(["--resume"]);
  });

  it("parses top-level bootstrap apply", () => {
    const parsed = parseCliArgs(["bootstrap", "--apply"]);
    expect(parsed.kind).toBe("bootstrap");
    expect(parsed.slashCommand).toBe("/aiduo:bootstrap --apply");
  });

  it("keeps claude passthrough untouched when no explicit args are given", () => {
    expect(resolveWrapperArgs("claude", [])).toEqual([]);
  });

  it("keeps codex passthrough untouched", () => {
    expect(resolveWrapperArgs("codex", [])).toEqual([]);
    expect(resolveWrapperArgs("codex", ["exec", "--resume"])).toEqual(["exec", "--resume"]);
    expect(resolveWrapperArgs("codex", ["--resume"])).toEqual(["--resume"]);
  });
});
