"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/community/PostCard";
import { MOCK_COMMUNITY_POSTS } from "@/mocks/data/community";
import { toast } from "sonner";

export default function CommunityPage() {

  return (
    <div className="max-w-[1536px] mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10 space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading text-foreground">
            Cộng đồng du lịch
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Chia sẻ trải nghiệm, ảnh check-in và gợi ý lịch trình.
          </p>
        </div>

        <Button
          onClick={() => toast.success("Đã mở trình soạn bài viết mới!")}
          className="h-10 px-4 rounded-xl font-bold gap-2 bg-primary text-primary-foreground shadow-xs"
        >
          <Plus className="size-4" />
          <span>Đăng bài</span>
        </Button>
      </div>

      {/* Community Feed Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_COMMUNITY_POSTS.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
