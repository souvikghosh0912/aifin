import { describe, expect, it } from "vitest";

import type { NewsItem } from "@/lib/market/news";
import {
  SECTORS,
  applySector,
  classifySectors,
  type SectorId,
} from "@/components/news-flow/sector-data";

function item(title: string, id = title): NewsItem {
  return {
    id,
    title,
    publisher: null,
    publishedAt: "2026-05-26T00:00:00.000Z",
    link: `https://example.com/${id}`,
    thumbnail: null,
    relatedTickers: [],
  };
}

describe("SECTORS", () => {
  it("contains all 18 sector ids in the documented order", () => {
    const expected: SectorId[] = [
      "commercial-services",
      "communications",
      "consumer-durables",
      "consumer-non-durables",
      "consumer-services",
      "distribution-services",
      "electronic-technology",
      "energy-minerals",
      "finance",
      "government",
      "health-services",
      "health-technology",
      "industrial-services",
      "miscellaneous",
      "non-energy-minerals",
      "process-industries",
      "producer-manufacturing",
      "retail-trade",
    ];
    expect(SECTORS.map((s) => s.id)).toEqual(expected);
  });

  it("exposes a human label for every sector", () => {
    for (const s of SECTORS) {
      expect(s.label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("classifySectors", () => {
  it("returns Finance for banking headlines", () => {
    const ids = classifySectors(item("HDFC Bank announces record loan growth"));
    expect(ids.has("finance")).toBe(true);
  });

  it("returns Energy Minerals for oil & gas headlines", () => {
    const ids = classifySectors(item("ONGC posts higher Q1 profit on oil prices"));
    expect(ids.has("energy-minerals")).toBe(true);
  });

  it("can return multiple sectors when keywords overlap", () => {
    const ids = classifySectors(
      item("RBI fines bank over insurance mis-selling"),
    );
    expect(ids.has("finance")).toBe(true);
  });

  it("returns an empty set when no keyword matches", () => {
    expect(classifySectors(item("Cricket team wins toss")).size).toBe(0);
  });

  it("never matches Miscellaneous", () => {
    for (const s of SECTORS) {
      const ids = classifySectors(item(s.label));
      expect(ids.has("miscellaneous")).toBe(false);
    }
  });
});

describe("applySector", () => {
  const items = [
    item("HDFC Bank profit rises", "a"),
    item("ONGC quarterly results", "b"),
    item("Cricket team wins toss", "c"),
  ];

  it("returns items unchanged when no sector selected", () => {
    expect(applySector(items, new Set())).toEqual(items);
  });

  it("keeps only items intersecting the selection", () => {
    const out = applySector(items, new Set<SectorId>(["finance"]));
    expect(out.map((i) => i.id)).toEqual(["a"]);
  });

  it("union semantics across multiple selected sectors", () => {
    const out = applySector(
      items,
      new Set<SectorId>(["finance", "energy-minerals"]),
    );
    expect(out.map((i) => i.id).sort()).toEqual(["a", "b"]);
  });

  it("drops items that match no sector when selection is non-empty", () => {
    const out = applySector(items, new Set<SectorId>(["finance"]));
    expect(out.map((i) => i.id)).not.toContain("c");
  });
});
