import { describe, expect, it } from "vitest";
import {
  STEP_CONTROL_ARRAY_FIELDS,
  validateStepControl,
  type StepControlInput
} from "../src/controlSchema";

function createBaseInput(): StepControlInput {
  return {
    schemaVersion: 1,
    stepId: "codex-review",
    agent: "codex",
    role: "reviewer",
    status: "succeeded",
    summary: "Reviewed current diff.",
    needsHumanDecision: false
  };
}

describe("validateStepControl", () => {
  it.each(["reviewer", "planner", "finalJudge"] as const)(
    "requires a verdict when a %s step succeeds",
    (role) => {
      expect(() =>
        validateStepControl({
          ...createBaseInput(),
          role
        })
      ).toThrow(/verdict/i);
    }
  );

  it("allows a succeeded implementer step without a verdict", () => {
    const control = validateStepControl({
      ...createBaseInput(),
      role: "implementer"
    });

    expect(control.verdict).toBeUndefined();
  });

  it("rejects unsupported status values", () => {
    expect(() =>
      validateStepControl({
        ...createBaseInput(),
        status: "running"
      })
    ).toThrow(/status/i);
  });

  it("rejects unsupported verdict values", () => {
    expect(() =>
      validateStepControl({
        ...createBaseInput(),
        verdict: "ship-it"
      })
    ).toThrow(/verdict/i);
  });

  it("normalizes missing array fields to empty arrays and clones provided arrays", () => {
    const filesTouched = ["src/controlSchema.ts"];
    const control = validateStepControl({
      ...createBaseInput(),
      verdict: "approve-with-notes",
      filesTouched
    });

    for (const field of STEP_CONTROL_ARRAY_FIELDS) {
      if (field === "filesTouched") {
        continue;
      }

      expect(control[field]).toEqual([]);
    }

    expect(control.filesTouched).toEqual(["src/controlSchema.ts"]);
    expect(control.filesTouched).not.toBe(filesTouched);

    control.filesTouched.push("tests/controlSchema.test.ts");

    expect(filesTouched).toEqual(["src/controlSchema.ts"]);
  });

  it("rejects non-string array items", () => {
    expect(() =>
      validateStepControl({
        ...createBaseInput(),
        verdict: "approve",
        testsRun: ["npm test", 42] as unknown as string[]
      })
    ).toThrow(/testsRun/i);
  });
});
