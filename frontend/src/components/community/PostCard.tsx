"use client";

import { useState } from "react";
import Image from "next/image";
import { Heart, MessageCircle, Copy, MapPin } from "lucide-react";
import { CommunityPost } from "@/types/community";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PostCardProps {
  post: CommunityPost;
}

export function PostCard({ post }: PostCardProps) {
  const [likes, setLikes] = useState(post.likeCount);
  const [isLiked, setIsLiked] = useState(post.isLiked || false);

  const toggleLike = () => {
    if (isLiked) {
      setLikes(likes - 1);
      setIsLiked(false);
    } else {
      setLikes(likes + 1);
      setIsLiked(true);
      toast.success("Đã thích bài viết!");
    }
  };

  const copyPlanner = () => {
    toast.success(`Đã sao chép lịch trình "${post.linkedPlannerTitle}" vào tài khoản của bạn!`);
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card p-5 space-y-4 shadow-xs hover:border-primary/30 transition-all">
      {/* Author Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="size-10 border border-border">
            <AvatarImage src={post.authorAvatar} alt={post.authorName} />
            <AvatarFallback>{post.authorName.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div>
            <h4 className="text-sm font-bold text-foreground leading-tight">
              {post.authorName}
            </h4>
            <p className="text-[11px] text-muted-foreground">
              {post.createdAt} • <span className="text-primary font-medium">{post.destination}</span>
            </p>
          </div>
        </div>

        <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted/60 px-2 py-1 rounded-md">
          <MapPin className="size-3 text-primary" />
          {post.destination}
        </span>
      </div>

      {/* Post Title & Content */}
      <div className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground line-clamp-1 font-heading">
          {post.title}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
          {post.content}
        </p>
      </div>

      {/* Image Gallery */}
      {post.images.length > 0 && (
        <div className="relative h-44 sm:h-48 w-full overflow-hidden rounded-xl bg-muted">
          <Image
            src={post.images[0]}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        </div>
      )}

      {/* Linked Planner Banner */}
      {post.linkedPlannerId && (
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase text-primary tracking-wider">
              Lịch trình đính kèm
            </span>
            <p className="font-semibold text-foreground line-clamp-1">
              {post.linkedPlannerTitle}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={copyPlanner}
            className="text-xs h-7 gap-1 rounded-lg border-primary/30 text-primary hover:bg-primary hover:text-white"
          >
            <Copy className="size-3" />
            <span>Sao chép</span>
          </Button>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/70 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleLike}
            className={`flex items-center gap-1.5 transition-colors ${
              isLiked ? "text-rose-500 font-semibold" : "hover:text-foreground"
            }`}
          >
            <Heart className={`size-4 ${isLiked ? "fill-current" : ""}`} />
            <span>{likes}</span>
          </button>
          <div className="flex items-center gap-1.5">
            <MessageCircle className="size-4" />
            <span>{post.commentCount}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {post.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-[10px] text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
