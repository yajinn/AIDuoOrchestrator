import { describe, expect, it } from "vitest";
import { commandContextMode, parseAiduoCommand } from "../src/commands/parser";

describe("parseAiduoCommand", () => {
  it("parses review with inline count and boolean flags", () => {
    const command = parseAiduoCommand("/aiduo:review --all=8 --json");
    expect(command.name).toBe("review");
    expect(command.flags.all).toBe(8);
    expect(command.flags.json).toBe(true);
    expect(commandContextMode(command)).toBe("all");
  });

  it("parses spaced flag values", () => {
    const command = parseAiduoCommand("/aiduo:bootstrap --apply");
    expect(command.name).toBe("bootstrap");
    expect(command.flags.apply).toBe(true);
  });
});
