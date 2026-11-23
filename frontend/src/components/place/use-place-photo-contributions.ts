"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ApiClientError } from "@/lib/api-client";
import { placeService } from "@/services/place.service";
import { PLACE_PHOTO_UPLOAD_MESSAGES } from "@/features/admin/admin.constants";
import {
  CONTRIBUTED_PHOTO_STATES,
  type ContributedPhotoUploadState,
  type PendingContributedPhoto,
} from "@/types/place";

export interface ContributedPhotoItem extends PendingContributedPhoto {
  /** Stable React key preventing DOM remount/flicker when optimistic ID swaps to server ID */
  clientKey: string;
  uploadState: ContributedPhotoUploadState;
}

interface LocalUploadEntry extends ContributedPhotoItem {
  placeId: string;
  file?: File;
  blobUrl?: string;
}

export interface EnqueuePhotoUploadPayload {
  placeId: string;
  file: File;
  caption?: string;
}

function resolveUploadErrorMessage(err: unknown): string {
  if (err instanceof ApiClientError && err.statusCode === 401) {
    return PLACE_PHOTO_UPLOAD_MESSAGES.UNAUTHORIZED;
  }
  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message;
  }
  return PLACE_PHOTO_UPLOAD_MESSAGES.UPLOAD_FAILED_FALLBACK;
}

function createOptimisticId(seq: number): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `optimistic-photo-${crypto.randomUUID()}`;
  }
  return `optimistic-photo-${Date.now()}-${seq}`;
}

