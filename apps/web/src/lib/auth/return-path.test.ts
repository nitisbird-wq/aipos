import { describe, expect, it } from "vitest";
import { safeInternalReturnPath } from "./return-path";

describe("safeInternalReturnPath", () => {
  it("preserves an intake deep link", () => {
    expect(safeInternalReturnPath("/intake?intake_id=INT-123")).toBe("/intake?intake_id=INT-123");
  });

  it.each([null, "", "https://evil.example", "//evil.example/path"])(
    "falls back for unsafe return path %s",
    (value) => {
      expect(safeInternalReturnPath(value)).toBe("/intake");
    },
  );
});
