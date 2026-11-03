import { describe, expect, it } from "vitest";
import {
  parseExploreQuery,
  buildExploreHref,
  type ExploreQuery,
} from "@/features/map/lib/explore-query";

describe("explore-query lib", () => {
  describe("parseExploreQuery", () => {
    it("parses empty or irrelevant params to clean defaults", () => {
      const params = new URLSearchParams("foo=bar&baz=123");
      const result = parseExploreQuery(params);
      expect(result).toEqual({
        view: "grid",
      });
    });

    it("parses valid keyword with Vietnamese diacritics and special characters like &", () => {
      const params = new URLSearchParams();
      params.set("keyword", "Cà phê & Bánh ngọt");
      const result = parseExploreQuery(params);
      expect(result.keyword).toBe("Cà phê & Bánh ngọt");
    });

    it("trims and ignores empty or whitespace-only keyword", () => {
      const params = new URLSearchParams("keyword=   ");
      const result = parseExploreQuery(params);
      expect(result.keyword).toBeUndefined();
    });

    it("parses valid positive integer areaId and ignores NaN, zero, or negative numbers", () => {
      expect(parseExploreQuery(new URLSearchParams("areaId=5")).areaId).toBe(5);
      expect(parseExploreQuery(new URLSearchParams("area=12")).areaId).toBe(12);
      expect(parseExploreQuery(new URLSearchParams("areaId=0")).areaId).toBeUndefined();
      expect(parseExploreQuery(new URLSearchParams("areaId=-3")).areaId).toBeUndefined();
      expect(parseExploreQuery(new URLSearchParams("areaId=abc")).areaId).toBeUndefined();
      expect(parseExploreQuery(new URLSearchParams("areaId=3.14")).areaId).toBeUndefined();
    });

    it("validates category against SUPER_CATEGORIES and maps legacy aliases", () => {
      expect(parseExploreQuery(new URLSearchParams("category=ca-phe")).category).toBe("ca-phe");
      expect(parseExploreQuery(new URLSearchParams("category=am-thuc")).category).toBe("am-thuc");

      // Aliases
      expect(parseExploreQuery(new URLSearchParams("category=cafe")).category).toBe("ca-phe");
      expect(parseExploreQuery(new URLSearchParams("category=restaurant")).category).toBe("am-thuc");
      expect(parseExploreQuery(new URLSearchParams("category=nature")).category).toBe("tham-quan");

      // Invalid or 'all'
      expect(parseExploreQuery(new URLSearchParams("category=invalid-cat")).category).toBeUndefined();
      expect(parseExploreQuery(new URLSearchParams("category=all")).category).toBeUndefined();
    });

    it("validates suitableFor against SuitableAudience enum", () => {
      expect(parseExploreQuery(new URLSearchParams("suitableFor=couple")).suitableFor).toBe("couple");
      expect(parseExploreQuery(new URLSearchParams("audience=family")).suitableFor).toBe("family");
      expect(parseExploreQuery(new URLSearchParams("suitableFor=friends")).suitableFor).toBe("friends");
      expect(parseExploreQuery(new URLSearchParams("suitableFor=solo")).suitableFor).toBe("solo");
      expect(parseExploreQuery(new URLSearchParams("suitableFor=kids")).suitableFor).toBe("kids");

      // Invalid
      expect(parseExploreQuery(new URLSearchParams("suitableFor=invalid")).suitableFor).toBeUndefined();
    });

    it("validates sort against whitelist (rating, reviews, name)", () => {
      expect(parseExploreQuery(new URLSearchParams("sort=rating")).sort).toBe("rating");
      expect(parseExploreQuery(new URLSearchParams("sortBy=reviews")).sort).toBe("reviews");
      expect(parseExploreQuery(new URLSearchParams("sort=name")).sort).toBe("name");

      // Invalid
      expect(parseExploreQuery(new URLSearchParams("sort=random")).sort).toBeUndefined();
    });

    it("validates view mode (grid, split)", () => {
      expect(parseExploreQuery(new URLSearchParams("view=split")).view).toBe("split");
      expect(parseExploreQuery(new URLSearchParams("view=grid")).view).toBe("grid");
      expect(parseExploreQuery(new URLSearchParams("view=unknown")).view).toBe("grid");
    });
  });

  describe("buildExploreHref", () => {
    it("builds /explore when filters are empty", () => {
      expect(buildExploreHref({})).toBe("/explore");
    });

    it("encodes Vietnamese keywords and ampersand properly", () => {
      const href = buildExploreHref({ keyword: "Cà phê & Trà" });
      expect(href).toBe("/explore?keyword=C%C3%A0+ph%C3%AA+%26+Tr%C3%A0");
      const url = new URL(href, "http://localhost");
      expect(url.searchParams.get("keyword")).toBe("Cà phê & Trà");
    });

    it("includes areaId, category, suitableFor, sort, and view when specified", () => {
      const href = buildExploreHref({
        areaId: 2,
        category: "ca-phe",
        suitableFor: "couple",
        sort: "rating",
        view: "split",
      });
      const url = new URL(href, "http://localhost");
      expect(url.searchParams.get("areaId")).toBe("2");
      expect(url.searchParams.get("category")).toBe("ca-phe");
      expect(url.searchParams.get("suitableFor")).toBe("couple");
      expect(url.searchParams.get("sort")).toBe("rating");
      expect(url.searchParams.get("view")).toBe("split");
    });

    it("does not include view=grid in href because grid is default", () => {
      const href = buildExploreHref({ view: "grid" });
      expect(href).toBe("/explore");
    });

    it("performs round-trip parse and build correctly", () => {
      const original: ExploreQuery = {
        keyword: "Bánh xèo & Nem lụi",
        areaId: 10,
        category: "am-thuc",
        suitableFor: "friends",
        sort: "rating",
        view: "split",
      };
      const href = buildExploreHref(original);
      const url = new URL(href, "http://localhost");
      const parsed = parseExploreQuery(url.searchParams);
      expect(parsed).toEqual(original);
    });
  });
});
