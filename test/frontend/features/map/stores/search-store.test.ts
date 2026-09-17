import { beforeEach, describe, expect, it } from "vitest";
import { useSearchStore } from "@/stores/search-store";

describe("useSearchStore", () => {
  beforeEach(() => useSearchStore.getState().resetMapInteraction());

  it("tracks only transient map interaction", () => {
    useSearchStore.getState().selectPlace("place-1");
    useSearchStore.getState().hoverPlace("place-2");
    useSearchStore.getState().setViewport({ latitude: 10.77, longitude: 106.7, zoom: 14 });
    expect(useSearchStore.getState()).toMatchObject({ selectedPlaceId: "place-1", hoveredPlaceId: "place-2" });
    expect(useSearchStore.getState().mapViewport?.zoom).toBe(14);
  });
});
