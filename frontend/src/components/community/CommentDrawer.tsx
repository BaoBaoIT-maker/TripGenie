"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Send, Trash2, MessageSquare, CornerDownRight, X, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  usePostComments,
  useCreatePostComment,
  useDeletePostComment,
} from "@/features/community/hooks/use-community";
import {
  COMMUNITY_UI_CONSTANTS,
  formatRelativeTime,
} from "@/services/community.service";
import type { CommunityCommentItem } from "@/types/community";
import { toast } from "sonner";

interface CommentDrawerProps {
  postId: string;
  postOwnerId: string;
}

interface ReplyTargetState {
  parentId: string;
  replyToName: string;
}

export function CommentDrawer({ postId, postOwnerId }: CommentDrawerProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [replyTarget, setReplyTarget] = useState<ReplyTargetState | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { data: comments = [], isLoading } = usePostComments(postId, true);
  const createCommentMutation = useCreatePostComment();
  const deleteCommentMutation = useDeletePostComment();

  // Group into 1-level threads (TikTok / Facebook / YouTube style)
  const threadedComments = useMemo(() => {
    const roots: CommunityCommentItem[] = [];
    const repliesByRootId = new Map<string, CommunityCommentItem[]>();
    const rootIds = new Set<string>();

    for (const cmt of comments) {
      if (!cmt.parentId) {
        roots.push(cmt);
        rootIds.add(cmt.id);
      }
    }

    for (const cmt of comments) {
      if (cmt.parentId) {
        if (rootIds.has(cmt.parentId)) {
          const list = repliesByRootId.get(cmt.parentId) ?? [];
          list.push(cmt);
          repliesByRootId.set(cmt.parentId, list);
        } else {
          // Fallback if parent is not in list
          roots.push(cmt);
        }
      }
    }

    return roots.map((root) => ({
      root,
      replies: repliesByRootId.get(root.id) ?? [],
    }));
  }, [comments]);

  const handleSelectReply = (targetCommentId: string, targetAuthorName: string) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để trả lời bình luận");
      return;
    }
    setReplyTarget({
      parentId: targetCommentId,
      replyToName: targetAuthorName,
    });
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    const activeReply = replyTarget;
    setContent("");
    setReplyTarget(null);

    createCommentMutation.mutate({
      postId,
      content: trimmed,
      parentId: activeReply?.parentId,
      replyToName: activeReply?.replyToName,
    });
  };

  const renderCommentCard = (
    cmt: CommunityCommentItem,
    isReply: boolean
  ) => {
    const canDelete =
      Boolean(user) &&
      !cmt.isOptimistic &&
      (user?.id === cmt.userId ||
        user?.id === postOwnerId ||
        user?.role === "ADMIN");

    const profileHref = `/community/profile/${encodeURIComponent(
      cmt.author.username || cmt.author.id
    )}`;

    return (
      <div
        key={cmt.id}
        className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-colors ${
          isReply
            ? "bg-muted/30 border-border/40"
            : "bg-muted/50 border-border/60 hover:border-border"
        }`}
      >
        <Link href={profileHref} className="shrink-0 pt-0.5">
          <Avatar className={`${isReply ? "size-6" : "size-7"} border border-border`}>
            <AvatarImage
              src={cmt.author.avatarUrl || undefined}
              alt={cmt.author.fullName}
            />
            <AvatarFallback className="text-[10px] font-bold bg-secondary text-secondary-foreground">
              {cmt.author.fullName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <Link
                href={profileHref}
                className="text-xs font-bold text-foreground hover:text-primary transition-colors truncate"
              >
                {cmt.author.fullName}
              </Link>
              {cmt.userId === postOwnerId && (
                <span className="px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground text-[11px] font-semibold">
                  Tác giả
                </span>
              )}
              {isReply && cmt.replyToName && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CornerDownRight className="size-3 text-primary shrink-0" />
                  <span>trả lời</span>
                  <span className="font-semibold text-primary">
                    @{cmt.replyToName}
                  </span>
                </span>
              )}
              <span className="text-[11px] text-muted-foreground shrink-0">
                •{" "}
                {cmt.isOptimistic
                  ? "Đang gửi..."
                  : formatRelativeTime(cmt.createdAt)}
              </span>
            </div>

            {canDelete && (
              <button
                type="button"
                onClick={() => setDeletingCommentId(cmt.id)}
                disabled={deleteCommentMutation.isPending}
                aria-label="Xóa bình luận"
                title="Xóa bình luận"
                className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition-colors cursor-pointer shrink-0"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>

          <p className="text-xs text-foreground/90 leading-relaxed break-words">
            {cmt.content}
          </p>

          {!cmt.isOptimistic && (
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() =>
                  handleSelectReply(cmt.id, cmt.author.fullName)
                }
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer py-0.5"
              >
                <span>Trả lời</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="pt-3 mt-2 border-t border-border/80 space-y-3">
      {/* Comment List */}
      {isLoading ? (
        <div className="space-y-2 py-2">
          <div className="h-12 rounded-xl bg-muted/60 animate-pulse" />
          <div className="h-12 rounded-xl bg-muted/60 animate-pulse" />
        </div>
      ) : threadedComments.length === 0 ? (
        <div className="py-4 text-center space-y-1">
          <MessageSquare className="size-5 mx-auto text-muted-foreground/60" />
          <p className="text-xs text-muted-foreground">
            Chưa có bình luận nào. Hãy là người đầu tiên đặt câu hỏi hoặc chia sẻ cảm nhận!
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {threadedComments.map(({ root, replies }) => (
            <div key={root.id} className="space-y-2">
              {renderCommentCard(root, false)}

              {replies.length > 0 && (
                <div className="ml-7 sm:ml-9 pl-3 border-l-2 border-border/80 space-y-2">
                  {replies.map((reply) =>
                    renderCommentCard(reply, true)
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input Form */}
      {user ? (
        <div className="space-y-2">
          {replyTarget && (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-secondary/50 border border-primary/25 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <CornerDownRight className="size-3.5 text-primary shrink-0" />
                <span className="text-muted-foreground">Đang trả lời</span>
                <span className="font-bold text-primary truncate">
                  @{replyTarget.replyToName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReplyTarget(null)}
                aria-label="Hủy trả lời bình luận"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
              >
                <X className="size-3" />
                <span>Hủy</span>
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                replyTarget
                  ? `Viết câu trả lời cho @${replyTarget.replyToName}...`
                  : "Viết bình luận hỏi kinh nghiệm hoặc chia sẻ cảm nghĩ..."
              }
              maxLength={COMMUNITY_UI_CONSTANTS.MAX_COMMENT_LENGTH}
              aria-label="Nội dung bình luận"
              className="flex-1 h-11 px-3.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!content.trim()}
              className="h-11 px-4 rounded-xl text-xs font-semibold gap-1.5 shrink-0 cursor-pointer"
            >
              <Send className="size-3.5" />
              <span>Gửi</span>
            </Button>
          </form>
        </div>
      ) : (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground">
          <span>Đăng nhập để bình luận và trao đổi kinh nghiệm cùng tác giả.</span>
          <Link
            href="/login"
            className="font-semibold text-primary hover:underline shrink-0 ml-2"
          >
            Đăng nhập
          </Link>
        </div>
      )}
      {/* Confirm Delete Comment Modal */}
      {deletingCommentId !== null && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="drawer-confirm-delete-comment-title"
          aria-describedby="drawer-confirm-delete-comment-desc"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => {
            if (!deleteCommentMutation.isPending) {
              setDeletingCommentId(null);
            }
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-foreground shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="size-10 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
                <Trash2 className="size-5" />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <h4
                  id="drawer-confirm-delete-comment-title"
                  className="text-base font-bold text-foreground"
                >
                  Xác nhận xóa bình luận?
                </h4>
                <p
                  id="drawer-confirm-delete-comment-desc"
                  className="text-xs sm:text-sm text-muted-foreground leading-relaxed"
                >
                  Bạn có chắc chắn muốn xóa bình luận này không? Hành động này không thể hoàn tác.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <Button
                type="button"
                variant="outline"
                disabled={deleteCommentMutation.isPending}
                onClick={() => setDeletingCommentId(null)}
                className="h-9 px-4 rounded-xl text-xs font-medium cursor-pointer"
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleteCommentMutation.isPending}
                onClick={async () => {
                  if (!deletingCommentId) return;
                  try {
                    await deleteCommentMutation.mutateAsync({
                      commentId: deletingCommentId,
                      postId,
                    });
                    setDeletingCommentId(null);
                  } catch {
                    // Handled by react-query onError
                  }
                }}
                className="h-9 px-4 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
              >
                {deleteCommentMutation.isPending && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                <span>Xóa bình luận</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
