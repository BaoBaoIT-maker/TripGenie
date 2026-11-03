"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Place } from "@/types/place";
import {
  useAddPlaceToCollection,
  useCollections,
  useCollectionsContainingPlace,
  useCreateCollection,
  useToggleFavorite,
} from "@/features/collections/hooks/use-collections";
import { DEFAULT_COLLECTION_TITLE } from "@/services/collection.service";
import { Heart, Folder, Check, Plus, Loader2, Camera, Lock, Globe } from "lucide-react";

interface SaveToCollectionModalProps {
  place: Place | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SaveToCollectionModal({
  place,
  isOpen,
  onClose,
}: SaveToCollectionModalProps) {
  const { data: collections = [], isLoading: isCollectionsLoading } = useCollections();
  const { data: containingSet, isLoading: isContainingLoading } =
    useCollectionsContainingPlace(place?.id, { enabled: isOpen && Boolean(place?.id) });

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isCreatingInline, setIsCreatingInline] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newIsPublic, setNewIsPublic] = useState(false);

  const toggleMutation = useToggleFavorite();
  const addPlaceMutation = useAddPlaceToCollection();
  const createMutation = useCreateCollection();

  if (!place) return null;

  const handleToggleCollection = (collectionId: string) => {
    if (togglingId || toggleMutation.isPending) return;
    setTogglingId(collectionId);

    toggleMutation.mutate(
      { placeId: place.id, collectionId },
      {
        onSettled: () => setTogglingId(null),
      }
    );
  };

  const handleCreateAndAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    createMutation.mutate(
      {
        title: newTitle.trim(),
        isPublic: newIsPublic,
      },
      {
        onSuccess: (newCol) => {
          addPlaceMutation.mutate(
            { collectionId: newCol.id, placeId: place.id },
            {
              onSuccess: () => {
                setNewTitle("");
                setIsCreatingInline(false);
              },
            }
          );
        },
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-6 space-y-5">
        <DialogHeader className="space-y-1">
          <DialogTitle className="font-heading text-xl">Lưu vào bộ sưu tập</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Chọn một hoặc nhiều bộ sưu tập để lưu địa điểm này.
          </DialogDescription>
        </DialogHeader>

        {/* Place Summary Header */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border/70">
          <div className="relative size-12 rounded-xl overflow-hidden bg-muted shrink-0">
            {place.coverImage ? (
              <Image
                src={place.coverImage}
                alt={place.name}
                fill
                sizes="48px"
                className="object-cover"
              />
            ) : (
              <div className="size-full flex items-center justify-center text-muted-foreground">
                <Camera className="size-5" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-foreground truncate">{place.name}</h4>
            <p className="text-[11px] text-muted-foreground truncate">{place.address}</p>
          </div>
        </div>

        {/* Collections List */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {isCollectionsLoading || isContainingLoading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : collections.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Chưa có bộ sưu tập nào.
            </p>
          ) : (
            collections.map((col) => {
              const isChecked = containingSet?.has(col.id) ?? false;
              const isBusy = togglingId === col.id;
              const isFav = col.title === DEFAULT_COLLECTION_TITLE;

              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => handleToggleCollection(col.id)}
                  disabled={isBusy}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all min-h-[44px] cursor-pointer ${
                    isChecked
                      ? "border-primary/60 bg-primary/5"
                      : "border-border/70 hover:border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isFav ? "bg-rose-50 text-rose-500 dark:bg-rose-950/40" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isFav ? <Heart className="size-4 fill-current" /> : <Folder className="size-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {col.title}
                        </span>
                        {col.isPublic ? (
                          <Globe className="size-2.5 text-muted-foreground" />
                        ) : (
                          <Lock className="size-2.5 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {col._count?.places ?? 0} địa điểm
                      </span>
                    </div>
                  </div>

                  <div className="size-5 rounded-md border flex items-center justify-center transition-colors border-border shrink-0 ml-2">
                    {isBusy ? (
                      <Loader2 className="size-3 animate-spin text-primary" />
                    ) : isChecked ? (
                      <div className="size-full rounded-md bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="size-3.5 stroke-[3]" />
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Inline Create Collection */}
        {!isCreatingInline ? (
          <Button
            variant="ghost"
            type="button"
            onClick={() => setIsCreatingInline(true)}
            className="w-full min-h-[44px] rounded-xl text-xs font-semibold gap-2 border border-dashed border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/40 cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Tạo bộ sưu tập mới</span>
          </Button>
        ) : (
          <form onSubmit={handleCreateAndAdd} className="space-y-3 p-3 rounded-2xl bg-muted/30 border border-border">
            <div className="space-y-1">
              <label htmlFor="inlineNewColTitle" className="text-[11px] font-semibold text-foreground">
                Tên bộ sưu tập
              </label>
              <Input
                id="inlineNewColTitle"
                autoFocus
                required
                placeholder="VD: Quán cafe sống ảo"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                maxLength={80}
                className="h-10 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="inlinePublic"
                checked={newIsPublic}
                onChange={(e) => setNewIsPublic(e.target.checked)}
                className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
              <label htmlFor="inlinePublic" className="text-[11px] text-muted-foreground cursor-pointer">
                Công khai bộ sưu tập này
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsCreatingInline(false);
                  setNewTitle("");
                }}
                className="min-h-[40px] text-xs cursor-pointer"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!newTitle.trim() || createMutation.isPending || addPlaceMutation.isPending}
                className="min-h-[40px] text-xs gap-1.5 cursor-pointer"
              >
                {(createMutation.isPending || addPlaceMutation.isPending) && (
                  <Loader2 className="size-3 animate-spin" />
                )}
                <span>Tạo & Lưu</span>
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