export function usePlacePhotoContributions(
  placeId: string | undefined,
  serverPendingPhotos: PendingContributedPhoto[] | undefined
) {
  const [localEntries, setLocalEntries] = useState<LocalUploadEntry[]>([]);
  const activePlaceIdRef = useRef<string | undefined>(placeId);
  const seqRef = useRef(0);
  const activeBlobUrlsRef = useRef<Set<string>>(new Set());
  const localEntriesRef = useRef<LocalUploadEntry[]>([]);

  useEffect(() => {
    localEntriesRef.current = localEntries;
  }, [localEntries]);

  const revokeBlobUrl = useCallback((url?: string) => {
    if (!url || !activeBlobUrlsRef.current.has(url)) return;
    URL.revokeObjectURL(url);
    activeBlobUrlsRef.current.delete(url);
  }, []);

  const revokeAllBlobs = useCallback(() => {
    activeBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    activeBlobUrlsRef.current.clear();
  }, []);

  // Reset queue & release preview blobs when navigating to a different place
  useEffect(() => {
    if (activePlaceIdRef.current !== placeId) {
      activePlaceIdRef.current = placeId;
      revokeAllBlobs();
      setLocalEntries([]);
    }
  }, [placeId, revokeAllBlobs]);

  // Release all remaining preview blobs on unmount
  useEffect(() => {
    return () => {
      revokeAllBlobs();
    };
  }, [revokeAllBlobs]);

  const hasActiveUploads = useMemo(
    () =>
      localEntries.some(
        (entry) => entry.uploadState === CONTRIBUTED_PHOTO_STATES.UPLOADING
      ),
    [localEntries]
  );

  // Warn user before closing/refreshing tab while multipart uploads are still in flight
  useEffect(() => {
    if (!hasActiveUploads || typeof window === "undefined") return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = PLACE_PHOTO_UPLOAD_MESSAGES.BEFORE_UNLOAD_WARNING;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasActiveUploads]);

  const preloadAndSwapRemoteUrl = useCallback(
    (clientKey: string, remoteUrl: string, blobUrl?: string) => {
      if (typeof window === "undefined" || typeof window.Image === "undefined") {
        return;
      }
      const preloader = new window.Image();
      preloader.onload = () => {
        setLocalEntries((prev) =>
          prev.map((entry) =>
            entry.clientKey === clientKey
              ? { ...entry, imageUrl: remoteUrl, blobUrl: undefined }
              : entry
          )
        );
        revokeBlobUrl(blobUrl);
      };
      preloader.src = remoteUrl;
    },
    [revokeBlobUrl]
  );

  const executeUpload = useCallback(
    async (
      clientKey: string,
      targetPlaceId: string,
      file: File,
      caption?: string,
      blobUrl?: string
    ) => {
      try {
        const res = await placeService.contributePhoto(
          targetPlaceId,
          file,
          caption
        );

        // Ignore late settlement if user already navigated to a different place
        if (activePlaceIdRef.current !== targetPlaceId) return;

        const serverImage = res.image;
        setLocalEntries((prev) =>
          prev.map((entry) =>
            entry.clientKey === clientKey
              ? {
                  ...entry,
                  id: serverImage?.id || entry.id,
                  caption: serverImage?.caption ?? entry.caption,
                  uploadState: CONTRIBUTED_PHOTO_STATES.PENDING,
                  errorMessage: null,
                  file: undefined,
                }
              : entry
          )
        );

        if (serverImage?.imageUrl) {
          preloadAndSwapRemoteUrl(clientKey, serverImage.imageUrl, blobUrl);
        }

        toast.success(
          res.message || PLACE_PHOTO_UPLOAD_MESSAGES.UPLOAD_SUCCESS
        );
      } catch (err) {
        if (activePlaceIdRef.current !== targetPlaceId) return;

        const message = resolveUploadErrorMessage(err);
        setLocalEntries((prev) =>
          prev.map((entry) =>
            entry.clientKey === clientKey
              ? {
                  ...entry,
                  uploadState: CONTRIBUTED_PHOTO_STATES.ERROR,
                  errorMessage: message,
                }
              : entry
          )
        );
        toast.error(message);
      }
    },
    [preloadAndSwapRemoteUrl]
  );

  const enqueueUpload = useCallback(
    ({ placeId: targetPlaceId, file, caption }: EnqueuePhotoUploadPayload) => {
      seqRef.current += 1;
      const clientKey = createOptimisticId(seqRef.current);
      const blobUrl = URL.createObjectURL(file);
      activeBlobUrlsRef.current.add(blobUrl);

      const optimisticEntry: LocalUploadEntry = {
        id: clientKey,
        clientKey,
        placeId: targetPlaceId,
        imageUrl: blobUrl,
        blobUrl,
        caption: caption || null,
        uploadState: CONTRIBUTED_PHOTO_STATES.UPLOADING,
        errorMessage: null,
        file,
      };

      setLocalEntries((prev) => [optimisticEntry, ...prev]);
      void executeUpload(clientKey, targetPlaceId, file, caption, blobUrl);
    },
    [executeUpload]
  );

  const retryUpload = useCallback(
    (clientKey: string) => {
      const target = localEntriesRef.current.find(
        (entry) => entry.clientKey === clientKey
      );
      if (
        !target ||
        target.uploadState !== CONTRIBUTED_PHOTO_STATES.ERROR ||
        !target.file
      ) {
        return;
      }

      setLocalEntries((prev) =>
        prev.map((entry) =>
          entry.clientKey === clientKey
            ? {
                ...entry,
                uploadState: CONTRIBUTED_PHOTO_STATES.UPLOADING,
                errorMessage: null,
              }
            : entry
        )
      );

      void executeUpload(
        target.clientKey,
        target.placeId,
        target.file,
        target.caption || undefined,
        target.blobUrl
      );
    },
    [executeUpload]
  );

  const dismissUpload = useCallback(
    (clientKey: string) => {
      const target = localEntriesRef.current.find(
        (entry) => entry.clientKey === clientKey
      );
      if (!target) return;

      revokeBlobUrl(target.blobUrl);
      setLocalEntries((prev) =>
        prev.filter((entry) => entry.clientKey !== clientKey)
      );
    },
    [revokeBlobUrl]
  );

  const photos = useMemo<ContributedPhotoItem[]>(() => {
    const localIds = new Set(localEntries.map((entry) => entry.id));
    const normalizedServer: ContributedPhotoItem[] = (serverPendingPhotos ?? [])
      .filter((item) => !localIds.has(item.id))
      .map((item) => ({
        ...item,
        clientKey: item.id,
        uploadState: item.uploadState ?? CONTRIBUTED_PHOTO_STATES.PENDING,
      }));

    return [...localEntries, ...normalizedServer];
  }, [localEntries, serverPendingPhotos]);

  return {
    photos,
    hasActiveUploads,
    enqueueUpload,
    retryUpload,
    dismissUpload,
  };
}
