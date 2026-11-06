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
import { toast } from "sonner";

export default function CollectionsPage() {
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
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await placeService.searchPlaces({ keyword: searchQuery.trim(), limit: 6 });
        setSearchResults(res.places || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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
    setEditTitle(collectionDetail.title);
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
    if (confirm("Bạn có chắc chắn muốn xóa bộ sưu tập này không?")) {
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
      toast.success("Đã sao chép liên kết chia sẻ vào bộ nhớ tạm!");
    } else {
      toast.info(`Liên kết: ${shareUrl}`);
    }
  };

  const handleAddPlace = async (placeId: string) => {
    if (!selectedCollectionId || addingPlaceId) return;
    setAddingPlaceId(placeId);

    try {
      await addPlaceMutation.mutateAsync({
        collectionId: selectedCollectionId,
        placeId,
        collectionName: collectionDetail?.title,
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
            Lưu giữ những điểm đến yêu thích
          </h1>
          <p className="text-sm text-muted-foreground">
            Đăng nhập để xem danh sách địa điểm đã lưu, tạo các bộ sưu tập riêng và lên lịch trình một cách dễ dàng.
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
            <span>Đăng nhập ngay</span>
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
            Bộ sưu tập & Địa điểm đã lưu
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Quản lý và sắp xếp các điểm đến ưa thích cho chuyến đi sắp tới.
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
                <span>Tạo bộ sưu tập</span>
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleCreateCollection} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl">Tạo bộ sưu tập mới</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Gom nhóm các địa điểm theo chủ đề như Quán cafe, Chuyến đi Đà Lạt, v.v.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <label htmlFor="createCollectionTitle" className="text-xs font-semibold text-foreground">
                    Tên bộ sưu tập <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    id="createCollectionTitle"
                    required
                    placeholder="VD: Quán cafe chụp ảnh đẹp"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    maxLength={100}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="createCollectionDescription" className="text-xs font-semibold text-foreground">
                    Mô tả (tùy chọn)
                  </label>
                  <Input
                    id="createCollectionDescription"
                    placeholder="Ghi chú thêm về bộ sưu tập..."
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
                    Cho phép chia sẻ công khai với bạn bè
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
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={!newTitle.trim() || createMutation.isPending}
                  className="gap-2"
                >
                  {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                  <span>Tạo ngay</span>
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
            Không thể tải danh sách bộ sưu tập. Vui lòng thử lại.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetchCollections()}>
            Thử lại
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
                  <span>{col.title}</span>
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
                    {collectionDetail.title}
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
                        <span>Công khai</span>
                      </>
                    ) : (
                      <>
                        <Lock className="size-3" />
                        <span>Riêng tư</span>
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
                    title="Sao chép liên kết chia sẻ"
                  >
                    <Share2 className="size-3.5 text-primary" />
                    <span>Chia sẻ</span>
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
                        <span>Thêm địa điểm</span>
                      </Button>
                    }
                  />
                  <DialogContent className="sm:max-w-lg p-6 space-y-4">
                    <DialogHeader>
                      <DialogTitle className="font-heading text-xl">Thêm địa điểm vào bộ sưu tập</DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground">
                        Tìm kiếm địa điểm bằng tên quán, địa chỉ hoặc từ khóa AI (áp dụng công nghệ tìm kiếm 3 tầng).
                      </DialogDescription>
                    </DialogHeader>

                    {/* Universal Search Input */}
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        autoFocus
                        aria-label="Tìm kiếm địa điểm để thêm vào bộ sưu tập"
                        placeholder="VD: Cà phê Trứng, Bạch Đằng, Bánh mì Phượng..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
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
                            ? "Không tìm thấy địa điểm nào khớp với từ khóa."
                            : "Gõ từ khóa để bắt đầu tìm kiếm địa điểm..."}
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
                                    <span className="text-primary font-medium">{p.categoryLabel}</span>
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
                                    <span>Đã có</span>
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
                                    <span>Thêm</span>
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
                  title="Chỉnh sửa thông tin bộ sưu tập"
                >
                  <Pencil className="size-3.5" />
                  <span>Chỉnh sửa</span>
                </Button>

                {/* Delete Button (Except DEFAULT_COLLECTION_TITLE) */}
                {collectionDetail.title !== DEFAULT_COLLECTION_TITLE && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteActiveCollection}
                    disabled={deleteMutation.isPending}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-9 min-h-[44px] sm:min-h-0 px-2.5 rounded-xl gap-1 text-xs cursor-pointer"
                    title="Xóa bộ sưu tập"
                  >
                    <Trash2 className="size-3.5" />
                    <span className="hidden sm:inline">Xóa</span>
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
                  <DialogTitle className="font-heading text-xl">Chỉnh sửa bộ sưu tập</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Cập nhật tên, mô tả hoặc chuyển đổi trạng thái hiển thị của bộ sưu tập.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                  <div className="space-y-1.5">
                    <label htmlFor="editCollectionTitle" className="text-xs font-semibold text-foreground">
                      Tên bộ sưu tập <span className="text-rose-500">*</span>
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
                        Bộ sưu tập mặc định &ldquo;{DEFAULT_COLLECTION_TITLE}&rdquo; không thể đổi tên.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="editCollectionDescription" className="text-xs font-semibold text-foreground">
                      Mô tả
                    </label>
                    <Input
                      id="editCollectionDescription"
                      placeholder="Ghi chú thêm về bộ sưu tập..."
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
                      Cho phép chia sẻ công khai với bạn bè
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
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    disabled={!editTitle.trim() || updateMutation.isPending}
                    className="gap-2"
                  >
                    {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                    <span>Lưu thay đổi</span>
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
                Không thể tải danh sách địa điểm trong bộ sưu tập.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetchDetail()}>
                Thử lại
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
                    collectionName={collectionDetail.title}
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
                  Chưa có địa điểm nào trong bộ sưu tập này
                </h3>
                <p className="text-xs text-muted-foreground">
                  Bấm "+ Thêm địa điểm" ở trên hoặc bấm biểu tượng trái tim trên các thẻ địa điểm để lưu lại.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button
                  onClick={() => setIsAddPlaceOpen(true)}
                  className="rounded-xl text-xs font-semibold gap-1.5"
                >
                  <Plus className="size-3.5" />
                  <span>Tìm và thêm địa điểm</span>
                </Button>
                <Link
                  href="/places"
                  className={buttonVariants({
                    variant: "outline",
                    className: "rounded-xl text-xs font-semibold inline-flex items-center",
                  })}
                >
                  Khám phá địa điểm
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
