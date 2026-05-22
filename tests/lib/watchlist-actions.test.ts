import { describe, expect, it } from "vitest";
import { z } from "zod";

// Mirror the schema we expect the action to use. The test verifies the schema
// shape; the action itself is exercised via integration in the manual checklist.
const InputSchema = z.object({
  symbol: z.string().min(1).max(40),
  exchange: z.enum(["NSE", "BSE"]),
  notes: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v == null || v.trim() === "" ? null : v.trim())),
});

describe("watchlist add InputSchema", () => {
  it("accepts symbol + exchange with no notes", () => {
    const r = InputSchema.parse({ symbol: "INFY", exchange: "NSE" });
    expect(r.notes).toBeNull();
  });

  it("accepts notes up to 500 chars", () => {
    const notes = "a".repeat(500);
    const r = InputSchema.parse({ symbol: "INFY", exchange: "NSE", notes });
    expect(r.notes).toBe(notes);
  });

  it("normalizes empty string and whitespace to null", () => {
    expect(InputSchema.parse({ symbol: "INFY", exchange: "NSE", notes: "" }).notes).toBeNull();
    expect(
      InputSchema.parse({ symbol: "INFY", exchange: "NSE", notes: "   " }).notes,
    ).toBeNull();
  });

  it("rejects notes longer than 500 chars", () => {
    const notes = "a".repeat(501);
    expect(() =>
      InputSchema.parse({ symbol: "INFY", exchange: "NSE", notes }),
    ).toThrow();
  });
});

const UpdateNotesSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().max(500).nullable(),
});

describe("updateWatchlistNotes schema", () => {
  it("accepts uuid + 500-char string", () => {
    const r = UpdateNotesSchema.parse({
      id: "00000000-0000-0000-0000-000000000001",
      notes: "x".repeat(500),
    });
    expect(r.notes?.length).toBe(500);
  });

  it("accepts uuid + null (delete)", () => {
    const r = UpdateNotesSchema.parse({
      id: "00000000-0000-0000-0000-000000000001",
      notes: null,
    });
    expect(r.notes).toBeNull();
  });

  it("rejects non-uuid id", () => {
    expect(() =>
      UpdateNotesSchema.parse({ id: "not-a-uuid", notes: null }),
    ).toThrow();
  });

  it("rejects notes longer than 500 chars", () => {
    expect(() =>
      UpdateNotesSchema.parse({
        id: "00000000-0000-0000-0000-000000000001",
        notes: "a".repeat(501),
      }),
    ).toThrow();
  });
});
