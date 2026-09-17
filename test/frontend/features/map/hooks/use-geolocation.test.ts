import { describe, expect, it } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGeolocation } from "@/features/map/hooks/use-geolocation";
import { DEFAULT_MAP_CENTER } from "@/features/map/map-config";

interface GeolocationCallbacks {
  success: PositionCallback;
  error: PositionErrorCallback;
}

function installGeolocationMock(run: (callbacks: GeolocationCallbacks) => void) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (success: PositionCallback, error: PositionErrorCallback) =>
        run({ success, error }),
    },
  });
}

describe("useGeolocation", () => {
  it("returns the browser coordinate on success", async () => {
    installGeolocationMock(({ success }) =>
      success({ coords: { latitude: 10.8, longitude: 106.7 } } as GeolocationPosition)
    );
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.requestLocation());
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.coordinate).toEqual({ latitude: 10.8, longitude: 106.7 });
  });

  it("falls back after permission denial", async () => {
    installGeolocationMock(({ error }) =>
      error({ code: 1, message: "denied" } as GeolocationPositionError)
    );
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.requestLocation());
    await waitFor(() => expect(result.current.status).toBe("fallback"));
    expect(result.current.coordinate).toEqual(DEFAULT_MAP_CENTER);
    expect(result.current.message).toMatch(/TP\. Hồ Chí Minh/i);
  });

  it("falls back when geolocation API is unavailable", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: undefined,
    });
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.requestLocation());
    await waitFor(() => expect(result.current.status).toBe("fallback"));
    expect(result.current.coordinate).toEqual(DEFAULT_MAP_CENTER);
  });
});
