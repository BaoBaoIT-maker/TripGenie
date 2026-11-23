import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { placeService } from "@/services/place.service";
import { usePlacePhotoContributions } from "@/components/place/use-place-photo-contributions";
import { CONTRIBUTED_PHOTO_STATES } from "@/types/place";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/services/place.service", () => ({
  placeService: {
    contributePhoto: vi.fn(),
  },
}));

describe("usePlacePhotoContributions (Honest Optimistic Upload)", () => {
  const createObjectURLSpy = vi.fn();
  const revokeObjectURLSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    let blobSeq = 0;
    createObjectURLSpy.mockImplementation(() => `blob:local-preview-${++blobSeq}`);
    revokeObjectURLSpy.mockImplementation(() => undefined);
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: createObjectURLSpy,
      revokeObjectURL: revokeObjectURLSpy,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows uploading immediately (0ms), protects beforeunload, then transitions to pending on success", async () => {
    let resolveApi!: (value: {
      message: string;
      image: {
        id: string;
        placeId: string;
        imageUrl: string;
        caption: string | null;
        status: "PENDING";
      };
    }) => void;

    vi.mocked(placeService.contributePhoto).mockImplementation(
      () =>
        new Promise((res) => {
          resolveApi = res;
        })
    );

    const addListenerSpy = vi.spyOn(window, "addEventListener");
    const removeListenerSpy = vi.spyOn(window, "removeEventListener");

    const file = new File(["img-bytes"], "sunset.jpg", { type: "image/jpeg" });
    const { result } = renderHook(() =>
      usePlacePhotoContributions("place-1", [
        { id: "server-old-1", imageUrl: "https://res.cloudinary.com/old.jpg", caption: "Old" },
      ])
    );

    act(() => {
      result.current.enqueueUpload({
        placeId: "place-1",
        file,
        caption: "Hoàng hôn",
      });
    });

    // 0ms: item appears immediately in UPLOADING state ahead of existing server pending items
    expect(result.current.photos).toHaveLength(2);
    expect(result.current.photos[0].uploadState).toBe(CONTRIBUTED_PHOTO_STATES.UPLOADING);
    expect(result.current.photos[0].imageUrl).toBe("blob:local-preview-1");
    expect(result.current.hasActiveUploads).toBe(true);
    expect(addListenerSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));

    const stableClientKey = result.current.photos[0].clientKey;

    // Resolve server upload
    act(() => {
      resolveApi({
        message: "Đã gửi ảnh thành công",
        image: {
          id: "server-new-99",
          placeId: "place-1",
          imageUrl: "https://res.cloudinary.com/new-99.jpg",
          caption: "Hoàng hôn",
          status: "PENDING",
        },
      });
    });

    await waitFor(() => {
      expect(result.current.photos[0].uploadState).toBe(CONTRIBUTED_PHOTO_STATES.PENDING);
    });

    expect(result.current.photos[0].id).toBe("server-new-99");
    // Stable clientKey prevents DOM unmount/flicker
    expect(result.current.photos[0].clientKey).toBe(stableClientKey);
    expect(result.current.hasActiveUploads).toBe(false);
    expect(removeListenerSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    expect(toast.success).toHaveBeenCalled();
  });

  it("keeps failed upload in ERROR state (no silent loss) and recovers cleanly via retryUpload", async () => {
    vi.mocked(placeService.contributePhoto)
      .mockRejectedValueOnce(new Error("Mạng chập chờn"))
      .mockResolvedValueOnce({
        message: "OK",
        image: {
          id: "server-retry-ok",
          placeId: "place-1",
          imageUrl: "https://res.cloudinary.com/retry-ok.jpg",
          caption: "Góc quán",
          status: "PENDING",
        },
      });

    const file = new File(["img-bytes"], "cafe.png", { type: "image/png" });
    const { result } = renderHook(() => usePlacePhotoContributions("place-1", []));

    act(() => {
      result.current.enqueueUpload({ placeId: "place-1", file, caption: "Góc quán" });
    });

    await waitFor(() => {
      expect(result.current.photos[0].uploadState).toBe(CONTRIBUTED_PHOTO_STATES.ERROR);
    });

    expect(result.current.photos[0].errorMessage).toBe("Mạng chập chờn");
    expect(toast.error).toHaveBeenCalledWith("Mạng chập chờn");

    const failedKey = result.current.photos[0].clientKey;

    // Retry without re-picking file
    act(() => {
      result.current.retryUpload(failedKey);
    });

    await waitFor(() => {
      expect(result.current.photos[0].uploadState).toBe(CONTRIBUTED_PHOTO_STATES.PENDING);
    });

    expect(result.current.photos[0].id).toBe("server-retry-ok");
    expect(placeService.contributePhoto).toHaveBeenCalledTimes(2);
  });

  it("dismisses a failed upload and revokes its object URL cleanly", async () => {
    vi.mocked(placeService.contributePhoto).mockRejectedValueOnce(new Error("Upload lỗi"));

    const file = new File(["img-bytes"], "broken.webp", { type: "image/webp" });
    const { result } = renderHook(() => usePlacePhotoContributions("place-1", []));

    act(() => {
      result.current.enqueueUpload({ placeId: "place-1", file });
    });

    await waitFor(() => {
      expect(result.current.photos[0].uploadState).toBe(CONTRIBUTED_PHOTO_STATES.ERROR);
    });

    const failedKey = result.current.photos[0].clientKey;

    act(() => {
      result.current.dismissUpload(failedKey);
    });

    expect(result.current.photos).toHaveLength(0);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:local-preview-1");
  });
});
