import { describe, expect, it } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGeolocation } from "@/features/map/hooks/use-geolocation";

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
  it("starts in idle state without requesting permission automatically", () => {
    const { result } = renderHook(() => useGeolocation());
    expect(result.current.status).toBe("idle");
    expect(result.current.coordinate).toBeNull();
  });

  it("returns the browser coordinate on user request success", async () => {
    installGeolocationMock(({ success }) =>
      success({ coords: { latitude: 16.0544, longitude: 108.2022 } } as GeolocationPosition)
    );
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.requestLocation());
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.coordinate).toEqual({ latitude: 16.0544, longitude: 108.2022 });
  });

  it("sets error status on permission denial without overwriting coordinate or falling back silently", async () => {
    installGeolocationMock(({ error }) =>
      error({ code: 1, message: "denied" } as GeolocationPositionError)
    );
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.requestLocation());
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.coordinate).toBeNull();
    expect(result.current.message).toMatch(/từ chối quyền/i);
  });
});
