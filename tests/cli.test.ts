import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/cli";

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
});
