"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Heart,
  Folder,
  Plus,
  Compass,
  Bookmark,
  Trash2,
  Lock,
  Globe,
  Loader2,
  LogIn,
  Pencil,
  Share2,
  Search,
  Check,
  Camera,
  Star,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlaceCard } from "@/components/place/PlaceCard";
import { mapBackendPlaceToPlace, placeService } from "@/services/place.service";
import { DEFAULT_COLLECTION_TITLE } from "@/services/collection.service";
import {
  useCollections,
  useCollectionDetail,
  useCreateCollection,
  useUpdateCollection,
  useDeleteCollection,
  useAddPlaceToCollection,
} from "@/features/collections/hooks/use-collections";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Place } from "@/types/place";
import { getPlaceCategoryLabel, useI18n } from "@/i18n";
import { toast } from "sonner";

export default function CollectionsPage() {
  const { locale, t } = useI18n();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isAuthenticated = Boolean(user);

  const {
    data: collections = [],
    isLoading: isCollectionsLoading,
    isError: isCollectionsError,
    refetch: refetchCollections,
  } = useCollections();

  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);

  // Default active collection to the first one (usually DEFAULT_COLLECTION_TITLE)
  const selectedCollectionId = useMemo(() => {
    if (activeCollectionId && collections.some((c) => c.id === activeCollectionId)) {
      return activeCollectionId;
    }
    return collections[0]?.id || null;
  }, [activeCollectionId, collections]);

  const {
    data: collectionDetail,
    isLoading: isDetailLoading,
    isError: isDetailError,
    refetch: refetchDetail,
  } = useCollectionDetail(selectedCollectionId || "");

  // Create Collection Dialog State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIsPublic, setNewIsPublic] = useState(false);

  // Edit Collection Dialog State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(false);

  // Add Place Dialog State (Unified 3-Tier Search)
  const [isAddPlaceOpen, setIsAddPlaceOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingPlaceId, setAddingPlaceId] = useState<string | null>(null);

  const createMutation = useCreateCollection();
  const updateMutation = useUpdateCollection();
  const deleteMutation = useDeleteCollection();
  const addPlaceMutation = useAddPlaceToCollection();

  // Search debounce using 3-tier search engine
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await placeService.searchPlaces({ keyword: trimmed, limit: 6 });
        if (!cancelled) {
          setSearchResults(res.places || []);
        }
      } catch {
        if (!cancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const handleSearchQueryChange = (value: string) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  const getDisplayCollectionTitle = (title: string) =>
    title === DEFAULT_COLLECTION_TITLE ? t("collections.defaultTitle") : title;

  const existingPlaceIds = useMemo(() => {
    return new Set(collectionDetail?.places.map((p) => p.placeId) || []);
  }, [collectionDetail]);

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    createMutation.mutate(
      {
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        isPublic: newIsPublic,
      },
      {
        onSuccess: (newCol) => {
          setIsCreateOpen(false);
          setNewTitle("");
          setNewDescription("");
          setNewIsPublic(false);
          setActiveCollectionId(newCol.id);
        },
      }
    );
  };

  const handleOpenEditModal = () => {
    if (!collectionDetail) return;
    setEditTitle(getDisplayCollectionTitle(collectionDetail.title));
    setEditDescription(collectionDetail.description || "");
    setEditIsPublic(collectionDetail.isPublic);
    setIsEditOpen(true);
  };

  const handleUpdateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollectionId) return;

    updateMutation.mutate(
      {
        id: selectedCollectionId,
        payload: {
          title: collectionDetail?.title === DEFAULT_COLLECTION_TITLE ? undefined : editTitle.trim(),
          description: editDescription.trim() || undefined,
          isPublic: editIsPublic,
        },
      },
      {
        onSuccess: () => {
          setIsEditOpen(false);
        },
      }
    );
  };

  const handleDeleteActiveCollection = () => {
    if (!selectedCollectionId) return;
    if (confirm(t("collections.deleteConfirm"))) {
      deleteMutation.mutate(selectedCollectionId, {
        onSuccess: () => {
          setActiveCollectionId(null);
        },
      });
    }
  };

  const handleShareCollection = () => {
    if (!selectedCollectionId) return;
    const shareUrl = `${window.location.origin}/collections/${selectedCollectionId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      toast.success(t("collections.toasts.linkCopied"));
    } else {
      toast.info(t("collections.toasts.linkFallback", { url: shareUrl }));
    }
  };

  const handleAddPlace = async (placeId: string) => {
    if (!selectedCollectionId || addingPlaceId) return;
    setAddingPlaceId(placeId);

    try {
      await addPlaceMutation.mutateAsync({
        collectionId: selectedCollectionId,
        placeId,
        collectionName: collectionDetail
          ? getDisplayCollectionTitle(collectionDetail.title)
          : undefined,
      });
    } finally {
      setAddingPlaceId(null);
    }
  };

  // Not logged in: Show editorial sign-in banner
  if (!isAuthLoading && !isAuthenticated) {
    return (
      <div className="max-w-[1536px] mx-auto w-full px-4 py-16 sm:px-6 lg:px-8 text-center space-y-6">
        <div className="mx-auto size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
          <Bookmark className="size-8" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-foreground">
            {t("collections.guestTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("collections.guestDescription")}
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/login"
            className={buttonVariants({
              className: "h-11 px-6 rounded-xl font-semibold gap-2 inline-flex items-center",
            })}
          >
            <LogIn className="size-4" />
            <span>{t("collections.signInNow")}</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1536px] mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10 space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading text-foreground">
            {t("collections.pageTitle")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {t("collections.pageSubtitle")}
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger
            render={
              <Button
                variant="outline"
                className="h-10 px-4 rounded-xl font-semibold gap-2 border-primary/30 text-primary hover:bg-primary/10"
              >
                <Plus className="size-4" />
                <span>{t("collections.createButton")}</span>
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleCreateCollection} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl">{t("collections.createModalTitle")}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {t("collections.createModalDescription")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <label htmlFor="createCollectionTitle" className="text-xs font-semibold text-foreground">
                    {t("collections.titleLabel")} <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    id="createCollectionTitle"
                    required
                    placeholder={t("collections.titlePlaceholder")}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    maxLength={100}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="createCollectionDescription" className="text-xs font-semibold text-foreground">
                    {t("collections.descriptionLabelOptional")}
                  </label>
                  <Input
                    id="createCollectionDescription"
                    placeholder={t("collections.descriptionPlaceholder")}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    maxLength={200}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isPublicCheck"
                    checked={newIsPublic}
                    onChange={(e) => setNewIsPublic(e.target.checked)}
                    className="size-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="isPublicCheck" className="text-xs text-muted-foreground cursor-pointer">
                    {t("collections.publicCheckbox")}
                  </label>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={createMutation.isPending}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={!newTitle.trim() || createMutation.isPending}
                  className="gap-2"
                >
                  {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                  <span>{t("collections.createSubmit")}</span>
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loading Skeleton */}
      {isCollectionsLoading && (
        <div className="space-y-6">
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 w-28 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-72 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {isCollectionsError && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
          <p className="text-sm font-medium text-destructive">
            {t("collections.loadError")}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetchCollections()}>
            {t("common.retry")}
          </Button>
        </div>
      )}

      {/* Collections Tabs */}
      {!isCollectionsLoading && collections.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {collections.map((col) => {
              const isSelected = col.id === selectedCollectionId;
              const isDefaultFav = col.title === DEFAULT_COLLECTION_TITLE;

              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setActiveCollectionId(col.id)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all shrink-0 min-h-[44px] cursor-pointer ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-xs ring-1 ring-primary/40"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {isDefaultFav ? (
                    <Heart className={`size-3.5 ${isSelected ? "fill-current" : "text-rose-500"}`} />
                  ) : (
                    <Folder className="size-3.5" />
                  )}
                  <span>{getDisplayCollectionTitle(col.title)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted-foreground/15 text-muted-foreground"
                    }`}
                  >
                    {col._count?.places ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Collection Meta & Action Toolbar */}
          {collectionDetail && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/30 border border-border/60 rounded-2xl p-4 sm:px-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold font-heading text-foreground">
                    {getDisplayCollectionTitle(collectionDetail.title)}
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                      collectionDetail.isPublic
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {collectionDetail.isPublic ? (
                      <>
                        <Globe className="size-3" />
                        <span>{t("collections.publicBadge")}</span>
                      </>
                    ) : (
                      <>
                        <Lock className="size-3" />
                        <span>{t("collections.privateBadge")}</span>
                      </>
                    )}
                  </span>
                </div>
                {collectionDetail.description && (
                  <p className="text-xs text-muted-foreground max-w-xl">
                    {collectionDetail.description}
                  </p>
                )}
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {/* Share Button (When Public) */}
                {collectionDetail.isPublic && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShareCollection}
                    className="h-9 min-h-[44px] sm:min-h-0 px-3 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
                    title={t("collections.shareTooltip")}
                  >
                    <Share2 className="size-3.5 text-primary" />
                    <span>{t("collections.share")}</span>
                  </Button>
                )}

                {/* Add Place Dialog Trigger */}
                <Dialog open={isAddPlaceOpen} onOpenChange={setIsAddPlaceOpen}>
                  <DialogTrigger
                    render={
                      <Button
                        size="sm"
                        className="h-9 min-h-[44px] sm:min-h-0 px-3 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
                      >
                        <Plus className="size-3.5" />
                        <span>{t("collections.addPlace")}</span>
                      </Button>
                    }
                  />
                  <DialogContent className="sm:max-w-lg p-6 space-y-4">
                    <DialogHeader>
                      <DialogTitle className="font-heading text-xl">{t("collections.addPlaceModalTitle")}</DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground">
                        {t("collections.addPlaceModalDescription")}
                      </DialogDescription>
                    </DialogHeader>

                    {/* Universal Search Input */}
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        autoFocus
                        aria-label={t("collections.searchAria")}
                        placeholder={t("collections.searchPlaceholder")}
                        value={searchQuery}
                        onChange={(e) => handleSearchQueryChange(e.target.value)}
                        className="pl-10 h-11 rounded-xl text-sm"
                      />
                      {isSearching && (
                        <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-primary animate-spin" />
                      )}
                    </div>

                    {/* Search Results List */}
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {isSearching ? (
                        <div className="space-y-2 py-4">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
                          ))}
                        </div>
                      ) : searchResults.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8">
                          {searchQuery.trim()
                            ? t("collections.searchNoResults")
                            : t("collections.searchPrompt")}
                        </p>
                      ) : (
                        searchResults.map((p) => {
                          const isAlreadyIn = existingPlaceIds.has(p.id);
                          const isAdding = addingPlaceId === p.id;

                          return (
                            <div
                              key={p.id}
                              className="flex items-center justify-between p-3 rounded-xl border border-border/70 hover:bg-muted/40 transition-colors gap-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="relative size-12 rounded-lg overflow-hidden bg-muted shrink-0">
                                  {p.coverImage ? (
                                    <Image
                                      src={p.coverImage}
                                      alt={p.name}
                                      fill
                                      sizes="48px"
                                      className="object-cover"
                                    />
                                  ) : (
                                    <div className="size-full flex items-center justify-center text-muted-foreground">
                                      <Camera className="size-4" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-foreground truncate">{p.name}</h4>
                                  <p className="text-[11px] text-muted-foreground truncate">{p.address}</p>
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                    <span className="text-primary font-medium">{getPlaceCategoryLabel(p, locale)}</span>
                                    {p.rating > 0 && (
                                      <span className="flex items-center gap-0.5">
                                        <Star className="size-2.5 text-amber-500 fill-amber-500" />
                                        <span>{p.rating.toFixed(1)}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0">
                                {isAlreadyIn ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                                    <Check className="size-3" />
                                    <span>{t("collections.alreadyAdded")}</span>
                                  </span>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => handleAddPlace(p.id)}
                                    disabled={isAdding}
                                    className="h-8 px-3 rounded-lg text-xs gap-1 font-semibold cursor-pointer"
                                  >
                                    {isAdding ? (
                                      <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                      <Plus className="size-3" />
                                    )}
                                    <span>{t("collections.add")}</span>
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Edit Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenEditModal}
                  className="h-9 min-h-[44px] sm:min-h-0 px-3 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
                  title={t("collections.editTooltip")}
                >
                  <Pencil className="size-3.5" />
                  <span>{t("collections.edit")}</span>
                </Button>

                {/* Delete Button (Except DEFAULT_COLLECTION_TITLE) */}
                {collectionDetail.title !== DEFAULT_COLLECTION_TITLE && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteActiveCollection}
                    disabled={deleteMutation.isPending}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-9 min-h-[44px] sm:min-h-0 px-2.5 rounded-xl gap-1 text-xs cursor-pointer"
                    title={t("collections.deleteTooltip")}
                  >
                    <Trash2 className="size-3.5" />
                    <span className="hidden sm:inline">{t("collections.delete")}</span>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Edit Collection Dialog */}
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="sm:max-w-md">
              <form onSubmit={handleUpdateCollection} className="space-y-4">
                <DialogHeader>
                  <DialogTitle className="font-heading text-xl">{t("collections.editModalTitle")}</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    {t("collections.editModalDescription")}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                  <div className="space-y-1.5">
                    <label htmlFor="editCollectionTitle" className="text-xs font-semibold text-foreground">
                      {t("collections.titleLabel")} <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      id="editCollectionTitle"
                      required
                      disabled={collectionDetail?.title === DEFAULT_COLLECTION_TITLE}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      maxLength={100}
                      className="h-10 text-sm disabled:opacity-60"
                    />
                    {collectionDetail?.title === DEFAULT_COLLECTION_TITLE && (
                      <p className="text-[11px] text-muted-foreground">
                        {t("collections.defaultRenameHint", { title: t("collections.defaultTitle") })}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="editCollectionDescription" className="text-xs font-semibold text-foreground">
                      {t("collections.descriptionLabel")}
                    </label>
                    <Input
                      id="editCollectionDescription"
                      placeholder={t("collections.descriptionPlaceholder")}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      maxLength={200}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="editPublicCheck"
                      checked={editIsPublic}
                      onChange={(e) => setEditIsPublic(e.target.checked)}
                      className="size-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <label htmlFor="editPublicCheck" className="text-xs text-muted-foreground cursor-pointer">
                      {t("collections.publicCheckbox")}
                    </label>
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsEditOpen(false)}
                    disabled={updateMutation.isPending}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={!editTitle.trim() || updateMutation.isPending}
                    className="gap-2"
                  >
                    {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                    <span>{t("collections.saveChanges")}</span>
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Places Grid */}
          {isDetailLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-72 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : isDetailError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
              <p className="text-sm font-medium text-destructive">
                {t("collections.detailLoadError")}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetchDetail()}>
                {t("common.retry")}
              </Button>
            </div>
          ) : collectionDetail?.places && collectionDetail.places.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {collectionDetail.places.map((item) => {
                const place = mapBackendPlaceToPlace(item.place);
                return (
                  <PlaceCard
                    key={place.id}
                    place={place}
                    currentCollectionId={selectedCollectionId}
                    collectionName={getDisplayCollectionTitle(collectionDetail.title)}
                  />
                );
              })}
            </div>
          ) : (
            /* Empty State (C-4 standard) */
            <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-4 max-w-lg mx-auto">
              <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Compass className="size-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">
                  {t("collections.emptyTitle")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("collections.emptyHint")}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button
                  onClick={() => setIsAddPlaceOpen(true)}
                  className="rounded-xl text-xs font-semibold gap-1.5"
                >
                  <Plus className="size-3.5" />
                  <span>{t("collections.findAndAdd")}</span>
                </Button>
                <Link
                  href="/places"
                  className={buttonVariants({
                    variant: "outline",
                    className: "rounded-xl text-xs font-semibold inline-flex items-center",
                  })}
                >
                  {t("collections.explorePlaces")}
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
