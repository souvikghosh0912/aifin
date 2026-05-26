import { describe, expect, it } from "vitest";

import type { NewsItem } from "@/lib/market/news";
import {
  applyProvider,
  uniquePublishers,
} from "@/components/news-flow/provider-data";

function item(publisher: string | null, id = publisher ?? "null"): NewsItem {
  return {
    id,
    title: `Story from ${publisher ?? "unknown"}`,
    publisher,
    publishedAt: "2026-05-26T00:00:00.000Z",
    link: `https://example.com/${id}`,
    thumbnail: null,
    relatedTickers: [],
  };
}

describe("uniquePublishers", () => {
  it("returns publishers sorted alphabetically, case-insensitive", () => {
    const out = uniquePublishers([
      item("Reuters"),
      item("Mint"),
      item("Bloomberg"),
    ]);
    expect(out).toEqual(["Bloomberg", "Mint", "Reuters"]);
  });

  it("de-duplicates case-insensitively, keeping first-seen casing", () => {
    const out = uniquePublishers([
      item("Mint", "a"),
      item("mint", "b"),
      item("MINT", "c"),
    ]);
    expect(out).toEqual(["Mint"]);
  });

  it("trims whitespace before comparing", () => {
    const out = uniquePublishers([
      item("Mint", "a"),
      item("  Mint  ", "b"),
    ]);
    expect(out).toEqual(["Mint"]);
  });

  it("skips items with null publisher", () => {
    const out = uniquePublishers([
      item("Mint", "a"),
      item(null, "b"),
    ]);
    expect(out).toEqual(["Mint"]);
  });

  it("returns an empty array when no items have publishers", () => {
    expect(uniquePublishers([item(null, "a"), item(null, "b")])).toEqual([]);
  });
});

describe("applyProvider", () => {
  const items = [
    item("Mint", "a"),
    item("Reuters", "b"),
    item(null, "c"),
  ];

  it("returns items unchanged when selection is empty", () => {
    expect(applyProvider(items, new Set())).toEqual(items);
  });

  it("keeps items whose publisher key is in the selection", () => {
    const out = applyProvider(items, new Set(["mint"]));
    expect(out.map((i) => i.id)).toEqual(["a"]);
  });

  it("matches case-insensitively (publisher casing in items can vary)", () => {
    const data = [item("MINT", "x"), item("Mint", "y")];
    const out = applyProvider(data, new Set(["mint"]));
    expect(out.map((i) => i.id)).toEqual(["x", "y"]);
  });

  it("drops items with null publisher when selection is non-empty", () => {
    const out = applyProvider(items, new Set(["mint"]));
    expect(out.map((i) => i.id)).not.toContain("c");
  });
});
